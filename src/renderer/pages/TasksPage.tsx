import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, ListTodo, Clock } from 'lucide-react';
import TypeTasksTable from '../components/TypeTasksTable';
import TasksTable from '../components/TasksTable';
import TimeLogsTable from '../components/TimeLogsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

function TasksPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('tasks.pageTitle')}</h1>
        <p className="text-muted-foreground">{t('tasks.pageSubtitle')}</p>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tasks.tabTimeLogs')}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tasks.tabTasks')}</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tasks.tabTypes')}</span>
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
