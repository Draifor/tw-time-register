import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import fetchTypeTasks, { addTypeTask, updateTypeTask, deleteTypeTask } from '../services/typeTasksService';
import { TypeTasks } from '../../types/typeTasks';
import DeleteButton from '../components/DeleteButton';

function useTypeTasks() {
  const {
    data = [],
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });
  const queryClient = useQueryClient();

  const { mutate: onAdd } = useMutation({
    mutationFn: (typeName: string) => addTypeTask(typeName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['typeTasks'] });
      toast.success('Type added successfully');
    },
    onError: (err: Error) => toast.error('Failed to add type', { description: err.message })
  });

  const { mutate: onEdit } = useMutation({
    mutationFn: ({ id, typeName }: { id: number; typeName: string }) => updateTypeTask(id, typeName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['typeTasks'] });
      toast.success('Type updated successfully');
    },
    onError: (err: Error) => toast.error('Failed to update type', { description: err.message })
  });

  const { mutate: onDelete } = useMutation({
    mutationFn: (id: number) => deleteTypeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['typeTasks'] });
      toast.success('Type deleted successfully');
    },
    onError: (err: Error) => toast.error('Failed to delete type', { description: err.message })
  });

  const columns = useMemo<ColumnDef<TypeTasks>[]>(
    () => [
      {
        header: 'Task Types',
        columns: [
          {
            accessorKey: 'typeName',
            id: 'typeName',
            header: () => 'Name',
            cell: ({ row, table }) => {
              const value = row.original.typeName;
              return (
                <input
                  defaultValue={value}
                  className="w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 text-sm transition-colors"
                  onBlur={(e) => {
                    const newVal = e.target.value.trim();
                    if (newVal && newVal !== value && row.original.id) {
                      onEdit({ id: row.original.id, typeName: newVal });
                    } else if (!newVal) {
                      e.target.value = value;
                    }
                    table.options.meta?.updateData(row.index, 'typeName', newVal as never);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.currentTarget.value = value;
                      e.currentTarget.blur();
                    }
                  }}
                />
              );
            }
          },
          {
            id: 'delete',
            header: 'Actions',
            cell: ({ row }) => (
              <DeleteButton
                itemName={row.original.typeName || 'this type'}
                onConfirm={() => row.original.id && onDelete(row.original.id)}
              />
            )
          }
        ]
      }
    ],
    [onEdit, onDelete]
  );

  function handleAddRow() {
    onAdd('New Type');
  }

  return {
    data,
    isLoading,
    error,
    columns,
    isEditable: true,
    handleAddRow
  };
}

export default useTypeTasks;
