import { useQuery } from '@tanstack/react-query';
import { fetchWorkTimes, columns } from '../services/timesService';

function useTimeLogs() {
  const { data, isPending: isLoading, error } = useQuery({
    queryKey: ['workTimes'],
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
