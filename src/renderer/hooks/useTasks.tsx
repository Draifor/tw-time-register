import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Column, Row, ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchTasks, addTask, editTask, deleteTask } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';
import { Task } from '../../types/tasks';
import Select from '../components/ui/select-custom';
import DeleteButton from '../components/DeleteButton';
import PullTaskDialog from '../components/PullTaskDialog';
import TaskCommentDialog from '../components/TaskCommentDialog';
import { parseHHMMToMinutes, formatMinutesToHHMM } from '../lib/timeUtils';

// ── Inline editable task link cell ────────────────────────────────────────────
function TaskLinkCell({ task, onSave }: { task: Task; onSave: (updated: Task) => void }) {
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
          className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 text-xs focus:border-primary focus:outline-none"
          placeholder="https://..."
        />
        <button type="button" onClick={handleSave} className="text-green-600 hover:text-green-500">
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
          {taskId ? `#${taskId}` : 'Ver en TW'}
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
        title="Editar link"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Inline editable estimated time cell ───────────────────────────────────────
function EstimatedTimeCell({ task, onSave }: { task: Task; onSave: (updated: Task) => void }) {
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
          className="h-6 min-w-0 w-20 rounded border border-border bg-background px-1.5 text-xs focus:border-primary focus:outline-none"
          placeholder="HH:MM"
        />
        <button type="button" onClick={handleSave} className="text-green-600 hover:text-green-500">
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
        title="Editar tiempo estimado"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Progress cell (logged vs estimated) ───────────────────────────────────────
function ProgressCell({ task }: { task: Task }) {
  const estimated = task.estimatedTime ?? 0;
  const logged = task.totalLoggedMinutes ?? 0;

  if (!estimated) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const pct = Math.min(100, (logged / estimated) * 100);
  const isOver = logged > estimated;
  const isWarning = !isOver && pct >= 80;

  let barColor = 'bg-emerald-500';
  if (isOver) barColor = 'bg-red-500';
  else if (isWarning) barColor = 'bg-amber-500';

  return (
    <div className="space-y-1 min-w-[140px]">
      <div className="flex items-center justify-between text-xs">
        <span className={isOver ? 'text-red-600 font-medium' : isWarning ? 'text-amber-600' : 'text-emerald-600'}>
          {formatMinutesToHHMM(logged)} / {formatMinutesToHHMM(estimated)}
        </span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {isOver && <span className="text-[10px] text-red-500">Over time</span>}
      {!isOver && estimated - logged > 0 && (
        <span className="text-[10px] text-muted-foreground">Margin: {formatMinutesToHHMM(estimated - logged)}</span>
      )}
    </div>
  );
}

function useTasks({ searchTerm = '' }: { searchTerm?: string } = {}) {
  const {
    data,
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: ['tasks', searchTerm],
    queryFn: () => fetchTasks(searchTerm || undefined)
  });
  const queryClient = useQueryClient();

  const isEditable = true;

  const { mutate: onSubmit, isPending: isLoadingMutation } = useMutation({
    mutationFn: addTask,
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousTasks = queryClient.getQueryData(['tasks']);

      queryClient.setQueryData(['tasks'], (old: Task[] = []) => [...old, newTask]);

      return { previousTasks };
    },
    onError: (err, _variables, context) => {
      console.error(err);
      queryClient.setQueryData(['tasks'], context?.previousTasks);
      toast.error('Failed to add task', {
        description: err.message
      });
    },
    onSuccess: () => {
      toast.success('Task added successfully');
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const { mutate: onEdit } = useMutation({
    mutationFn: editTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Failed to update task', {
        description: error.message
      });
    }
  });

  const { mutate: deleteTaskMutation } = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete task', {
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
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });
  interface RowT {
    row: Row<Task>;
  }

  interface ColumnFooterProps {
    column: Column<Task, unknown>;
  }

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        header: 'Teamwork Tasks',
        footer: (props: ColumnFooterProps) => props.column.id,
        columns: [
          {
            accessorFn: (row: Task) => row.taskName,
            id: 'taskName',
            header: () => 'Task Name',
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.typeName,
            id: 'typeName',
            header: () => 'Task Type',
            cell: ({ row }) => {
              const isOrphan = !row.original.typeName;
              return (
                <div className="flex items-center gap-1.5">
                  {isOrphan && (
                    <span title="Sin tipo asignado">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    </span>
                  )}
                  {typeTasks ? (
                    <Select
                      options={typeTasks.map((tt: { typeName: string }) => ({
                        value: tt.typeName,
                        label: tt.typeName
                      }))}
                      value={
                        row.original.typeName ? { value: row.original.typeName, label: row.original.typeName } : null
                      }
                      placeholder="Asignar tipo…"
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
            header: () => 'Task Link',
            cell: ({ row }) => <TaskLinkCell task={row.original} onSave={onEdit} />,
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.description,
            id: 'description',
            header: () => 'Description',
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.estimatedTime,
            id: 'estimatedTime',
            header: () => 'Est. Time',
            cell: ({ row }) => <EstimatedTimeCell task={row.original} onSave={onEdit} />,
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.totalLoggedMinutes,
            id: 'progress',
            header: () => 'Progress',
            cell: ({ row }) => <ProgressCell task={row.original} />,
            footer: (props: ColumnFooterProps) => props.column.id
          }
        ]
      },
      ...(isEditable
        ? [
            {
              header: 'Actions',
              footer: (props: ColumnFooterProps) => props.column.id,
              columns: [
                { id: 'pull', header: 'Sync', cell: ({ row }: RowT) => <PullTaskDialog task={row.original} /> },
                {
                  id: 'comment',
                  header: 'Comment',
                  cell: ({ row }: RowT) => {
                    const task = row.original;
                    const twId = task.taskLink?.match(/\/tasks\/(\d+)/)?.[1];
                    return twId ? <TaskCommentDialog twTaskId={twId} taskName={task.taskName || ''} /> : null;
                  }
                },
                {
                  id: 'delete',
                  header: 'Delete',
                  cell: ({ row }: RowT) => (
                    <DeleteButton
                      itemName={row.original.taskName || 'this task'}
                      onConfirm={() => handleDelete(row.original)}
                    />
                  )
                }
              ]
            }
          ]
        : [])
    ],
    [isEditable, typeTasks, handleDelete, onEdit]
  );

  function handleAddRow() {
    onSubmit({
      taskName: '',
      typeName: 'RECA',
      taskLink: '',
      description: ''
    });
  }

  return {
    data: useMemo(
      () =>
        [...(data ?? [])].sort((a, b) => a.typeName.localeCompare(b.typeName) || a.taskName.localeCompare(b.taskName)),
      [data]
    ),
    isLoading,
    error,
    columns,
    onSubmit,
    isLoadingMutation,
    onEdit,
    onDelete: handleDelete,
    isEditable,
    handleAddRow
  };
}

export default useTasks;
