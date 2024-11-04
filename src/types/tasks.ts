import { columnsDB as typeTasksDBColumns } from './typeTasks';

export interface Task {
  id?: number;
  typeId: number;
  taskName: string;
  taskLink: string;
  descripcion: string;
}

export const columnsDB = {
  TABLE_NAME: 'tasks',
  ID: 'task_id',
  DESCRIPTION: 'description',
  TASK_LINK: 'task_link',
  TASK_NAME: 'task_name',
  TYPE_ID: 'type_id',
  TYPE_NAME: typeTasksDBColumns.TYPE_NAME
};

export const columns = [
  {
    header: 'Task Name',
    accessorKey: columnsDB.TASK_NAME,
    enableColumnFilter: true
  },
  {
    header: 'Task Type',
    accessorKey: columnsDB.TYPE_NAME,
    enableColumnFilter: true
  },
  {
    header: 'Task Link',
    accessorKey: columnsDB.TASK_LINK,
    enableColumnFilter: true
  },
  {
    header: 'Description',
    accessorKey: columnsDB.DESCRIPTION,
    enableColumnFilter: true
  }
];
