import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowRight, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import ActiveTimerChip from '../components/ActiveTimerChip';
import {
  getTimeStats,
  TimeStats,
  minutesToHoursMinutes,
  fetchTimeEntriesByDate,
  getDailyTimeInfo,
  TimeEntry,
  DailyTimeInfo
} from '../services/timesService';
import { parseDuration, formatDuration } from '../lib/timeUtils';
import { getTaskProgressInfo, getStatusBarColor, getStatusDotColor } from '../lib/progressUtils';
import { fetchTasks } from '../services/tasksService';
import { queryKeys } from '../lib/queryKeys';
import { Task } from '../../types/tasks';

function HomePage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [dailyInfo, setDailyInfo] = useState<DailyTimeInfo | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  // Reuse the cached task list (same key as useTasks) instead of bypassing the cache.
  const { data: tasksData } = useQuery<Task[]>({
    queryKey: queryKeys.tasks.list(''),
    queryFn: () => fetchTasks()
  });
  const tasks = useMemo(() => tasksData ?? [], [tasksData]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    const loadStats = async () => {
      try {
        const data = await getTimeStats();
        setStats(data);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    };

    const loadDailyData = async () => {
      try {
        const [entries, info] = await Promise.all([fetchTimeEntriesByDate(today), getDailyTimeInfo(today)]);
        setTodayEntries(entries);
        setDailyInfo(info);
      } catch {
        // silent
      } finally {
        setIsDailyLoading(false);
      }
    };

    loadStats();
    loadDailyData();
  }, []);

  const formatTime = (minutes: number) => {
    const { hours, minutes: mins } = minutesToHoursMinutes(minutes);
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  const getTaskEstimatedTime = useCallback(
    (taskId: number): number => {
      const task = tasks.find((t) => t.id === taskId);
      return task?.estimatedTime ?? 0;
    },
    [tasks]
  );

  const taskSummary = useMemo(() => {
    const map = new Map<number, { taskName: string; totalMins: number; count: number; estimated: number }>();
    for (const entry of todayEntries) {
      const key = entry.taskId;
      const name = entry.taskName ?? t('common.noTask');
      const { hours, minutes } = parseDuration(entry.startTime, entry.endTime);
      const mins = hours * 60 + minutes;
      const existing = map.get(key);
      if (existing) {
        existing.totalMins += mins;
        existing.count++;
      } else {
        map.set(key, { taskName: name, totalMins: mins, count: 1, estimated: getTaskEstimatedTime(key) });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalMins - a.totalMins);
  }, [todayEntries, t, getTaskEstimatedTime]);

  const todayDateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('home.title')}</h1>
        <p className="text-muted-foreground text-lg">{t('home.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/worktime">
              <Button size="lg">
                <Clock className="h-5 w-5 mr-2" />
                {t('workTimeForm.title')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link
              to="/history"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('home.viewHistory')}
            </Link>
          </div>
          <ActiveTimerChip />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.quickStats')}</CardTitle>
          <CardDescription>{t('home.statsSummary')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted">
              {isLoading ? (
                <Skeleton className="h-8 w-16 mx-auto mb-1" />
              ) : (
                <div className="text-2xl font-bold">{formatTime(stats?.todayMinutes || 0)}</div>
              )}
              <div className="text-sm text-muted-foreground">{t('home.today')}</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              {isLoading ? (
                <Skeleton className="h-8 w-16 mx-auto mb-1" />
              ) : (
                <div className="text-2xl font-bold">{formatTime(stats?.weekMinutes || 0)}</div>
              )}
              <div className="text-sm text-muted-foreground">{t('home.thisWeek')}</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              {isLoading ? (
                <Skeleton className="h-8 w-20 mx-auto mb-1" />
              ) : (
                <div className={`text-2xl font-bold ${(stats?.pendingEntries || 0) > 0 ? 'text-warning' : ''}`}>
                  {stats?.pendingEntries || 0}
                </div>
              )}
              <div className="text-sm text-muted-foreground">{t('home.pendingEntries')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t('home.dailyView')}</CardTitle>
                <CardDescription className="mt-0.5 capitalize">{todayDateLabel}</CardDescription>
              </div>
            </div>
            {dailyInfo && dailyInfo.maxMinutes > 0 && (
              <div className="text-sm text-right text-muted-foreground">
                <span className="font-semibold text-foreground">{formatTime(dailyInfo.totalMinutes)}</span>
                {' / '}
                {formatTime(dailyInfo.maxMinutes)}
              </div>
            )}
          </div>
          {dailyInfo && dailyInfo.maxMinutes > 0 && (
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  dailyInfo.totalMinutes >= dailyInfo.maxMinutes ? 'bg-warning' : 'bg-primary'
                }`}
                style={{
                  width: `${Math.round(Math.min(100, (dailyInfo.totalMinutes / dailyInfo.maxMinutes) * 100))}%`
                }}
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isDailyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : taskSummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('home.noEntriesYet')}</p>
              <Link to="/worktime">
                <Button variant="outline" size="sm" className="mt-4">
                  {t('workTimeForm.title')}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {taskSummary.map((task, idx) => {
                const taskHours = Math.floor(task.totalMins / 60);
                const taskMins = task.totalMins % 60;
                const { status, margin, over } = getTaskProgressInfo(task.estimated, task.totalMins);
                const barColor = getStatusBarColor(status);
                const progressPct = task.estimated > 0 ? Math.min(100, (task.totalMins / task.estimated) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(status)}`} />
                        <span className="font-medium truncate max-w-[65%]" title={task.taskName}>
                          {task.taskName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.estimated > 0 && (
                          <span className="text-xs text-muted-foreground" title={t('tasks.colEstimatedTime')}>
                            {formatDuration(Math.floor(task.estimated / 60), task.estimated % 60)}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {formatDuration(taskHours, taskMins)}
                          {task.count > 1 && <span className="ml-1.5 text-xs opacity-60">({task.count})</span>}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.round(Math.max(4, progressPct))}%` }}
                      />
                    </div>
                    {task.estimated > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{Math.round(progressPct)}%</span>
                        {status === 'overtime' && over > 0 && (
                          <span className="text-destructive font-medium">
                            +{formatDuration(Math.floor(over / 60), over % 60)}
                          </span>
                        )}
                        {status === 'warning' && margin > 0 && (
                          <span>
                            {t('home.margin')}: {formatDuration(Math.floor(margin / 60), margin % 60)}
                          </span>
                        )}
                        {status === 'on-time' && margin > 0 && (
                          <span>
                            {t('home.margin')}: {formatDuration(Math.floor(margin / 60), margin % 60)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {dailyInfo && dailyInfo.remainingMinutes > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  {t('home.remaining', { time: formatTime(dailyInfo.remainingMinutes) })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;
