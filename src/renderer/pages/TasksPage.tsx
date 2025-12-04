import React from 'react';
import TypeTasksTable from '../components/TypeTasksTable';
import TasksTable from '../components/TasksTable';
import TimeLogsTable from '../components/TimeLogsTable';

function TasksPage() {
  return (
    <div>
      <TypeTasksTable />
      <hr className="my-4" />
      <TasksTable />
      <hr className="my-4" />
      <TimeLogsTable />
    </div>
  );
}

export default TasksPage;
