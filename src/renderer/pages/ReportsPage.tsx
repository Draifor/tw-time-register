import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  CalendarDays,
  CalendarRange,
  ListTodo,
  TrendingUp,
  Clock,
  CheckCircle2,
  CircleDot
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es as dateFnsEs } from 'date-fns/locale/es';
import { enUS } from 'date-fns/locale/en-US';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import useTimeLogs from '../hooks/useTimeLogs';
import useIncrementalRows from '../hooks/useIncrementalRows';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { Skeleton } from '../components/ui/skeleton';
import { fetchTasks } from '../services/tasksService';
import { queryKeys } from '../lib/queryKeys';
import { getTaskProgressInfo, getStatusDotColor, formatMinutesToHHMM } from '../lib/progressUtils';
import {
  ReportPreset,
  aggregateByDay,
  aggregateByTask,
  aggregateByWeek,
  entryMinutes,
  loadSavedRange,
  resolvePresetRange,
  saveRange
} from '../lib/reportsUtils';
import { Task } from '../../types/tasks';

// ── helpers ────────────────────────────────────────────────────────────────

function formatDuration(totalMinutes: number): string {
  const total = Math.round(totalMinutes);
  if (total === 0) return '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatDate(dateStr: string, locale: string): string {
  if (!dateStr) return '—';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

/** Compact localized "Jan 5 – 11, 2026" style label for a Monday-first week. */
function formatWeekRange(weekStart: string, weekEnd: string, locale: string): string {
  const toDate = (dateStr: string): Date => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d);
  };
  const start = toDate(weekStart);
  const end = toDate(weekEnd);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const endLabel = sameMonth
    ? end.toLocaleDateString(locale, { day: 'numeric', year: 'numeric' })
    : end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

// ── summary cards ──────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}

function SummaryCard({ label, value, sub, icon: Icon }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── sent vs local cell ─────────────────────────────────────────────────────

interface SentLocalCellProps {
  sentMinutes: number;
  localMinutes: number;
  ratioLabel: string;
}

/**
 * One compact cell for both tables: sent / local durations plus a stacked
 * ratio bar. The bar carries `ratioLabel` as both a tooltip and screen-reader
 * text so the sent share is never conveyed by color alone (UX-504).
 */
function SentLocalCell({ sentMinutes, localMinutes, ratioLabel }: SentLocalCellProps) {
  const total = sentMinutes + localMinutes;
  const sentShare = total > 0 ? Math.round((sentMinutes / total) * 100) : 0;
  const localShare = total > 0 ? 100 - sentShare : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-xs">
        <span className="text-success">{formatDuration(sentMinutes)}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="text-muted-foreground">{formatDuration(localMinutes)}</span>
      </span>
      <div className="flex h-1 w-16 overflow-hidden rounded-full bg-muted" title={ratioLabel}>
        <div className="h-full bg-success" style={{ width: `${sentShare}%` }} />
        <div className="h-full bg-muted-foreground/40" style={{ width: `${localShare}%` }} />
      </div>
      <span className="sr-only">{ratioLabel}</span>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

function ReportsPage() {
  const { data, isLoading } = useTimeLogs();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';
  const dateLocale = i18n.language.startsWith('es') ? dateFnsEs : enUS;
  // Reuse the cached task list (same key as useTasks) instead of bypassing the cache.
  const { data: tasksData } = useQuery<Task[]>({
    queryKey: queryKeys.tasks.list(''),
    queryFn: () => fetchTasks()
  });
  const tasks = useMemo(() => tasksData ?? [], [tasksData]);

  // O(1) task lookup by name for the per-row progress columns below. First
  // match wins, mirroring the previous `tasks.find(...)` semantics.
  const tasksByName = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      if (!map.has(task.taskName)) map.set(task.taskName, task);
    }
    return map;
  }, [tasks]);

  const getTaskEstimatedTime = (taskName: string): number => {
    return tasksByName.get(taskName)?.estimatedTime ?? 0;
  };

  const getTaskLoggedMinutes = (taskName: string): number => {
    return tasksByName.get(taskName)?.totalLoggedMinutes ?? 0;
  };

  // Restore the last range once per mount (guarded parse). A saved non-custom
  // preset is re-resolved against the current date so its label always matches
  // the shown range (a stored "This month" must not keep a stale month); a
  // saved custom range keeps its explicit dates. Falls back to custom with no
  // range, which preserves the previous "all entries" behavior.
  const [initialRange] = useState(() => {
    const saved = loadSavedRange();
    if (saved && saved.preset !== 'custom') return { preset: saved.preset, ...resolvePresetRange(saved.preset) };
    return saved;
  });
  const [preset, setPreset] = useState<ReportPreset>(initialRange?.preset ?? 'custom');
  const [dateFrom, setDateFrom] = useState(initialRange?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(initialRange?.dateTo ?? '');
  const [taskSearch, setTaskSearch] = useState('');

  // Remember the active range across reloads.
  useEffect(() => {
    saveRange({ preset, dateFrom, dateTo });
  }, [preset, dateFrom, dateTo]);

  const applyPreset = (next: ReportPreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const range = resolvePresetRange(next);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const presetOptions = useMemo<{ value: ReportPreset; label: string }[]>(
    () => [
      { value: 'thisMonth', label: t('reports.presetThisMonth') },
      { value: 'thisWeek', label: t('reports.presetThisWeek') },
      { value: 'previousMonth', label: t('reports.presetPreviousMonth') },
      { value: 'custom', label: t('reports.presetCustom') }
    ],
    [t]
  );
  // The input stays controlled by the raw term; only the expensive recomputes
  // below consume the debounced term.
  const debouncedTaskSearch = useDebouncedValue(taskSearch, 200);

  const taskOptions = useMemo(() => {
    const uniqueNames = new Set<string>();
    for (const entry of data) {
      uniqueNames.add(entry.taskName || t('common.noTask'));
    }
    return [...uniqueNames].sort((a, b) => a.localeCompare(b));
  }, [data, t]);

  const matchingTaskCount = useMemo(() => {
    const query = debouncedTaskSearch.trim().toLowerCase();
    if (!query) return taskOptions.length;
    return taskOptions.filter((taskName) => taskName.toLowerCase().includes(query)).length;
  }, [taskOptions, debouncedTaskSearch]);

  // Apply date range and task filters
  const filtered = useMemo(() => {
    const taskQuery = debouncedTaskSearch.trim().toLowerCase();
    return data.filter((e) => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      const taskName = e.taskName || t('common.noTask');
      if (taskQuery && !taskName.toLowerCase().includes(taskQuery)) return false;
      return true;
    });
  }, [data, dateFrom, dateTo, debouncedTaskSearch, t]);

  // ── aggregations ──────────────────────────────────────────────────────────

  const totalMinutes = useMemo(
    () => filtered.reduce((s, e) => s + entryMinutes(e.startTime, e.endTime), 0),
    [filtered]
  );
  const sentMinutes = useMemo(
    () => filtered.filter((e) => e.isSent).reduce((s, e) => s + entryMinutes(e.startTime, e.endTime), 0),
    [filtered]
  );
  const billableMinutes = useMemo(
    () => filtered.filter((e) => e.isBillable).reduce((s, e) => s + entryMinutes(e.startTime, e.endTime), 0),
    [filtered]
  );

  // By task / by day — pure aggregations so the sent/local split is testable
  // without rendering.
  const byTask = useMemo(() => aggregateByTask(filtered, t('common.noTask')), [filtered, t]);
  const byDay = useMemo(() => aggregateByDay(filtered), [filtered]);
  const byWeek = useMemo(() => aggregateByWeek(filtered), [filtered]);

  // The aggregations above stay computed from the FULL filtered list; these
  // hooks only cap how many of their rows are mounted at once.
  const byTaskRows = useIncrementalRows(byTask.length);
  const byDayRows = useIncrementalRows(byDay.length);
  const byWeekRows = useIncrementalRows(byWeek.length);

  // ── render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart2 className="h-6 w-6" />
          {t('reports.title')}
        </h1>
        <p className="text-muted-foreground">{t('reports.subtitle')}</p>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('reports.from')}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              // Editing a raw bound is no longer a preset.
              setDateFrom(e.target.value);
              setPreset('custom');
            }}
            className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('reports.to')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              // Editing a raw bound is no longer a preset.
              setDateTo(e.target.value);
              setPreset('custom');
            }}
            className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t('reports.presetLabel')}</span>
          <div role="group" aria-label={t('reports.presetLabel')} className="flex flex-wrap items-center gap-1">
            {presetOptions.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={preset === value ? 'default' : 'ghost'}
                aria-pressed={preset === value}
                onClick={() => applyPreset(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1 min-w-[240px] flex-1">
          <label className="text-xs font-medium text-muted-foreground">{t('reports.tasks')}</label>
          <div className="relative">
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder={t('reports.taskSearchPlaceholder')}
              className="h-8 w-full rounded-md border border-input bg-background text-foreground px-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {taskSearch.trim() ? t('reports.matchingTasks', { count: matchingTaskCount }) : t('reports.allTasks')}
          </p>
        </div>
        {(dateFrom || dateTo || taskSearch) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setTaskSearch('');
              setPreset('custom');
            }}
            className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {t('reports.clear')}
          </button>
        )}
        <p className="text-xs text-muted-foreground ml-auto self-end pb-1">
          {filtered.length} {t('common.entries')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={Clock}
          label={t('reports.totalLogged')}
          value={formatDuration(totalMinutes)}
          sub={`${filtered.length} ${t('common.entries')}`}
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('common.billable')}
          value={formatDuration(billableMinutes)}
          sub={totalMinutes > 0 ? `${Math.round((billableMinutes / totalMinutes) * 100)}%` : '—'}
        />
        <SummaryCard
          icon={CheckCircle2}
          label={t('reports.sentToTW')}
          value={formatDuration(sentMinutes)}
          sub={totalMinutes > 0 ? `${Math.round((sentMinutes / totalMinutes) * 100)}% ${t('reports.ofTotal')}` : '—'}
        />
        <SummaryCard
          icon={CalendarDays}
          label={t('reports.daysWithLogs')}
          value={`${byDay.length}`}
          sub={
            byDay.length > 0 ? `${formatDuration(Math.round(totalMinutes / byDay.length))} ${t('reports.avgDay')}` : '—'
          }
        />
      </div>

      {/* Tabs: by task / by day */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BarChart2 className="h-12 w-12 opacity-30" />
          <p className="text-lg">{t('reports.noData')}</p>
        </div>
      ) : (
        <Tabs defaultValue="task" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[440px]">
            <TabsTrigger value="task" className="gap-2">
              <ListTodo className="h-4 w-4" />
              {t('reports.byTask')}
            </TabsTrigger>
            <TabsTrigger value="day" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {t('reports.byDay')}
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2">
              <CalendarRange className="h-4 w-4" />
              {t('reports.byWeek')}
            </TabsTrigger>
          </TabsList>

          {/* ── BY TASK ── */}
          <TabsContent value="task">
            <div className="rounded-md border overflow-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('reports.colTask')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colEntries')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colTotalHours')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colSentLocal')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colEstimated')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colProgress')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colBillable')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colSyncStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byTask.slice(0, byTaskRows.visibleCount).map((row) => {
                    const pct = row.entries > 0 ? Math.round((row.sentEntries / row.entries) * 100) : 0;
                    const barWidth = totalMinutes > 0 ? Math.round((row.minutes / totalMinutes) * 100) : 0;
                    const estimated = getTaskEstimatedTime(row.taskName);
                    const logged = getTaskLoggedMinutes(row.taskName);
                    const { status, margin, over } = getTaskProgressInfo(estimated, logged);
                    return (
                      <tr key={row.taskName} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(status)}`} />
                            <div className="font-medium truncate" title={row.taskName}>
                              {row.taskName}
                            </div>
                          </div>
                          {/* mini share bar — status-colored; uses the visible
                              status indicator color so no-estimate stays legible */}
                          <div className="mt-1 h-1 w-full rounded-full bg-muted">
                            <div
                              className={`h-1 rounded-full ${getStatusDotColor(status)}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{row.entries}</td>
                        <td className="px-4 py-3 text-center font-mono font-medium">{formatDuration(row.minutes)}</td>
                        <td className="px-4 py-3 text-center">
                          <SentLocalCell
                            sentMinutes={row.sentMinutes}
                            localMinutes={row.localMinutes}
                            ratioLabel={t('reports.sentShare', {
                              pct: row.minutes > 0 ? Math.round((row.sentMinutes / row.minutes) * 100) : 0
                            })}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {estimated > 0 ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatMinutesToHHMM(estimated)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {estimated > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-mono">
                                {formatMinutesToHHMM(row.minutes)} / {formatMinutesToHHMM(estimated)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  status === 'overtime'
                                    ? 'text-destructive border-destructive/40'
                                    : status === 'warning'
                                      ? 'text-warning border-warning/40'
                                      : 'text-success border-success/40'
                                }`}
                              >
                                {status === 'overtime'
                                  ? `+${formatMinutesToHHMM(over)}`
                                  : status === 'warning'
                                    ? `${t('reports.margin')} ${formatMinutesToHHMM(margin)}`
                                    : `${t('reports.onTime')}`}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.billableMinutes > 0 ? (
                            <span className="font-mono text-success">{formatDuration(row.billableMinutes)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pct === 100 ? (
                            <Badge variant="outline" className="text-success border-success/40 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('common.sent')}
                            </Badge>
                          ) : pct === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <CircleDot className="h-3 w-3" />
                              {t('common.pending')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning/40 gap-1">
                              <CircleDot className="h-3 w-3" />
                              {pct}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {byTaskRows.hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={byTaskRows.showMore}
                  className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {t('reports.showMore', { count: byTask.length - byTaskRows.visibleCount })}
                </button>
              </div>
            )}
          </TabsContent>

          {/* ── BY DAY ── */}
          <TabsContent value="day">
            <div className="rounded-md border overflow-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('reports.colDate')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colEntries')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colTotalHours')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colSentLocal')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colSyncStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.slice(0, byDayRows.visibleCount).map((row) => {
                    const pct = row.entries > 0 ? Math.round((row.sentEntries / row.entries) * 100) : 0;
                    return (
                      <tr key={row.date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{formatDate(row.date, locale)}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{row.entries}</td>
                        <td className="px-4 py-3 text-center font-mono font-medium">{formatDuration(row.minutes)}</td>
                        <td className="px-4 py-3 text-center">
                          <SentLocalCell
                            sentMinutes={row.sentMinutes}
                            localMinutes={row.localMinutes}
                            ratioLabel={t('reports.sentShare', {
                              pct: row.minutes > 0 ? Math.round((row.sentMinutes / row.minutes) * 100) : 0
                            })}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pct === 100 ? (
                            <Badge variant="outline" className="text-success border-success/40 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('common.sent')}
                            </Badge>
                          ) : pct === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <CircleDot className="h-3 w-3" />
                              {t('common.pending')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning/40 gap-1">
                              <CircleDot className="h-3 w-3" />
                              {pct}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {byDayRows.hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={byDayRows.showMore}
                  className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {t('reports.showMore', { count: byDay.length - byDayRows.visibleCount })}
                </button>
              </div>
            )}
          </TabsContent>

          {/* ── BY WEEK ── */}
          <TabsContent value="week">
            <div className="mt-3 space-y-4">
              {byWeek.slice(0, byWeekRows.visibleCount).map((week) => {
                const pct = week.entries > 0 ? Math.round((week.sentEntries / week.entries) * 100) : 0;
                return (
                  <div key={week.weekStart} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {t('reports.weekOf', {
                            range: formatWeekRange(week.weekStart, week.weekEnd, locale)
                          })}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t('reports.weekTotal')}</span>
                          <span className="font-mono text-sm font-medium">{formatDuration(week.totalMinutes)}</span>
                        </div>
                      </div>
                      {pct === 100 ? (
                        <Badge variant="outline" className="text-success border-success/40 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('common.sent')}
                        </Badge>
                      ) : pct === 0 ? (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <CircleDot className="h-3 w-3" />
                          {t('common.pending')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning border-warning/40 gap-1">
                          <CircleDot className="h-3 w-3" />
                          {pct}%
                        </Badge>
                      )}
                    </div>

                    {/* Seven stacked sent/local bars, Monday → Sunday. */}
                    <div className="mt-4 flex items-end gap-2" style={{ height: '9rem' }}>
                      {week.days.map((day) => {
                        const barPct =
                          week.maxMinutes > 0 ? Math.max(6, Math.round((day.minutes / week.maxMinutes) * 100)) : 6;
                        const sentShare = day.minutes > 0 ? Math.round((day.sentMinutes / day.minutes) * 100) : 0;
                        const localShare = day.minutes > 0 ? 100 - sentShare : 0;
                        const dayLabel = format(parseISO(day.date), 'EEEE', { locale: dateLocale });
                        const shortDay = format(parseISO(day.date), 'EEEEEE', { locale: dateLocale });
                        const barLabel =
                          `${dayLabel}: ${formatDuration(day.minutes)} — ` +
                          `${t('common.sent')} ${formatDuration(day.sentMinutes)}, ` +
                          `${t('reports.local')} ${formatDuration(day.localMinutes)}`;
                        return (
                          <div
                            key={day.date}
                            className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch"
                          >
                            <div
                              className="flex w-full max-w-[32px] flex-col justify-end overflow-hidden rounded-sm bg-muted"
                              style={{ height: `${barPct}%` }}
                              title={barLabel}
                            >
                              {day.minutes > 0 && (
                                <>
                                  <div className="w-full bg-success" style={{ height: `${sentShare}%` }} />
                                  <div className="w-full bg-muted-foreground/40" style={{ height: `${localShare}%` }} />
                                </>
                              )}
                              <span className="sr-only">{barLabel}</span>
                            </div>
                            <span aria-hidden="true" className="text-[10px] capitalize text-muted-foreground">
                              {shortDay}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend — names the colors, so state is never color-only. */}
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-success" aria-hidden="true" />
                        {t('common.sent')}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-muted-foreground/40" aria-hidden="true" />
                        {t('reports.local')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {byWeekRows.hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={byWeekRows.showMore}
                  className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {t('reports.showMore', { count: byWeek.length - byWeekRows.visibleCount })}
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default ReportsPage;
