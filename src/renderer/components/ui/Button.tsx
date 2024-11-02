import React from 'react';

interface ButtonProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'destructive' | 'primary' | 'secondary'; // Ajusta los variantes según tu implementación
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

function Button({ type, variant, onClick, children, disabled }: ButtonProps) {
  return (
    <button type={type} className={`btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default Button;
