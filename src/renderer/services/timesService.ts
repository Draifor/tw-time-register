export const fetchWorkTimes = async () => {
  const response = await window.Main.getTimeEntries();
  return response;
};

export const columns = [
  {
    header: 'Description',
    accessorKey: 'description',
    enableColumnFilter: true
  },
  {
    header: 'Task',
    accessorKey: 'task',
    enableColumnFilter: true
  },
  {
    header: 'Date',
    accessorKey: 'date',
    enableColumnFilter: true
  },
  {
    header: 'Hours',
    accessorKey: 'hours',
    enableColumnFilter: false
  },
  {
    header: 'Start Time',
    accessorKey: 'startTime',
    enableColumnFilter: false
  },
  {
    header: 'End Time',
    accessorKey: 'endTime',
    enableColumnFilter: false
  }
];
