const fetchTasks = async () => {
  const response = await window.Main.getTasks();
  return response;
};

export default fetchTasks;
