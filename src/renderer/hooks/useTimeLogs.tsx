import { useQuery } from '@tanstack/react-query';
import { fetchWorkTimes, columns } from '../services/timesService';
import { queryKeys } from '../lib/queryKeys';

function useTimeLogs() {
  const {
    data,
    isPending: isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.workTimes.all,
    queryFn: fetchWorkTimes
  });

  return {
    data: data || [],
    isLoading,
    error,
    columns
  };
}

export default useTimeLogs;
