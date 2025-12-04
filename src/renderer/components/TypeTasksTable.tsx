import React from 'react';
import DataTable from './DataTable';
import useTypeTasks from '../hooks/useTypeTasks';

function TypeTasksTable() {
  const { data, isLoading, error, columns } = useTypeTasks();

  return (
    <DataTable
      title="Task Types"
      data={data}
      isLoading={isLoading}
      error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
      columns={columns}
    />
  );
}

export default TypeTasksTable;
