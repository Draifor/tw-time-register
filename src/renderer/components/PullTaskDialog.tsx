import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Loader2, CalendarRange, Clock, CheckCircle2, SkipForward, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { pullEntriesFromTW, PullFromTWResult } from '../services/timesService';
import { Task } from '../../types/tasks';

type PeriodMode = 'lastMonth' | 'lastWeek' | 'custom' | 'all';

function getPeriodDates(mode: PeriodMode): { fromDate?: string; toDate?: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (mode === 'lastWeek') {
    const from = new Date(today);
    from.setDate(today.getDate() - 7);
    return { fromDate: fmt(from), toDate: fmt(today) };
  }
  if (mode === 'lastMonth') {
    const from = new Date(today);
    from.setMonth(today.getMonth() - 1);
    return { fromDate: fmt(from), toDate: fmt(today) };
  }
  return {};
}

function extractId(taskLink: string): string {
  return taskLink?.match(/\/tasks\/(\d+)/)?.[1] ?? '';
}

interface Props {
  task: Task;
}

export default function PullTaskDialog({ task }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const twTaskId = extractId(task.taskLink ?? '');
  const hasLink = Boolean(twTaskId);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>('lastMonth');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [result, setResult] = useState<PullFromTWResult | null>(null);

  function resetState() {
    setMode('lastMonth');
    setFromDate('');
    setToDate('');
    setResult(null);
  }

  function handleClose(value: boolean) {
    if (!value) resetState();
    setOpen(value);
  }

  async function handlePull() {
    setIsPulling(true);
    setResult(null);
    try {
      const datePart =
        mode === 'custom' ? { fromDate: fromDate || undefined, toDate: toDate || undefined } : getPeriodDates(mode);
      const res = await pullEntriesFromTW({ ...datePart, twTaskId });
      setResult(res);
      if (res.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        toast.success(t('timeLogs.pull.successToast', { count: res.imported }));
      } else {
        toast.info(t('timeLogs.pull.noneImported'));
      }
    } catch {
      toast.error(t('timeLogs.pull.errorToast'));
    } finally {
      setIsPulling(false);
    }
  }

  const periodOptions: { value: PeriodMode; label: string; icon: 'clock' | 'calendar' }[] = [
    { value: 'lastWeek', label: t('timeLogs.pull.lastWeek'), icon: 'clock' },
    { value: 'lastMonth', label: t('timeLogs.pull.lastMonth'), icon: 'clock' },
    { value: 'custom', label: t('timeLogs.pull.custom'), icon: 'calendar' },
    { value: 'all', label: t('timeLogs.pull.allHistory'), icon: 'calendar' }
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!hasLink}
              title={hasLink ? t('timeLogs.pull.taskTrigger') : t('timeLogs.pull.noTaskLink')}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{hasLink ? t('timeLogs.pull.taskTrigger') : t('timeLogs.pull.noTaskLink')}</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('timeLogs.pull.taskTitle', { name: task.taskName })}
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-5 w-5" />
                {t('timeLogs.pull.taskTitle', { name: task.taskName })}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* ── Step: config ── */}
          {!result && (
            <>
              <p className="text-sm text-muted-foreground">{t('timeLogs.pull.taskSubtitle')}</p>

              {/* Period selector */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('timeLogs.pull.periodLabel')}</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {periodOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors text-left ${
                        mode === opt.value
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {opt.icon === 'clock' ? (
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'all' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                  {t('timeLogs.pull.allHistoryWarning')}
                </p>
              )}

              {mode === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="pt-from" className="text-xs">
                      {t('timeLogs.pull.fromLabel')}
                    </Label>
                    <Input
                      id="pt-from"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pt-to" className="text-xs">
                      {t('timeLogs.pull.toLabel')}
                    </Label>
                    <Input
                      id="pt-to"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={isPulling}>
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={handlePull} disabled={isPulling} className="gap-1.5">
                  {isPulling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('timeLogs.pull.pulling')}
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="h-4 w-4" />
                      {t('timeLogs.pull.pullBtn')}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* ── Step: result ── */}
          {result && (
            <>
              <p className="text-sm text-muted-foreground">
                {t('timeLogs.pull.resultSubtitle', { total: result.total })}
              </p>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">{t('timeLogs.pull.imported')}</p>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <SkipForward className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-2xl font-bold">{result.skippedExisting}</p>
                  <p className="text-xs text-muted-foreground">{t('timeLogs.pull.alreadyExisted')}</p>
                </div>
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.skippedNoTask}</p>
                  <p className="text-xs text-muted-foreground">{t('timeLogs.pull.noTask')}</p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={resetState} disabled={isPulling}>
                  {t('timeLogs.pull.pullAgain')}
                </Button>
                <Button size="sm" onClick={() => handleClose(false)}>
                  {t('common.done')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
