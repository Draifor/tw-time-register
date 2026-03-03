import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, ArrowLeft, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useQuery } from '@tanstack/react-query';
import { fetchTWSubtasks, importTasksFromTW } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';

// ─── Types ─────────────────────────────────────────────────────────────────

type Template = 'RECA_FORE' | 'OTHER';

interface PreviewTask {
  taskName: string;
  taskLink: string;
  found: boolean;
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

type Step = 'form' | 'preview' | 'done';

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

      setPreviewTasks(tasks);
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
      const result = await importTasksFromTW({
        parentTaskLink: parentLink.trim(),
        prefix: prefix.trim(),
        template,
        typeName
      });

      if (!result.success) {
        toast.error(t('tasks.importTW.importFailed'), { description: result.message });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      const importedCount = result.imported?.length ?? 0;
      const notFoundCount = result.notFound?.length ?? 0;

      if (notFoundCount > 0) {
        toast.warning(t('tasks.importTW.importedCount', { count: importedCount }), {
          description: t('tasks.importTW.notFoundDesc', { names: result.notFound?.join(', ') })
        });
      } else {
        toast.success(t('tasks.importTW.importSuccessCount', { count: importedCount }));
      }

      setStep('done');
    } catch (err) {
      toast.error(t('tasks.importTW.importError'), { description: String(err) });
    } finally {
      setImporting(false);
    }
  }

  const foundCount = previewTasks.filter((t) => t.found).length;

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
              <Button onClick={handleImport} disabled={importing || foundCount === 0}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('tasks.importTW.importingBtn')}
                  </>
                ) : (
                  t('tasks.importTW.importBtn', { count: foundCount })
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
