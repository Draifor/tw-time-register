import React from 'react';
import DataTable from './DataTable';
import useTasks from '../hooks/useTasks';

function TasksTable() {
  const { data, isLoading, error, onSubmit, columns, onEdit, onDelete } = useTasks();

  return (
    <div>
      <DataTable
        data={data}
        isLoading={isLoading}
        error={error as { message: string } | null}
        columns={columns}
        formFunction={onSubmit}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

export default TasksTable;
