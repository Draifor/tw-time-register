import { useState } from 'react';

const useDarkMode = () => {
  const [isDark, setDark] = useState(true);

  const darkModeHandler = () => {
    setDark(!isDark);
    document.body.classList.toggle('dark');
  };

  return { isDark, darkModeHandler };
};

export default useDarkMode;
