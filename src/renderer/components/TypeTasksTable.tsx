import React from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from './DataTable';
import useTypeTasks from '../hooks/useTypeTasks';
import { TypeTasks } from '../../types/typeTasks';

function TypeTasksTable() {
  const { t } = useTranslation();
  const { data, isLoading, isEditable, error, columns, handleAddRow } = useTypeTasks();

  return (
    <DataTable
      title={t('tasks.typesTableTitle')}
      data={data}
      isLoading={isLoading}
      isEditable={isEditable}
      error={error ? { message: String((error as Error)?.message) || t('common.errorOccurred') } : null}
      columns={columns}
      onAddRow={handleAddRow}
      onPersist={(row: TypeTasks) => row}
    />
  );
}

export default TypeTasksTable;
