import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  Loader2,
  CalendarRange,
  Clock,
  CheckCircle2,
  SkipForward,
  AlertCircle,
  Plus,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { pullEntriesFromTW, fetchTWTaskDetails, PullFromTWResult, TWTaskDetail } from '../services/timesService';
import { addTask } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';

type PeriodMode = 'lastMonth' | 'lastWeek' | 'custom' | 'all';
type Step = 'config' | 'result' | 'addTasks';

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

interface MissingTaskRow extends TWTaskDetail {
  localName: string;
  typeName: string;
  selected: boolean;
}

export default function PullFromTWDialog() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('config');

  // Step 1
  const [mode, setMode] = useState<PeriodMode>('lastMonth');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullOptions, setPullOptions] = useState<{ fromDate?: string; toDate?: string }>({});

  // Step 2
  const [result, setResult] = useState<PullFromTWResult | null>(null);

  // Step 3
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [missingRows, setMissingRows] = useState<MissingTaskRow[]>([]);
  const [typeList, setTypeList] = useState<string[]>([]);
  const [savingTasks, setSavingTasks] = useState(false);

  function resetState() {
    setStep('config');
    setMode('lastMonth');
    setFromDate('');
    setToDate('');
    setResult(null);
    setMissingRows([]);
  }

  function handleClose(value: boolean) {
    if (!value) resetState();
    setOpen(value);
  }

  async function handlePull() {
    setIsPulling(true);
    setResult(null);
    const options =
      mode === 'custom' ? { fromDate: fromDate || undefined, toDate: toDate || undefined } : getPeriodDates(mode);
    setPullOptions(options);
    try {
      const res = await pullEntriesFromTW(options);
      setResult(res);
      setStep('result');
      if (res.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        toast.success(t('timeLogs.pull.successToast', { count: res.imported }));
      } else if (res.skippedNoTask === 0) {
        toast.info(t('timeLogs.pull.noneImported'));
      }
    } catch (err) {
      toast.error(t('timeLogs.pull.errorToast'), { description: (err as Error).message });
    } finally {
      setIsPulling(false);
    }
  }

  async function handleOpenAddTasks() {
    if (!result?.missingTwTaskIds.length) return;
    setLoadingTasks(true);
    setStep('addTasks');
    try {
      const [detailRes, types] = await Promise.all([fetchTWTaskDetails(result.missingTwTaskIds), fetchTypeTasks()]);
      const typeNames = types.map((t) => t.typeName);
      setTypeList(typeNames);
      setMissingRows(
        (detailRes.tasks ?? []).map((task) => ({
          ...task,
          localName: task.name,
          typeName: typeNames[0] ?? '',
          selected: true
        }))
      );
    } catch (err) {
      toast.error(t('timeLogs.pull.loadError'), { description: (err as Error).message });
      setStep('result');
    } finally {
      setLoadingTasks(false);
    }
  }

  async function handleSaveTasks() {
    const toSave = missingRows.filter((r) => r.selected && r.localName.trim() && r.typeName);
    if (!toSave.length) return;
    setSavingTasks(true);
    let saved = 0;
    let failed = 0;
    for (const row of toSave) {
      try {
        await addTask({
          taskName: row.localName.trim(),
          typeName: row.typeName,
          taskLink: row.taskLink,
          description: ''
        });
        saved++;
      } catch {
        failed++;
      }
    }
    setSavingTasks(false);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['typeTasks'] });
    if (failed > 0) {
      toast.error(t('timeLogs.pull.taskSaveError'), { description: `${failed} ${t('timeLogs.pull.taskSaveFailed')}` });
    } else {
      toast.success(t('timeLogs.pull.tasksSaved', { count: saved }));
    }
    // Go back to result to re-import
    setStep('result');
  }

  async function handleReimport() {
    setIsPulling(true);
    setResult(null);
    try {
      const res = await pullEntriesFromTW(pullOptions);
      setResult(res);
      setMissingRows([]);
      if (res.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ['timeLogs'] });
        toast.success(t('timeLogs.pull.successToast', { count: res.imported }));
      } else {
        toast.info(t('timeLogs.pull.noneImported'));
      }
    } catch (err) {
      toast.error(t('timeLogs.pull.errorToast'), { description: (err as Error).message });
    } finally {
      setIsPulling(false);
    }
  }

  const modeOptions: { value: PeriodMode; label: string }[] = [
    { value: 'lastWeek', label: t('timeLogs.pull.lastWeek') },
    { value: 'lastMonth', label: t('timeLogs.pull.lastMonth') },
    { value: 'custom', label: t('timeLogs.pull.custom') },
    { value: 'all', label: t('timeLogs.pull.allHistory') }
  ];

  const selectedCount = missingRows.filter((r) => r.selected && r.localName.trim() && r.typeName).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowDownToLine className="h-4 w-4" />
          {t('timeLogs.pull.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className={step === 'addTasks' ? 'sm:max-w-2xl' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'addTasks' ? (
              <>
                <Plus className="h-5 w-5" />
                {t('timeLogs.pull.addMissingTitle')}
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-5 w-5" />
                {t('timeLogs.pull.title')}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Config ─────────────────────────────────────────── */}
        {step === 'config' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('timeLogs.pull.subtitle')}</p>
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t('timeLogs.pull.periodLabel')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                      mode === opt.value
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    {opt.value === 'all' ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {opt.label}
                      </span>
                    ) : opt.value === 'custom' ? (
                      <span className="flex items-center gap-1.5">
                        <CalendarRange className="h-3.5 w-3.5" />
                        {opt.label}
                      </span>
                    ) : (
                      opt.label
                    )}
                  </button>
                ))}
              </div>
            </div>
            {mode === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pull-from" className="text-xs">
                    {t('timeLogs.pull.fromLabel')}
                  </Label>
                  <Input
                    id="pull-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pull-to" className="text-xs">
                    {t('timeLogs.pull.toLabel')}
                  </Label>
                  <Input
                    id="pull-to"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
            {mode === 'all' && (
              <p className="text-xs text-amber-700 dark:text-amber-400 rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2">
                {t('timeLogs.pull.allHistoryWarning')}
              </p>
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
          </div>
        )}

        {/* ── Step 2: Result ─────────────────────────────────────────── */}
        {step === 'result' && result && (
          <div className="space-y-4">
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

            {result.missingTwTaskIds.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-300">{t('timeLogs.pull.noTaskHint')}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  onClick={handleOpenAddTasks}
                  disabled={isPulling}
                >
                  <Plus className="h-4 w-4" />
                  {t('timeLogs.pull.addMissingTasks', { count: result.missingTwTaskIds.length })}
                </Button>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={resetState} disabled={isPulling}>
                {t('timeLogs.pull.pullAgain')}
              </Button>
              {result.imported > 0 && !isPulling && (
                <Button variant="outline" size="sm" onClick={handleReimport} disabled={isPulling} className="gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  {t('timeLogs.pull.reimport')}
                </Button>
              )}
              <Button size="sm" onClick={() => handleClose(false)}>
                {t('common.done')}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Add missing tasks ──────────────────────────────── */}
        {step === 'addTasks' && (
          <div className="space-y-4">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">{t('timeLogs.pull.loadingDetails')}</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t('timeLogs.pull.addMissingSubtitle')}</p>

                <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                  {missingRows.map((row, i) => (
                    <div
                      key={row.twTaskId}
                      className={`rounded-lg border p-3 space-y-2 transition-colors ${
                        row.selected ? 'border-border bg-card' : 'border-border/40 bg-muted/30 opacity-60'
                      }`}
                    >
                      {/* Header: TW info + toggle */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">{row.name}</p>
                          {row.parentName && (
                            <Badge variant="secondary" className="mt-0.5 text-xs gap-1 max-w-full truncate">
                              <Tag className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{row.parentName}</span>
                            </Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setMissingRows((prev) =>
                              prev.map((r, idx) => (idx === i ? { ...r, selected: !r.selected } : r))
                            )
                          }
                          className={`shrink-0 text-xs px-2 py-0.5 rounded border transition-colors ${
                            row.selected
                              ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                              : 'border-green-400/60 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'
                          }`}
                        >
                          {row.selected ? t('timeLogs.pull.skipTask') : t('timeLogs.pull.includeTask')}
                        </button>
                      </div>

                      {/* Editable fields */}
                      {row.selected && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">{t('timeLogs.pull.localName')}</Label>
                            <Input
                              value={row.localName}
                              onChange={(e) =>
                                setMissingRows((prev) =>
                                  prev.map((r, idx) => (idx === i ? { ...r, localName: e.target.value } : r))
                                )
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">{t('timeLogs.pull.typeLabel')}</Label>
                            <select
                              value={row.typeName}
                              onChange={(e) =>
                                setMissingRows((prev) =>
                                  prev.map((r, idx) => (idx === i ? { ...r, typeName: e.target.value } : r))
                                )
                              }
                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">{t('timeLogs.pull.selectType')}</option>
                              {typeList.map((tn) => (
                                <option key={tn} value={tn}>
                                  {tn}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => setStep('result')} disabled={savingTasks}>
                    {t('common.back')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveTasks}
                    disabled={savingTasks || selectedCount === 0}
                    className="gap-1.5"
                  >
                    {savingTasks ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('timeLogs.pull.savingTasks')}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        {t('timeLogs.pull.saveTasksBtn', { count: selectedCount })}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
