import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchComments, commentsColumns } from '../services/commentsServices';
import DataTable from '../components/DataTable';

function CommentsTable() {
  const { data, isLoading, error } = useQuery(['comments'], fetchComments);
  return <DataTable data={data} isLoading={isLoading} error={error} columns={commentsColumns} />;
}

export { CommentsTable };
