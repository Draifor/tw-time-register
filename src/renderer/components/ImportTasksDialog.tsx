import React, { useState } from 'react';
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
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const queryClient = useQueryClient();

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
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) resetDialog();
    setOpen(isOpen);
  }

  async function handlePreview() {
    if (!parentLink.trim()) {
      toast.error('Parent TW link is required');
      return;
    }
    if (!prefix.trim()) {
      toast.error('Prefix is required');
      return;
    }
    if (!typeName) {
      toast.error('Task type is required');
      return;
    }

    setFetchingPreview(true);
    try {
      const result = await fetchTWSubtasks(parentLink.trim());
      if (!result.success || !result.subtasks) {
        toast.error('Failed to fetch subtasks', { description: result.message });
        return;
      }

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
      toast.error('Error fetching subtasks', { description: String(err) });
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
        toast.error('Import failed', { description: result.message });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      const importedCount = result.imported?.length ?? 0;
      const notFoundCount = result.notFound?.length ?? 0;

      if (notFoundCount > 0) {
        toast.warning(`Imported ${importedCount} tasks`, {
          description: `Could not find: ${result.notFound?.join(', ')}`
        });
      } else {
        toast.success(`${importedCount} tasks imported successfully!`);
      }

      setStep('done');
    } catch (err) {
      toast.error('Import error', { description: String(err) });
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
          Import from TW
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Tasks from TeamWork
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Form ──────────────────────────────────── */}
        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentLink">Parent task link (TW URL)</Label>
              <Input
                id="parentLink"
                placeholder="https://yourcompany.teamwork.com/app/tasks/123456"
                value={parentLink}
                onChange={(e) => setParentLink(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                placeholder="e.g. RECA-001 or FORE-Proyecto X"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Will be prepended to each task name (e.g. &ldquo;{prefix || 'PREFIX'} 2. Estimación&rdquo;)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Process template</Label>
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
                  ? 'Will import: 2. Estimación · 3. Implementación · 4. Calidad · 5. Bugs · 10. Despliegue'
                  : 'Will import: 1. Análisis · 3. Implementación · 11. Seguimiento'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="typeName">Task type</Label>
              <select
                id="typeName"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a type...</option>
                {typeTasksList.map((t) => (
                  <option key={t.id} value={t.typeName}>
                    {t.typeName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handlePreview} disabled={fetchingPreview}>
                {fetchingPreview ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching subtasks...
                  </>
                ) : (
                  'Preview →'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ───────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found <span className="font-medium text-foreground">{foundCount}</span> of {previewTasks.length} expected
              subtasks. Review and confirm import.
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
                      <p className="text-xs text-destructive">Subtask not found in TW</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {foundCount === 0 && (
              <p className="text-sm text-destructive text-center">
                No matching subtasks found. Make sure the link points to the correct parent task.
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('form')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || foundCount === 0}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${foundCount} task${foundCount !== 1 ? 's' : ''}`
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
              <p className="font-semibold">Import complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                The tasks have been saved and are now available in the task selector.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={resetDialog}>
                Import another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportTasksDialog;
