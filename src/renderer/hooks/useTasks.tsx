import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Column, Row, ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchTasks, editTask, deleteTask } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';
import { Task } from '../../types/tasks';
import Select from '../components/ui/select-custom';
import DeleteButton from '../components/DeleteButton';
import PullTaskDialog from '../components/PullTaskDialog';
import TaskCommentDialog from '../components/TaskCommentDialog';
import { parseHHMMToMinutes, formatMinutesToHHMM } from '../lib/timeUtils';
import { queryKeys } from '../lib/queryKeys';

// ── Inline editable task link cell ────────────────────────────────────────────
function TaskLinkCell({ task, onSave }: { task: Task; onSave: (updated: Task) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.taskLink ?? '');

  function handleSave() {
    onSave({ ...task, taskLink: value.trim() });
    setEditing(false);
  }

  function handleCancel() {
    setValue(task.taskLink ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 text-xs focus:border-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder={t('tasks.linkPlaceholder')}
        />
        <button type="button" onClick={handleSave} className="text-success hover:text-success/80">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const link = task.taskLink;
  const taskId = link?.match(/\/tasks\/(\d+)/)?.[1];

  return (
    <div className="flex items-center gap-1 group">
      {link ? (
        <button
          type="button"
          onClick={() => window.Main.openExternal(link)}
          title={link}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {taskId ? `#${taskId}` : t('tasks.viewInTW')}
        </button>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
      <button
        type="button"
        onClick={() => {
          setValue(task.taskLink ?? '');
          setEditing(true);
        }}
        title={t('tasks.editLink')}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Inline editable estimated time cell ───────────────────────────────────────
function EstimatedTimeCell({ task, onSave }: { task: Task; onSave: (updated: Task) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(formatMinutesToHHMM(task.estimatedTime ?? 0));

  function handleSave() {
    const minutes = parseHHMMToMinutes(value.trim());
    onSave({ ...task, estimatedTime: minutes > 0 ? minutes : null });
    setEditing(false);
  }

  function handleCancel() {
    setValue(formatMinutesToHHMM(task.estimatedTime ?? 0));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="h-6 min-w-0 w-20 rounded border border-border bg-background px-1.5 text-xs focus:border-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder={t('tasks.timePlaceholder')}
        />
        <button type="button" onClick={handleSave} className="text-success hover:text-success/80">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="text-xs text-muted-foreground">
        {task.estimatedTime ? formatMinutesToHHMM(task.estimatedTime) : '—'}
      </span>
      <button
        type="button"
        onClick={() => {
          setValue(formatMinutesToHHMM(task.estimatedTime ?? 0));
          setEditing(true);
        }}
        title={t('tasks.editEstimatedTime')}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Progress cell (logged vs estimated) ───────────────────────────────────────
function ProgressCell({ task }: { task: Task }) {
  const { t } = useTranslation();
  const estimated = task.estimatedTime ?? 0;
  const logged = task.totalLoggedMinutes ?? 0;

  if (!estimated) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const pct = Math.min(100, (logged / estimated) * 100);
  const isOver = logged > estimated;
  const isWarning = !isOver && pct >= 80;

  let barColor = 'bg-success';
  if (isOver) barColor = 'bg-destructive';
  else if (isWarning) barColor = 'bg-warning';

  return (
    <div className="space-y-1 min-w-[140px]">
      <div className="flex items-center justify-between text-xs">
        <span className={isOver ? 'text-destructive font-medium' : isWarning ? 'text-warning' : 'text-success'}>
          {formatMinutesToHHMM(logged)} / {formatMinutesToHHMM(estimated)}
        </span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.round(Math.min(100, pct))}%` }} />
      </div>
      {isOver && <span className="text-[10px] text-destructive">{t('tasks.overTime')}</span>}
      {!isOver && estimated - logged > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {t('tasks.margin', { time: formatMinutesToHHMM(estimated - logged) })}
        </span>
      )}
    </div>
  );
}

function useTasks({ searchTerm = '' }: { searchTerm?: string } = {}) {
  const { t } = useTranslation();
  const {
    data,
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.tasks.list(searchTerm),
    queryFn: () => fetchTasks(searchTerm || undefined)
  });
  const queryClient = useQueryClient();

  const isEditable = true;

  const { mutate: onEdit } = useMutation({
    mutationFn: editTask,
    onMutate: async (updatedTask) => {
      // Cancel in-flight reads, snapshot every cached `tasks` search variant, then
      // replace the edited task in place so the inline edit is reflected before the
      // server responds.
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });

      const previousTasks = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.tasks.all });

      queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old) =>
        old ? old.map((task) => (task.id === updatedTask.id ? updatedTask : task)) : old
      );

      return { previousTasks };
    },
    onError: (error, _variables, context) => {
      console.error('Error updating task:', error);
      for (const [key, data] of context?.previousTasks ?? []) {
        if (data !== undefined) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(t('tasks.updateError'), {
        description: error.message
      });
    },
    onSuccess: () => {
      toast.success(t('tasks.updateSuccess'));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });

  const { mutate: deleteTaskMutation } = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success(t('tasks.deleteSuccess'));
    },
    onError: (error) => {
      toast.error(t('tasks.deleteError'), {
        description: error.message
      });
    }
  });

  const handleDelete = useCallback(
    (task: Task) => {
      if (task.id) {
        deleteTaskMutation(task.id);
      }
    },
    [deleteTaskMutation]
  );

  const { data: typeTasks } = useQuery({
    queryKey: queryKeys.typeTasks.all,
    queryFn: fetchTypeTasks
  });
  // Hoisted out of the typeName cell so the option objects are built once per
  // `typeTasks` change instead of on every cell render.
  const typeOptions = useMemo(
    () => (typeTasks ?? []).map((tt: { typeName: string }) => ({ value: tt.typeName, label: tt.typeName })),
    [typeTasks]
  );
  interface RowT {
    row: Row<Task>;
  }

  interface ColumnFooterProps {
    column: Column<Task, unknown>;
  }

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        header: t('tasks.tableTitle'),
        footer: (props: ColumnFooterProps) => props.column.id,
        columns: [
          {
            accessorFn: (row: Task) => row.taskName,
            id: 'taskName',
            header: () => t('tasks.colTaskName'),
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.typeName,
            id: 'typeName',
            header: () => t('tasks.colTaskType'),
            cell: ({ row }) => {
              const isOrphan = !row.original.typeName;
              return (
                <div className="flex items-center gap-1.5">
                  {isOrphan && (
                    <span title={t('tasks.noTypeAssigned')}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                    </span>
                  )}
                  {typeTasks ? (
                    <Select
                      options={typeOptions}
                      value={
                        row.original.typeName ? { value: row.original.typeName, label: row.original.typeName } : null
                      }
                      placeholder={t('tasks.assignType')}
                      onChange={(selectedOption: { value: string; label: string } | null) =>
                        onEdit({ ...row.original, typeName: selectedOption?.value ?? '' })
                      }
                    />
                  ) : (
                    row.original.typeName || '—'
                  )}
                </div>
              );
            },
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.taskLink,
            id: 'taskLink',
            header: () => t('tasks.colTaskLink'),
            cell: ({ row }) => <TaskLinkCell task={row.original} onSave={onEdit} />,
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.description,
            id: 'description',
            header: () => t('common.description'),
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.estimatedTime,
            id: 'estimatedTime',
            header: () => t('tasks.colEstimatedTime'),
            cell: ({ row }) => <EstimatedTimeCell task={row.original} onSave={onEdit} />,
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.totalLoggedMinutes,
            id: 'progress',
            header: () => t('tasks.colProgress'),
            cell: ({ row }) => <ProgressCell task={row.original} />,
            footer: (props: ColumnFooterProps) => props.column.id
          }
        ]
      },
      ...(isEditable
        ? [
            {
              header: t('common.actions'),
              footer: (props: ColumnFooterProps) => props.column.id,
              columns: [
                {
                  id: 'pull',
                  header: t('tasks.colSync'),
                  cell: ({ row }: RowT) => <PullTaskDialog task={row.original} />
                },
                {
                  id: 'comment',
                  header: t('tasks.colComment'),
                  cell: ({ row }: RowT) => {
                    const task = row.original;
                    const twId = task.taskLink?.match(/\/tasks\/(\d+)/)?.[1];
                    return twId ? <TaskCommentDialog twTaskId={twId} taskName={task.taskName || ''} /> : null;
                  }
                },
                {
                  id: 'delete',
                  header: t('common.delete'),
                  cell: ({ row }: RowT) => (
                    <DeleteButton
                      itemName={row.original.taskName || t('tasks.thisTask')}
                      onConfirm={() => handleDelete(row.original)}
                    />
                  )
                }
              ]
            }
          ]
        : [])
    ],
    [isEditable, typeTasks, typeOptions, handleDelete, onEdit, t]
  );

  return {
    data: useMemo(
      () =>
        [...(data ?? [])].sort((a, b) => a.typeName.localeCompare(b.typeName) || a.taskName.localeCompare(b.taskName)),
      [data]
    ),
    isLoading,
    error,
    columns,
    onEdit,
    isEditable
  };
}

export default useTasks;
