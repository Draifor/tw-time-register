import React from 'react';
import TypeTasksTable from '../components/TypeTasksTable';
import TasksTable from '../components/TasksTable';
import TimeLogsTable from '../components/TimeLogsTable';

function TasksPage() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
      <p className="text-muted-foreground">Manage your task types, TeamWork tasks, and time logs.</p>

      <div className="grid gap-6">
        <TypeTasksTable />
        <TasksTable />
        <TimeLogsTable />
      </div>
    </div>
  );
}

export default TasksPage;
