import React from 'react';
import useDarkMode from '../../hooks/useDarkMode';

interface InputProps {
  className?: string;
  name?: string;
  [key: string]: any;
}

function Input({ className, name, ...rest }: InputProps) {
  const { isDark } = useDarkMode();

  return (
    <input
      className={`${isDark ? 'text-gray-800' : ''} border border-gray-300 rounded px-2 py-1 h-10 ${className}`}
      {...rest}
      name={name}
    />
  );
}

export default Input;
