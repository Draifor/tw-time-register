import React from 'react';
import TypeTasks from '../components/TypeTasks';
import Tasks from '../components/Tasks';
import TimeLogs from '../components/TimeLogs';

function TasksPage() {
  return (
    <div>
      <TypeTasks />
      <hr className="my-4" />
      <Tasks />
      <hr className="my-4" />
      <TimeLogs />
    </div>
  );
}

export default TasksPage;
