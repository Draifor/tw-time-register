import React from 'react';
import DataTable from './DataTableNew';
import useTasks from '../hooks/useTasks';

function TasksTable() {
  const { data, isLoading, isEditable, error, onSubmit, columns, onEdit, onDelete, handleAddRow } = useTasks();

  return (
    <div>
      <DataTable
        data={data}
        isLoading={isLoading}
        isEditable={isEditable}
        error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
        columns={columns}
        formFunction={onSubmit}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddRow={handleAddRow}
      />
    </div>
  );
}

export default TasksTable;
