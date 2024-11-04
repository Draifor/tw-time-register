import React from 'react';
import { useQuery } from '@tanstack/react-query';
import fetchTypeTasks from '../services/typeTasksService';
import { columns } from '../../types/typeTasks';
import DataTable from '../components/DataTable';

function TasksTable() {
  const { data, isLoading, error } = useQuery(['typeTasks'], fetchTypeTasks);
  return (
    <div>
      <DataTable data={data} isLoading={isLoading} error={error} columns={columns} />
    </div>
  );
}

export default TasksTable;
