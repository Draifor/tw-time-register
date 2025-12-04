import React from 'react';
import DataTable from './DataTable';
import useTasks from '../hooks/useTasks';

function TasksTable() {
  const { data, isLoading, isEditable, error, columns, handleAddRow } = useTasks();

  return (
    <DataTable
      title="TeamWork Tasks"
      data={data}
      isLoading={isLoading}
      isEditable={isEditable}
      error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
      columns={columns}
      onAddRow={handleAddRow}
    />
  );
}

export default TasksTable;
