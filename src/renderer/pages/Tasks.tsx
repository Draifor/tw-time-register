import React from 'react';
import TypeTasks from '../hooks/TypeTasks';
import Tasks from '../hooks/Tasks';

function TasksPage() {
  return (
    <div>
      <TypeTasks />
      <hr />
      <Tasks />
    </div>
  );
}

export default TasksPage;
