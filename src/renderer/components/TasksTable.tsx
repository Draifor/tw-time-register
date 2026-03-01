import React from 'react';
import DataTable from './DataTable';
import ImportTasksDialog from './ImportTasksDialog';
import useTasks from '../hooks/useTasks';
import { Task } from '../../types/tasks';

function TasksTable() {
  const { data, isLoading, isEditable, error, columns, handleAddRow, onEdit } = useTasks();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.length > 0 ? `${data.length} task${data.length !== 1 ? 's' : ''}` : 'No tasks yet'}
        </p>
        <ImportTasksDialog />
      </div>
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
    </div>
  );
}

export default TasksTable;
