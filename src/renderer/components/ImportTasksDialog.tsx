import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, ArrowLeft, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useQuery } from '@tanstack/react-query';
import { addTask, editTask, fetchTasks, fetchTWSubtasks } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';
import type { Task } from '../../types/tasks';

// ─── Types ─────────────────────────────────────────────────────────────────

type Template = 'RECA_FORE' | 'OTHER';

interface PreviewTask {
  taskName: string;
  taskLink: string;
  found: boolean;
}

interface ConflictTask {
  twTaskId: string;
  existingTask: Task;
  incomingTask: PreviewTask;
  hasChanges: boolean;
}

// ─── Template definitions (mirrors backend) ────────────────────────────────

const TEMPLATE_LABELS: Record<Template, string> = {
  RECA_FORE: 'RECA / FORE (11 sub-tasks → 5 selected)',
  OTHER: 'Standard process (3 sub-tasks)'
};

const TEMPLATE_SUFFIXES: Record<Template, { pattern: RegExp; suffix: string }[]> = {
  RECA_FORE: [
    { pattern: /^2\./, suffix: '2. Estimación' },
    { pattern: /^3\./, suffix: '3. Implementación' },
    { pattern: /^4\./, suffix: '4. Calidad' },
    { pattern: /^5\./, suffix: '5. Bugs' },
    { pattern: /^10\./, suffix: '10. Despliegue' }
  ],
  OTHER: [
    { pattern: /^1\./, suffix: '1. Análisis' },
    { pattern: /^3\./, suffix: '3. Implementación' },
    { pattern: /^11\./, suffix: '11. Seguimiento' }
  ]
};

// ─── Component ─────────────────────────────────────────────────────────────

type Step = 'form' | 'preview' | 'resolve' | 'done';
type ConflictDecision = 'keep' | 'update';

const normalizeLink = (value: string | null | undefined) => (value ?? '').trim();

const extractTwTaskId = (taskLink: string | null | undefined): string | null => {
  if (!taskLink) return null;
  const match = taskLink.match(/\/tasks\/(\d+)/);
  return match ? match[1] : null;
};

function ImportTasksDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');

  // Form state
  const [parentLink, setParentLink] = useState('');
  const [prefix, setPrefix] = useState('');
  const [template, setTemplate] = useState<Template>('RECA_FORE');
  const [typeName, setTypeName] = useState('');

  // Preview state
  const [previewTasks, setPreviewTasks] = useState<PreviewTask[]>([]);
  const [rawSubtasks, setRawSubtasks] = useState<{ id: string; content: string; link: string }[]>([]);
  const [newTasks, setNewTasks] = useState<PreviewTask[]>([]);
  const [conflicts, setConflicts] = useState<ConflictTask[]>([]);
  const [alreadyLinkedCount, setAlreadyLinkedCount] = useState(0);
  const [conflictDecisions, setConflictDecisions] = useState<Record<number, ConflictDecision>>({});
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: typeTasksList = [] } = useQuery({
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });

  function resetDialog() {
    setStep('form');
    setParentLink('');
    setPrefix('');
    setTemplate('RECA_FORE');
    setTypeName('');
    setPreviewTasks([]);
    setRawSubtasks([]);
    setNewTasks([]);
    setConflicts([]);
    setAlreadyLinkedCount(0);
    setConflictDecisions({});
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) resetDialog();
    setOpen(isOpen);
  }

  async function handlePreview() {
    if (!parentLink.trim()) {
      toast.error(t('tasks.importTW.parentLinkRequired'));
      return;
    }
    if (!prefix.trim()) {
      toast.error(t('tasks.importTW.prefixRequired'));
      return;
    }
    if (!typeName) {
      toast.error(t('tasks.importTW.typeRequired'));
      return;
    }

    setFetchingPreview(true);
    try {
      const result = await fetchTWSubtasks(parentLink.trim());
      if (!result.success || !result.subtasks) {
        toast.error(t('tasks.importTW.fetchFailed'), { description: result.message });
        return;
      }

      setRawSubtasks(result.subtasks);

      const items = TEMPLATE_SUFFIXES[template];
      const tasks: PreviewTask[] = items.map((item) => {
        const match = result.subtasks!.find((s: { id: string; content: string; link: string }) =>
          item.pattern.test(s.content.trim())
        );
        return {
          taskName: `${prefix.trim()} ${item.suffix}`,
          taskLink: match?.link ?? '',
          found: !!match
        };
      });

      const existingTasks: Task[] = await fetchTasks();
      const existingByTwId = new Map<string, Task[]>();
      existingTasks.forEach((task) => {
        const twTaskId = extractTwTaskId(task.taskLink);
        if (!twTaskId) return;
        if (!existingByTwId.has(twTaskId)) existingByTwId.set(twTaskId, []);
        existingByTwId.get(twTaskId)!.push(task);
      });

      const conflictsFound: ConflictTask[] = [];
      const newTasksFound: PreviewTask[] = [];
      let existingExactMatches = 0;
      let duplicatesDetected = 0;

      tasks.forEach((task) => {
        if (!task.found) return;
        const twTaskId = extractTwTaskId(task.taskLink);
        if (!twTaskId) {
          newTasksFound.push(task);
          return;
        }

        const matches = existingByTwId.get(twTaskId);
        if (!matches || matches.length === 0) {
          newTasksFound.push(task);
          return;
        }

        if (matches.length > 1) duplicatesDetected += matches.length - 1;
        const existingTask = matches[0];
        const hasChanges =
          existingTask.taskName !== task.taskName ||
          normalizeLink(existingTask.taskLink) !== normalizeLink(task.taskLink) ||
          existingTask.typeName !== typeName;

        if (hasChanges) {
          conflictsFound.push({ twTaskId, existingTask, incomingTask: task, hasChanges });
        } else {
          existingExactMatches += 1;
        }
      });

      if (duplicatesDetected > 0) {
        toast.warning(t('tasks.importTW.duplicateLinksWarning', { count: duplicatesDetected }));
      }

      const decisions = conflictsFound.reduce<Record<number, ConflictDecision>>((acc, conflict) => {
        if (conflict.existingTask.id !== undefined) acc[conflict.existingTask.id] = 'keep';
        return acc;
      }, {});

      setPreviewTasks(tasks);
      setNewTasks(newTasksFound);
      setConflicts(conflictsFound);
      setAlreadyLinkedCount(existingExactMatches);
      setConflictDecisions(decisions);
      setStep('preview');
    } catch (err) {
      toast.error(t('tasks.importTW.fetchError'), { description: String(err) });
    } finally {
      setFetchingPreview(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      let createdCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (const task of newTasks) {
        if (!task.found) continue;
        try {
          await addTask({ typeName, taskName: task.taskName, taskLink: task.taskLink, description: '' });
          createdCount += 1;
        } catch (err) {
          errors.push(String(err));
        }
      }

      for (const conflict of conflicts) {
        const existingId = conflict.existingTask.id;
        if (existingId === undefined) continue;
        const decision = conflictDecisions[existingId] ?? 'keep';
        if (decision !== 'update') continue;
        try {
          await editTask({
            id: existingId,
            typeName,
            taskName: conflict.incomingTask.taskName,
            taskLink: conflict.incomingTask.taskLink,
            description: conflict.existingTask.description || ''
          });
          updatedCount += 1;
        } catch (err) {
          errors.push(String(err));
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      const skippedCount = alreadyLinkedCount + (conflicts.length - updatedCount);
      const totalChanged = createdCount + updatedCount;

      if (totalChanged === 0) {
        toast.info(t('tasks.importTW.noChanges'));
      } else {
        toast.success(t('tasks.importTW.importApplied'), {
          description: t('tasks.importTW.importAppliedDesc', {
            created: createdCount,
            updated: updatedCount,
            skipped: skippedCount
          })
        });
      }

      if (errors.length > 0) {
        toast.error(t('tasks.importTW.applyError', { count: errors.length }));
      }

      setStep('done');
    } catch (err) {
      toast.error(t('tasks.importTW.importError'), { description: String(err) });
    } finally {
      setImporting(false);
    }
  }

  const conflictsToResolve = useMemo(() => conflicts.filter((conflict) => conflict.hasChanges), [conflicts]);
  const foundCount = previewTasks.filter((t) => t.found).length;
  const importActionLabel = useMemo(() => {
    if (conflictsToResolve.length > 0) return t('tasks.importTW.reviewDuplicatesBtn');
    return t('tasks.importTW.importBtn', { count: foundCount });
  }, [conflictsToResolve.length, foundCount, t]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('tasks.importTW.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('tasks.importTW.title')}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Form ──────────────────────────────────── */}
        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentLink">{t('tasks.importTW.parentLinkLabel')}</Label>
              <Input
                id="parentLink"
                placeholder="https://yourcompany.teamwork.com/app/tasks/123456"
                value={parentLink}
                onChange={(e) => setParentLink(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">{t('tasks.importTW.prefixLabel')}</Label>
              <Input
                id="prefix"
                placeholder="e.g. RECA-001 or FORE-Proyecto X"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('tasks.importTW.prefixHint', { prefix: prefix || 'PREFIX' })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">{t('tasks.importTW.templateLabel')}</Label>
              <select
                id="template"
                value={template}
                onChange={(e) => setTemplate(e.target.value as Template)}
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(TEMPLATE_LABELS) as Template[]).map((key) => (
                  <option key={key} value={key}>
                    {TEMPLATE_LABELS[key]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {template === 'RECA_FORE'
                  ? t('tasks.importTW.templateHintRECA')
                  : t('tasks.importTW.templateHintOTHER')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="typeName">{t('tasks.importTW.typeLabel')}</Label>
              <select
                id="typeName"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t('tasks.importTW.selectType')}</option>
                {typeTasksList.map((ty) => (
                  <option key={ty.id} value={ty.typeName}>
                    {ty.typeName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handlePreview} disabled={fetchingPreview}>
                {fetchingPreview ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('tasks.importTW.fetchingSubtasks')}
                  </>
                ) : (
                  t('tasks.importTW.previewBtn')
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ───────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('tasks.importTW.foundOf', { found: foundCount, total: previewTasks.length })}
            </p>

            {alreadyLinkedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('tasks.importTW.alreadyLinkedCount', { count: alreadyLinkedCount })}
              </p>
            )}

            {conflictsToResolve.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {t('tasks.importTW.duplicatesFound', { count: conflictsToResolve.length })}
              </div>
            )}

            <ul className="divide-y divide-border rounded-md border overflow-hidden">
              {previewTasks.map((task, i) => (
                <li key={i} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  {task.found ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={task.found ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>
                      {task.taskName}
                    </p>
                    {task.found ? (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {task.taskLink}
                      </p>
                    ) : (
                      <p className="text-xs text-destructive">{t('tasks.importTW.subtaskNotFound')}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {foundCount === 0 && rawSubtasks.length > 0 && (
              <details className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <summary className="cursor-pointer text-xs font-medium text-amber-600 dark:text-amber-400">
                  TW returned {rawSubtasks.length} subtask{rawSubtasks.length !== 1 ? 's' : ''} — click to inspect
                </summary>
                <ul className="mt-2 space-y-1">
                  {rawSubtasks.map((s) => (
                    <li key={s.id} className="text-xs text-muted-foreground">
                      <span className="font-mono text-foreground">&quot;{s.content}&quot;</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Patterns expect names starting with e.g. <span className="font-mono">"2. "</span>,{' '}
                  <span className="font-mono">"3. "</span>, etc.
                </p>
              </details>
            )}

            {foundCount === 0 && rawSubtasks.length === 0 && (
              <p className="text-sm text-destructive text-center">
                No subtasks returned. Make sure the link points to the correct parent task.
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('form')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('tasks.importTW.backBtn')}
              </Button>
              <Button
                onClick={() => (conflictsToResolve.length > 0 ? setStep('resolve') : handleImport())}
                disabled={importing || foundCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('tasks.importTW.importingBtn')}
                  </>
                ) : (
                  importActionLabel
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Resolve duplicates ───────────────────── */}
        {step === 'resolve' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{t('tasks.importTW.resolveTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('tasks.importTW.resolveSubtitle')}</p>
            </div>

            <ul className="space-y-3">
              {conflictsToResolve.map((conflict) => {
                const existing = conflict.existingTask;
                const incoming = conflict.incomingTask;
                const diffs = [
                  existing.taskName !== incoming.taskName
                    ? {
                        label: t('tasks.importTW.fieldName'),
                        current: existing.taskName,
                        next: incoming.taskName
                      }
                    : null,
                  normalizeLink(existing.taskLink) !== normalizeLink(incoming.taskLink)
                    ? {
                        label: t('tasks.importTW.fieldLink'),
                        current: normalizeLink(existing.taskLink),
                        next: normalizeLink(incoming.taskLink)
                      }
                    : null,
                  existing.typeName !== typeName
                    ? {
                        label: t('tasks.importTW.fieldType'),
                        current: existing.typeName,
                        next: typeName
                      }
                    : null
                ].filter(Boolean) as { label: string; current: string; next: string }[];

                const decision = conflictDecisions[existing.id ?? -1] ?? 'keep';

                return (
                  <li key={`${existing.id}-${conflict.twTaskId}`} className="rounded-md border p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{incoming.taskName}</p>
                        <p className="text-xs text-muted-foreground truncate">{existing.taskName}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={decision === 'keep' ? 'default' : 'outline'}
                          onClick={() =>
                            existing.id !== undefined &&
                            setConflictDecisions((prev) => ({ ...prev, [existing.id!]: 'keep' }))
                          }
                        >
                          {t('tasks.importTW.keepExisting')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={decision === 'update' ? 'default' : 'outline'}
                          onClick={() =>
                            existing.id !== undefined &&
                            setConflictDecisions((prev) => ({ ...prev, [existing.id!]: 'update' }))
                          }
                        >
                          {t('tasks.importTW.updateExisting')}
                        </Button>
                      </div>
                    </div>
                    {diffs.length > 0 && (
                      <div className="mt-3 space-y-2 text-xs">
                        {diffs.map((diff) => (
                          <div key={diff.label} className="rounded-md bg-muted/50 px-2 py-1">
                            <p className="font-medium text-muted-foreground">{diff.label}</p>
                            <div className="mt-1 grid gap-1 sm:grid-cols-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">{t('tasks.importTW.currentLabel')}</p>
                                <p className="truncate">{diff.current}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">{t('tasks.importTW.newLabel')}</p>
                                <p className="truncate">{diff.next}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('preview')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('tasks.importTW.backBtn')}
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('tasks.importTW.importingBtn')}
                  </>
                ) : (
                  t('tasks.importTW.applyImportBtn')
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ──────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="font-semibold">{t('tasks.importTW.doneTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('tasks.importTW.doneSubtitle')}</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={resetDialog}>
                {t('tasks.importTW.importAnotherBtn')}
              </Button>
              <Button onClick={() => setOpen(false)}>{t('common.done')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportTasksDialog;
