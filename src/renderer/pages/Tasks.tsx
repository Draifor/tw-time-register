import React from 'react';
import TypeTasks from '../components/TypeTasks';
import Tasks from '../components/Tasks';

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
