import { Column } from './dataTable';

export interface TypeTasksDB {
  type_id: number;
  type_name: string;
}

export interface TypeTasks {
  id?: number;
  typeName: string;
}

export const columnsDB = {
  TABLE_NAME: 'type_tasks',
  ID: 'type_id',
  TYPE_NAME: 'type_name'
};

export const columns: Column[] = [
  {
    header: 'Type Task',
    accessorKey: 'typeName'
  }
];
