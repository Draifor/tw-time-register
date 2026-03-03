import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Plus, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DataTable from './DataTable';
import ImportTasksDialog from './ImportTasksDialog';
import ImportCSVTasksDialog from './ImportCSVTasksDialog';
import useTasks from '../hooks/useTasks';
import { Task } from '../../types/tasks';
import { addTask } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';

function TasksTable() {
  const { t } = useTranslation();
  const { data, isLoading, isEditable, error, columns, onEdit } = useTasks();
  const queryClient = useQueryClient();

  // ── Add-task form state ────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [typeName, setTypeName] = useState('');
  const [taskLink, setTaskLink] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState(false);
  const [typeError, setTypeError] = useState(false);

  const { data: typeTasksList = [] } = useQuery({
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });

  function resetForm() {
    setTaskName('');
    setTypeName('');
    setTaskLink('');
    setDescription('');
    setNameError(false);
    setTypeError(false);
  }

  const { mutate: submitAdd, isPending } = useMutation({
    mutationFn: (task: Task) => addTask(task),
    onSuccess: () => {
      toast.success(t('tasks.form.addSuccess'));
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(t('tasks.form.addError'), { description: err.message });
    }
  });

  function handleSubmit() {
    const nErr = !taskName.trim();
    const tErr = !typeName;
    setNameError(nErr);
    setTypeError(tErr);
    if (nErr || tErr) return;

    submitAdd({
      taskName: taskName.trim(),
      typeName,
      taskLink: taskLink.trim(),
      description: description.trim()
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setOpen(false);
      resetForm();
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data && data.length > 0 ? t('tasks.taskCount', { count: data.length }) : t('tasks.noTasks')}
        </p>
        <div className="flex items-center gap-2">
          <ImportCSVTasksDialog />
          <ImportTasksDialog />
          <Button
            variant={open ? 'secondary' : 'default'}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setOpen(!open);
              if (open) resetForm();
            }}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t('tasks.form.addTaskBtn')}
          </Button>
        </div>
      </div>

      {/* ── Collapsible add form ───────────────────────────────────────────── */}
      {open && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Task name */}
              <div className="space-y-1">
                <Label htmlFor="new-task-name" className="text-xs">
                  {t('tasks.form.taskNameLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-task-name"
                  placeholder={t('tasks.form.taskNamePlaceholder')}
                  value={taskName}
                  onChange={(e) => {
                    setTaskName(e.target.value);
                    setNameError(false);
                  }}
                  className={nameError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  autoFocus
                />
                {nameError && <p className="text-xs text-destructive">{t('tasks.form.nameRequired')}</p>}
              </div>

              {/* Task type */}
              <div className="space-y-1">
                <Label htmlFor="new-task-type" className="text-xs">
                  {t('tasks.form.typeLabel')} <span className="text-destructive">*</span>
                </Label>
                <select
                  id="new-task-type"
                  value={typeName}
                  onChange={(e) => {
                    setTypeName(e.target.value);
                    setTypeError(false);
                  }}
                  className={`flex h-9 w-full rounded-md border bg-background text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${typeError ? 'border-destructive' : 'border-input'}`}
                >
                  <option value="">{t('tasks.form.selectType')}</option>
                  {typeTasksList.map((tt) => (
                    <option key={tt.id} value={tt.typeName}>
                      {tt.typeName}
                    </option>
                  ))}
                </select>
                {typeError && <p className="text-xs text-destructive">{t('tasks.form.typeRequired')}</p>}
              </div>

              {/* Task link */}
              <div className="space-y-1">
                <Label htmlFor="new-task-link" className="text-xs">
                  {t('tasks.form.taskLinkLabel')}
                </Label>
                <Input
                  id="new-task-link"
                  placeholder={t('tasks.form.taskLinkPlaceholder')}
                  value={taskLink}
                  onChange={(e) => setTaskLink(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label htmlFor="new-task-desc" className="text-xs">
                  {t('tasks.form.descriptionLabel')}
                </Label>
                <Input
                  id="new-task-desc"
                  placeholder={t('tasks.form.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isPending ? t('common.saving') : t('tasks.form.submitBtn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <DataTable
        title={t('tasks.tableTitle')}
        data={data}
        isLoading={isLoading}
        isEditable={isEditable}
        error={error ? { message: String((error as Error)?.message) || t('common.errorOccurred') } : null}
        columns={columns}
        onPersist={(row: Task) => onEdit(row)}
      />
    </div>
  );
}

export default TasksTable;
