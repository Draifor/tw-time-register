import React from 'react';
import DataTable from './DataTable';
import useTimeLogs from '../hooks/useTimeLogs';

function TimeLogs() {
  const { data, isLoading, error, columns } = useTimeLogs();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Time Logs</h2>
      <DataTable
        data={data}
        isLoading={isLoading}
        error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
        columns={columns}
      />
    </div>
  );
}

export default TimeLogs;
