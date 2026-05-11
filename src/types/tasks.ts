import { Column } from './dataTable';
import { columnsDB as typeTasksDBColumns } from './typeTasks';

export interface TaskDB {
  task_id: number;
  type_id: number;
  type_name: string;
  task_name: string;
  task_link: string;
  description: string;
  estimated_time: number | null;
}

export interface Task {
  id?: number;
  typeName: string;
  taskName: string;
  taskLink: string;
  description: string;
  estimatedTime?: number | null;
  totalLoggedMinutes?: number;
}

export const columnsDB = {
  TABLE_NAME: 'tasks',
  ID: 'task_id',
  DESCRIPTION: 'description',
  TASK_LINK: 'task_link',
  TASK_NAME: 'task_name',
  TYPE_ID: 'type_id',
  TYPE_NAME: typeTasksDBColumns.TYPE_NAME,
  ESTIMATED_TIME: 'estimated_time'
};

export const columns: Column[] = [
  {
    header: 'Task Name',
    accessorKey: 'taskName',
    type: 'text',
    rules: { required: 'Task name is required' }
  },
  {
    header: 'Task Type',
    accessorKey: 'typeName',
    type: 'select',
    rules: { required: 'Task type is required' }
  },
  {
    header: 'Task Link',
    accessorKey: 'taskLink',
    type: 'text',
    rules: { required: 'Task link is required' }
  },
  {
    header: 'Description',
    accessorKey: 'description',
    type: 'text'
  }
];
