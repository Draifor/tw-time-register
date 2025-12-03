import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchComments, commentsColumns } from '../services/commentsServices';
import DataTable from '../components/DataTable';

function CommentsTable() {
  const { data, isLoading, error } = useQuery(['comments'], fetchComments);
  return (
    <DataTable
      data={data}
      isLoading={isLoading}
      error={error ? { message: String((error as Error)?.message) || 'An error occurred' } : null}
      columns={commentsColumns}
    />
  );
}

export default CommentsTable;
