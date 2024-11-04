import React from 'react';
import { useQuery } from '@tanstack/react-query';
import fetchTasks from '../services/tasksService';
import { columns } from '../../types/tasks';
import DataTable from '../components/DataTable';

function TasksTable() {
  const { data, isLoading, error } = useQuery(['tasks'], fetchTasks);
  return (
    <div>
      <DataTable data={data} isLoading={isLoading} error={error} columns={columns} />
    </div>
  );
}

export default TasksTable;
