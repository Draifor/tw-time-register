import React from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from './DataTable';
import ImportTasksDialog from './ImportTasksDialog';
import ImportCSVTasksDialog from './ImportCSVTasksDialog';
import useTasks from '../hooks/useTasks';
import { Task } from '../../types/tasks';

function TasksTable() {
  const { t } = useTranslation();
  const { data, isLoading, isEditable, error, columns, handleAddRow, onEdit } = useTasks();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data && data.length > 0 ? t('tasks.taskCount', { count: data.length }) : t('tasks.noTasks')}
        </p>
        <div className="flex items-center gap-2">
          <ImportCSVTasksDialog />
          <ImportTasksDialog />
        </div>
      </div>
      <DataTable
        title={t('tasks.tableTitle')}
        data={data}
        isLoading={isLoading}
        isEditable={isEditable}
        error={error ? { message: String((error as Error)?.message) || t('common.errorOccurred') } : null}
        columns={columns}
        onAddRow={handleAddRow}
        onPersist={(row: Task) => onEdit(row)}
      />
    </div>
  );
}

export default TasksTable;
