import React from 'react';
import { Controller } from 'react-hook-form';
import useDarkMode from '../../hooks/useDarkMode';

interface InputProps {
  className?: string;
  name: string;
  control?: any;
  required?: boolean;
  rules?: any;
  [key: string]: any;
}

function InputForm({ className, control, name, rules, ...rest }: InputProps) {
  const { isDark } = useDarkMode();

  const inputElement = (field: any, fieldState: any) => (
    <>
      <input
        className={`${isDark ? 'text-gray-800' : ''} border border-gray-300 rounded px-2 py-1 h-10 ${className}`}
        {...rest}
        {...field}
      />
      {fieldState?.error && <p className="text-red-500">{fieldState.error.message}</p>}
    </>
  );

  if (control) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState }) => inputElement(field, fieldState)}
      />
    );
  }

  return inputElement({}, {});
}

export default InputForm;
