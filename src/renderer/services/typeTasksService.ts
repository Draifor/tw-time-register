const fetchTypeTasks = async () => {
  const response = await window.Main.getTypeTasks();
  return response;
};

export default fetchTypeTasks;
