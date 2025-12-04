import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Column, Row, ColumnDef } from '@tanstack/react-table';
import { fetchTasks, addTask, editTask, deleteTask } from '../services/tasksService';
import fetchTypeTasks from '../services/typeTasksService';
import { Task } from '../../types/tasks';
import Select from '../components/ui/Select';
// import { TypeTasks } from '../../types/typeTasks';

function useTasks() {
  const { data, isPending: isLoading, error } = useQuery({
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
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const { mutate: onEdit } = useMutation({
    mutationFn: editTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Error updating task:', error);
    }
  });

  const { mutate: deleteTaskMutation } = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const handleDelete = (task: Task) => {
    if (task.id) {
      deleteTaskMutation(task.id);
    }
  };

  const { data: typeTasks } = useQuery({
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });

  // const taskTypes = queryClient.getQueryData<TypeTasks[]>(['typeTasks']);

  // const columns = originalColumns.map((column) => {
  //   if (column.type === 'select') {
  //     return {
  //       ...column,
  //       options: taskTypes?.map((type: TypeTasks) => ({
  //         value: type.typeName,
  //         label: type.typeName
  //       }))
  //     };
  //   }
  //   return column;
  // });
  console.log(data); // AQUI VOY

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
            header: () => 'Type Name',
            cell: ({ row }) => {
              if (!typeTasks) return row.original.typeName;
              return (
                <Select
                  options={typeTasks.map((tt: { typeName: string }) => ({
                    value: tt.typeName,
                    label: tt.typeName
                  }))}
                  value={{
                    value: row.original.typeName ?? '',
                    label: row.original.typeName ?? ''
                  }}
                  onChange={(selectedOption: { value: string; label: string } | null) =>
                    onEdit({ ...row.original, typeName: selectedOption?.value ?? '' })
                  }
                />
              );
            },
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Task) => row.taskLink,
            id: 'taskLink',
            header: () => 'Task Link',
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
                {
                  id: 'delete',
                  header: 'Delete',
                  cell: ({ row }: RowT) => <button onClick={() => handleDelete(row.original)}>Eliminar</button>
                }
              ]
            }
          ]
        : [])
    ],
    [isEditable, typeTasks]
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
    data,
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
