import React from 'react';
import DataTable from './DataTable';
import useTypeTasks from '../hooks/useTypeTasks';

function TypeTasksTable() {
  const { data, isLoading, error, columns } = useTypeTasks();

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
