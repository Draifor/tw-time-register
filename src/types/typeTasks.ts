export interface TypeTasks {
  id?: number;
  typeName: string;
}

export const columnsDB = {
  TABLE_NAME: 'type_tasks',
  ID: 'type_id',
  TYPE_NAME: 'type_name'
};

export const columns = [
  {
    header: 'Type Task',
    accessorKey: columnsDB.TYPE_NAME,
    enableColumnFilter: false
  }
];
