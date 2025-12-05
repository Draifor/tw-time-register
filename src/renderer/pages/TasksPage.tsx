import React from 'react';
import { FolderKanban, ListTodo, Clock } from 'lucide-react';
import TypeTasksTable from '../components/TypeTasksTable';
import TasksTable from '../components/TasksTable';
import TimeLogsTable from '../components/TimeLogsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
        <p className="text-muted-foreground">Manage your task types, TeamWork tasks, and time logs.</p>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Time Logs</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            <span className="hidden sm:inline">Types</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="types">
          <TypeTasksTable />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTable />
        </TabsContent>
        <TabsContent value="logs">
          <TimeLogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TasksPage;
