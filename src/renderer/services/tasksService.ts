import { Task } from '../../types/tasks';

export const fetchTasks = async (search?: string) => {
  const response = await window.Main.getTasks(search);
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

export const fetchTWSubtasks = async (parentTaskLink: string) => {
  return window.Main.fetchTWSubtasks(parentTaskLink);
};

export const debugTWSubtasks = async (parentTaskLink: string) => {
  return window.Main.debugTWSubtasks(parentTaskLink);
};

export const importTasksFromTW = async (input: {
  parentTaskLink: string;
  prefix: string;
  template: 'RECA_FORE' | 'OTHER';
  typeName: string;
}) => {
  return window.Main.importTasksFromTW(input);
};

export const importTasksFromCSV = async (rows: { taskName: string; typeName: string; taskLink: string }[]) => {
  return window.Main.importTasksFromCSV(rows);
};
