import React from 'react';
import DataTable from './DataTable';
import useTimeLogs from '../hooks/useTimeLogs';

function TimeLogs() {
  const { data, isLoading, error, columns } = useTimeLogs();

  return (
    <DataTable
      title="Time Logs"
      data={data}
      isLoading={isLoading}
      error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
      columns={columns}
    />
  );
}

export default TimeLogs;
