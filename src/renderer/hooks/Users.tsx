import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUsers, usersColumns } from '../services/usersService';
import DataTable from '../components/DataTable';

function UsersTable() {
  const { data, isLoading, error } = useQuery(['users'], fetchUsers);
  return <DataTable data={data} isLoading={isLoading} error={error} columns={usersColumns} />;
}

export { UsersTable };
