import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, ListTodo } from 'lucide-react';
import TypeTasksTable from '../components/TypeTasksTable';
import TasksTable from '../components/TasksTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

function CatalogPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('tasks.pageTitle')}</h1>
        <p className="text-muted-foreground">{t('tasks.pageSubtitle')}</p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[280px]">
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tasks.tabTasks')}</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tasks.tabTypes')}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <TasksTable />
        </TabsContent>
        <TabsContent value="types">
          <TypeTasksTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CatalogPage;
