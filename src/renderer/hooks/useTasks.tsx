import React, { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Column, Row, ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { fetchTasks, addTask, editTask, deleteTask } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';
import { Task } from '../../types/tasks';
import Select from '../components/ui/select-custom';
import DeleteButton from '../components/DeleteButton';
import PullTaskDialog from '../components/PullTaskDialog';

function useTasks() {
  const {
    data,
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks
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
            cell: ({ row }) => {
              const link = row.original.taskLink;
              if (!link) return <span className="text-muted-foreground text-xs">—</span>;
              const taskId = link.match(/\/tasks\/(\d+)/)?.[1];
              return (
                <button
                  type="button"
                  onClick={() => window.Main.openExternal(link)}
                  title={link}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {taskId ? `#${taskId}` : 'Ver en TW'}
                </button>
              );
            },
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.description,
            id: 'description',
            header: () => 'Description',
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
