import React from 'react';

interface ButtonProps {
  type?: 'button' | 'submit' | 'reset';
  className?: 'destructive' | 'primary' | 'secondary'; // Ajusta los variantes según tu implementación
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

function Button({ type, className, onClick, children, disabled }: ButtonProps) {
  return (
    <button
      type={type}
      className={`px-4 py-2 bg-blue-500 text-white rounded disabled:text-gray-500 disabled:bg-gray-300 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;
