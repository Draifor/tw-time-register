import React, { useEffect, useMemo, useState } from 'react';
import { Control, useWatch } from 'react-hook-form';
import { Database, FileEdit, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { es as dateFnsEs, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { getDailyTimeInfo, minutesToHoursMinutes, DailyTimeInfo } from '../services/timesService';
import i18n from '../plugins/i18n';

interface TotalTimeDayProps {
  // Control is contravariant in its type param — accept any control without losing type safety
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
}

function fmt(minutes: number): string {
  const { hours, minutes: mins } = minutesToHoursMinutes(minutes);
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

function TotalTimeDay({ control }: TotalTimeDayProps) {
  const { t } = useTranslation();

  const entries = useWatch({ control, name: 'entries' });
  const [dbInfo, setDbInfo] = useState<Map<string, DailyTimeInfo>>(new Map());
  const [loading, setLoading] = useState(false);

  // All unique dates present in the form, sorted ascending
  const uniqueDates = useMemo(() => {
    if (!entries || !Array.isArray(entries)) return [];
    const seen = new Set<string>();
    entries.forEach((e: { date?: string }) => {
      if (e?.date) seen.add(e.date);
    });
    return [...seen].sort();
  }, [entries]);

  // Fetch DailyTimeInfo for every unique date in parallel
  const datesKey = uniqueDates.join(',');
  useEffect(() => {
    if (uniqueDates.length === 0) return;
    setLoading(true);
    Promise.all(uniqueDates.map((d) => getDailyTimeInfo(d).then((info) => [d, info] as [string, DailyTimeInfo])))
      .then((pairs) => setDbInfo(new Map(pairs)))
      .catch(() => setDbInfo(new Map()))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey]);

  // Draft minutes per date, aggregated from form entries
  const draftByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (!entries || !Array.isArray(entries)) return map;
    entries.forEach((e: { date?: string; hours?: Date[] }) => {
      if (!e?.date) return;
      const h = e.hours?.[0]?.getHours() ?? 0;
      const m = e.hours?.[0]?.getMinutes() ?? 0;
      map.set(e.date, (map.get(e.date) ?? 0) + h * 60 + m);
    });
    return map;
  }, [entries]);

  const dateLocale = i18n.language.startsWith('es') ? dateFnsEs : enUS;
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE dd MMM', { locale: dateLocale });
    } catch {
      return dateStr;
    }
  };

  const grandDraftMinutes = [...draftByDate.values()].reduce((a, b) => a + b, 0);
  const grandSavedMinutes = [...dbInfo.values()].reduce((a, v) => a + v.totalMinutes, 0);
  const grandTotalMinutes = grandDraftMinutes + grandSavedMinutes;

  if (uniqueDates.length === 0) return null;

  return (
    <TooltipProvider>
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="py-3 px-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {t('workTimeForm.summary.title')}
            </CardTitle>
            <div className="flex items-center gap-2">
              {uniqueDates.length > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {t('workTimeForm.summary.nDays', { count: uniqueDates.length })}
                </Badge>
              )}
              <span className="font-bold text-base">{fmt(grandTotalMinutes)}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 pt-0">
          <div className="space-y-1.5">
            {uniqueDates.map((date) => {
              const info = dbInfo.get(date);
              const savedMin = info?.totalMinutes ?? 0;
              const draftMin = draftByDate.get(date) ?? 0;
              const totalMin = savedMin + draftMin;
              const maxMin = info?.maxMinutes ?? 0;
              const isOver = maxMin > 0 && totalMin > maxMin;
              const isComplete = maxMin > 0 && totalMin >= maxMin;
              const remaining = maxMin > 0 ? Math.max(0, maxMin - totalMin) : null;

              const statusColor = isOver
                ? 'text-red-600 dark:text-red-400'
                : isComplete
                  ? 'text-green-600 dark:text-green-400'
                  : remaining !== null && remaining <= maxMin * 0.25
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-muted-foreground';

              return (
                <div key={date} className="flex items-center gap-3 text-sm">
                  {/* Short day + date label */}
                  <span className="w-24 font-medium capitalize text-xs shrink-0">{formatDate(date)}</span>

                  {/* Saved in DB */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-muted-foreground cursor-help w-16 shrink-0">
                        {loading ? (
                          <Skeleton className="h-3 w-12" />
                        ) : (
                          <>
                            <Database className="h-3 w-3 shrink-0" />
                            <span className="text-xs">{fmt(savedMin)}</span>
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{t('workTimeForm.summary.saved')}</TooltipContent>
                  </Tooltip>

                  {/* Draft (unsaved form entries) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-muted-foreground cursor-help w-16 shrink-0">
                        <FileEdit className="h-3 w-3 shrink-0" />
                        <span className="text-xs">{fmt(draftMin)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{t('workTimeForm.summary.draft')}</TooltipContent>
                  </Tooltip>

                  {/* Combined total vs max + status indicator */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`font-semibold text-xs ${statusColor}`}>
                      {fmt(totalMin)}
                      {maxMin > 0 && <span className="text-muted-foreground font-normal"> / {fmt(maxMin)}</span>}
                    </span>

                    {maxMin > 0 && (
                      <span className={`text-xs ml-auto ${statusColor}`}>
                        {isOver
                          ? `⚠ +${fmt(totalMin - maxMin)}`
                          : isComplete
                            ? `✓ ${t('workTimeForm.summary.complete')}`
                            : `${fmt(remaining!)} ${t('workTimeForm.summary.left')}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Grand total row — only shown when there are multiple days */}
            {uniqueDates.length > 1 && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-xs font-semibold text-muted-foreground shrink-0">
                    {t('workTimeForm.summary.total')}
                  </span>
                  <div className="flex items-center gap-1 text-muted-foreground w-16 shrink-0">
                    <Database className="h-3 w-3 shrink-0" />
                    <span className="text-xs">{fmt(grandSavedMinutes)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground w-16 shrink-0">
                    <FileEdit className="h-3 w-3 shrink-0" />
                    <span className="text-xs">{fmt(grandDraftMinutes)}</span>
                  </div>
                  <span className="font-bold text-xs">{fmt(grandTotalMinutes)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default TotalTimeDay;
