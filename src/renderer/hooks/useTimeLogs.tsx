import { useQuery } from '@tanstack/react-query';
import { fetchWorkTimes, columns } from '../services/timesService';

function useTimeLogs() {
  const { data, isLoading, error } = useQuery(['workTimes'], fetchWorkTimes);

  return {
    data: data || [],
    isLoading,
    error,
    columns
  };
}

export default useTimeLogs;
