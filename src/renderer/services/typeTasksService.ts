import { TypeTasks } from '../../types/typeTasks';

const fetchTypeTasks = async (): Promise<TypeTasks[]> => {
  return window.Main.getTypeTasks();
};

export const addTypeTask = async (typeName: string): Promise<void> => {
  return window.Main.addTypeTasks({ typeName });
};

export const updateTypeTask = async (id: number, typeName: string): Promise<void> => {
  return window.Main.updateTypeTask(id, typeName);
};

export const deleteTypeTask = async (id: number): Promise<void> => {
  return window.Main.deleteTypeTask(id);
};

export default fetchTypeTasks;
