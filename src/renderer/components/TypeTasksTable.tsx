import React from 'react';
import DataTable from './DataTable';
import useTypeTasks from '../hooks/useTypeTasks';
import { TypeTasks } from '../../types/typeTasks';

function TypeTasksTable() {
  const { data, isLoading, isEditable, error, columns, handleAddRow } = useTypeTasks();

  return (
    <DataTable
      title="Task Types"
      data={data}
      isLoading={isLoading}
      isEditable={isEditable}
      error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
      columns={columns}
      onAddRow={handleAddRow}
      onPersist={(row: TypeTasks) => row}
    />
  );
}

export default TypeTasksTable;
