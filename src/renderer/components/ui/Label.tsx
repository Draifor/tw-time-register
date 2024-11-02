import React from 'react';

interface LabelProps {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

function Label({ className, htmlFor, children }: LabelProps) {
  return (
    <label className={` ${className}`} htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export default Label;
