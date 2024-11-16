import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, addTask, editTask, deleteTask } from '../services/tasksService';
import { columns as originalColumns, Task } from '../../types/tasks';
import { TypeTasks } from '../../types/typeTasks';

function useTasks() {
  const { data, isLoading, error } = useQuery(['tasks'], fetchTasks);
  const queryClient = useQueryClient();

  const { mutate: onSubmit, isLoading: isLoadingMutation } = useMutation({
    mutationFn: addTask,
    onMutate: async (newTask) => {
      await queryClient.cancelQueries(['tasks']);

      const previousTasks = queryClient.getQueryData(['tasks']);

      queryClient.setQueryData(['tasks'], (old: Task[] = []) => [...old, newTask]);

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      console.error(err);
      queryClient.setQueryData(['tasks'], context?.previousTasks);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries(['tasks']);
    }
  });

  const { mutate: onEdit } = useMutation(editTask, {
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
    }
  });

  const { mutate: onDelete } = useMutation(deleteTask, {
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
    }
  });

  const taskTypes = queryClient.getQueryData<TypeTasks[]>(['typeTasks']);

  const columns = originalColumns.map((column) => {
    if (column.type === 'select') {
      return {
        ...column,
        options: taskTypes?.map((type: TypeTasks) => ({
          value: type.typeName,
          label: type.typeName
        }))
      };
    }
    return column;
  });
  console.log(data);
  return { data, isLoading, error, columns, onSubmit, isLoadingMutation, onEdit, onDelete };
}

export default useTasks;
