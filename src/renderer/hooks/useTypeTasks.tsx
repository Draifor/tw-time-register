import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import fetchTypeTasks, { addTypeTask, updateTypeTask, deleteTypeTask } from '../services/typeTasksService';
import { TypeTasks } from '../../types/typeTasks';
import DeleteButton from '../components/DeleteButton';
import { queryKeys } from '../lib/queryKeys';

function useTypeTasks() {
  const { t } = useTranslation();
  const {
    data = [],
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.typeTasks.all,
    queryFn: fetchTypeTasks
  });
  const queryClient = useQueryClient();

  const { mutate: onAdd } = useMutation({
    mutationFn: (typeName: string) => addTypeTask(typeName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typeTasks.all });
      toast.success(t('tasks.typeForm.addSuccess'));
    },
    onError: (err: Error) => toast.error(t('tasks.typeForm.addError'), { description: err.message })
  });

  const { mutate: onEdit } = useMutation({
    mutationFn: ({ id, typeName }: { id: number; typeName: string }) => updateTypeTask(id, typeName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typeTasks.all });
      toast.success(t('tasks.typeForm.updateSuccess'));
    },
    onError: (err: Error) => toast.error(t('tasks.typeForm.updateError'), { description: err.message })
  });

  const { mutate: onDelete } = useMutation({
    mutationFn: (id: number) => deleteTypeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typeTasks.all });
      toast.success(t('tasks.typeForm.deleteSuccess'));
    },
    onError: (err: Error) => toast.error(t('tasks.typeForm.deleteError'), { description: err.message })
  });

  const columns = useMemo<ColumnDef<TypeTasks>[]>(
    () => [
      {
        header: t('tasks.typesTableTitle'),
        columns: [
          {
            accessorKey: 'typeName',
            id: 'typeName',
            header: () => t('tasks.colName'),
            cell: ({ row, table }) => {
              const value = row.original.typeName;
              return (
                <input
                  key={value}
                  defaultValue={value}
                  className="w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 px-1 py-0.5 text-sm transition-colors"
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
            header: t('common.actions'),
            cell: ({ row }) => (
              <DeleteButton
                itemName={row.original.typeName || t('tasks.thisType')}
                onConfirm={() => row.original.id && onDelete(row.original.id)}
              />
            )
          }
        ]
      }
    ],
    [onEdit, onDelete, t]
  );

  const sortedData = useMemo(() => [...data].sort((a, b) => a.typeName.localeCompare(b.typeName)), [data]);

  return {
    data: sortedData,
    isLoading,
    error,
    columns,
    isEditable: true,
    onAdd
  };
}

export default useTypeTasks;
