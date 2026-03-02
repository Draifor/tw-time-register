import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, CalendarDays, ListTodo, TrendingUp, Clock, CheckCircle2, CircleDot } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import useTimeLogs from '../hooks/useTimeLogs';
import { Skeleton } from '../components/ui/skeleton';

// ── helpers ────────────────────────────────────────────────────────────────

function toMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes === 0) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
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

// ── main component ─────────────────────────────────────────────────────────

function ReportsPage() {
  const { data, isLoading } = useTimeLogs();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Apply date range filter
  const filtered = useMemo(() => {
    return data.filter((e) => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  // ── aggregations ──────────────────────────────────────────────────────────

  const totalMinutes = useMemo(() => filtered.reduce((s, e) => s + toMinutes(e.startTime, e.endTime), 0), [filtered]);
  const sentCount = useMemo(() => filtered.filter((e) => e.isSent).length, [filtered]);
  const billableMinutes = useMemo(
    () => filtered.filter((e) => e.isBillable).reduce((s, e) => s + toMinutes(e.startTime, e.endTime), 0),
    [filtered]
  );

  // By task
  const byTask = useMemo(() => {
    const map = new Map<string, { minutes: number; billableMinutes: number; entries: number; sentEntries: number }>();
    for (const e of filtered) {
      const key = e.taskName || t('common.noTask');
      const prev = map.get(key) ?? { minutes: 0, billableMinutes: 0, entries: 0, sentEntries: 0 };
      const mins = toMinutes(e.startTime, e.endTime);
      map.set(key, {
        minutes: prev.minutes + mins,
        billableMinutes: prev.billableMinutes + (e.isBillable ? mins : 0),
        entries: prev.entries + 1,
        sentEntries: prev.sentEntries + (e.isSent ? 1 : 0)
      });
    }
    return [...map.entries()].map(([taskName, v]) => ({ taskName, ...v })).sort((a, b) => b.minutes - a.minutes);
  }, [filtered, t]);

  // By day
  const byDay = useMemo(() => {
    const map = new Map<string, { minutes: number; entries: number; sentEntries: number }>();
    for (const e of filtered) {
      const key = e.date;
      const prev = map.get(key) ?? { minutes: 0, entries: 0, sentEntries: 0 };
      map.set(key, {
        minutes: prev.minutes + toMinutes(e.startTime, e.endTime),
        entries: prev.entries + 1,
        sentEntries: prev.sentEntries + (e.isSent ? 1 : 0)
      });
    }
    return [...map.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

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
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('reports.to')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
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
          value={`${sentCount}`}
          sub={
            filtered.length > 0 ? `${Math.round((sentCount / filtered.length) * 100)}% ${t('reports.ofTotal')}` : '—'
          }
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
          <TabsList className="grid w-full grid-cols-2 lg:w-[320px]">
            <TabsTrigger value="task" className="gap-2">
              <ListTodo className="h-4 w-4" />
              {t('reports.byTask')}
            </TabsTrigger>
            <TabsTrigger value="day" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {t('reports.byDay')}
            </TabsTrigger>
          </TabsList>

          {/* ── BY TASK ── */}
          <TabsContent value="task">
            <div className="rounded-md border overflow-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.colTask')}</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colEntries')}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colTotalHours')}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colBillable')}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colSyncStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byTask.map((row) => {
                    const pct = row.entries > 0 ? Math.round((row.sentEntries / row.entries) * 100) : 0;
                    const barWidth = totalMinutes > 0 ? Math.round((row.minutes / totalMinutes) * 100) : 0;
                    return (
                      <tr key={row.taskName} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="font-medium truncate" title={row.taskName}>
                            {row.taskName}
                          </div>
                          {/* mini progress bar */}
                          <div className="mt-1 h-1 w-full rounded-full bg-muted">
                            <div className="h-1 rounded-full bg-primary/60" style={{ width: `${barWidth}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{row.entries}</td>
                        <td className="px-4 py-3 text-center font-mono font-medium">{formatDuration(row.minutes)}</td>
                        <td className="px-4 py-3 text-center">
                          {row.billableMinutes > 0 ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              {formatDuration(row.billableMinutes)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pct === 100 ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-600 border-emerald-300 dark:text-emerald-400 gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t('common.sent')}
                            </Badge>
                          ) : pct === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <CircleDot className="h-3 w-3" />
                              {t('common.pending')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-300 dark:text-amber-400 gap-1"
                            >
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
          </TabsContent>

          {/* ── BY DAY ── */}
          <TabsContent value="day">
            <div className="rounded-md border overflow-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.colDate')}</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colEntries')}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colTotalHours')}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {t('reports.colSyncStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((row) => {
                    const pct = row.entries > 0 ? Math.round((row.sentEntries / row.entries) * 100) : 0;
                    return (
                      <tr key={row.date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{formatDate(row.date, locale)}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{row.entries}</td>
                        <td className="px-4 py-3 text-center font-mono font-medium">{formatDuration(row.minutes)}</td>
                        <td className="px-4 py-3 text-center">
                          {pct === 100 ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-600 border-emerald-300 dark:text-emerald-400 gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t('common.sent')}
                            </Badge>
                          ) : pct === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <CircleDot className="h-3 w-3" />
                              {t('common.pending')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-300 dark:text-amber-400 gap-1"
                            >
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default ReportsPage;
