import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import fetchTypeTasks from '../services/typeTasksService';
import { TypeTasks } from '../../types/typeTasks';
import DataTable from './DataTable';

const columns: ColumnDef<TypeTasks>[] = [
  {
    header: 'Type Task',
    accessorKey: 'typeName'
  }
];

function TypeTasksTable() {
  const { data, isPending: isLoading, error } = useQuery({
    queryKey: ['typeTasks'],
    queryFn: fetchTypeTasks
  });
  return (
    <div>
      <DataTable
        data={data || []}
        isLoading={isLoading}
        error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
        columns={columns}
      />
    </div>
  );
}

export default TypeTasksTable;
