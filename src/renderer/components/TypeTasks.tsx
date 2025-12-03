import React from 'react';
import { useQuery } from '@tanstack/react-query';
import fetchTypeTasks from '../services/typeTasksService';
import { columns } from '../../types/typeTasks';
import DataTable from './DataTable';

function TypeTasksTable() {
  const { data, isLoading, error } = useQuery(['typeTasks'], fetchTypeTasks);
  return (
    <div>
      <DataTable
        data={data}
        isLoading={isLoading}
        error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
        columns={columns}
      />
    </div>
  );
}

export default TypeTasksTable;
