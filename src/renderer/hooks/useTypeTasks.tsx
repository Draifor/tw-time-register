import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import fetchTypeTasks from '../services/typeTasksService';
import { TypeTasks } from '../../types/typeTasks';

function useTypeTasks() {
  const {
    data = [],
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });

  const columns = useMemo<ColumnDef<TypeTasks>[]>(
    () => [
      {
        header: 'Type Task',
        accessorKey: 'typeName'
      }
    ],
    []
  );

  return {
    data,
    isLoading,
    error,
    columns
  };
}

export default useTypeTasks;
