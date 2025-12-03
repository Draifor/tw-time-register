import { Task } from '../../types/tasks';

export const fetchTasks = async () => {
  const response = await window.Main.getTasks();
  return response;
};

export const addTask = async (task: Task) => {
  const response = await window.Main.addTask(task);
  return response;
};

export const editTask = async (task: Task) => {
  const response = await window.Main.updateTask(task);
  return response;
};

export const deleteTask = async (id: number) => {
  const response = await window.Main.deleteTask(id);
  return response;
};
