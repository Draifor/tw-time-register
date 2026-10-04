import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { TableToolbar, TableToolbarSearch } from './ui/table-toolbar';

function TasksTable() {
  const { t } = useTranslation();

  // ── Server-side search state ───────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isEditable, error, columns, onEdit } = useTasks({ searchTerm: debouncedSearch });
  const queryClient = useQueryClient();

  // ── Add-task form state ────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [typeName, setTypeName] = useState('');
  const [taskLink, setTaskLink] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
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
    setEstimatedTime('');
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
      description: description.trim(),
      estimatedTime: estimatedTime.trim()
        ? (() => {
            const [h, m] = estimatedTime.trim().split(':').map(Number);
            return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
          })()
        : null
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
      <TableToolbar>
        <TableToolbarSearch
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('tasks.search')}
          showClear
          clearLabel={t('table.clearSearch')}
        />
        <p className="text-sm text-muted-foreground shrink-0">
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
      </TableToolbar>

      {/* ── Collapsible add form ───────────────────────────────────────────── */}
      {open && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                <Select
                  value={typeName}
                  onValueChange={(v) => {
                    setTypeName(v);
                    setTypeError(false);
                  }}
                >
                  <SelectTrigger id="new-task-type" className={typeError ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('tasks.form.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {typeTasksList.map((tt) => (
                      <SelectItem key={tt.id} value={tt.typeName}>
                        {tt.typeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Estimated time */}
              <div className="space-y-1">
                <Label htmlFor="new-task-estimated" className="text-xs">
                  {t('tasks.form.estimatedTimeLabel')}
                </Label>
                <Input
                  id="new-task-estimated"
                  placeholder={t('tasks.form.estimatedTimePlaceholder')}
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">{t('tasks.form.estimatedTimeHint')}</p>
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
        hideSearch
      />
    </div>
  );
}

export default TasksTable;
