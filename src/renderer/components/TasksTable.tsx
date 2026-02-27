import React from 'react';
import DataTable from './DataTable';
import useTasks from '../hooks/useTasks';
import { Task } from '../../types/tasks';

function TasksTable() {
  const { data, isLoading, isEditable, error, columns, handleAddRow, onEdit } = useTasks();

  return (
    <DataTable
      title="TeamWork Tasks"
      data={data}
      isLoading={isLoading}
      isEditable={isEditable}
      error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
      columns={columns}
      onAddRow={handleAddRow}
      onPersist={(row: Task) => onEdit(row)}
    />
  );
}

export default TasksTable;
