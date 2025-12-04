import React from 'react';
import { Controller } from 'react-hook-form';

interface InputProps {
  className?: string;
  name: string;
  control?: any;
  required?: boolean;
  rules?: any;
  [key: string]: any;
}

function InputForm({ className, control, name, rules, ...rest }: InputProps) {
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  const inputElement = (field: any, fieldState: any) => (
    <div className="w-full">
      <input className={`${baseStyles} ${className || ''}`} {...rest} {...field} />
      {fieldState?.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
    </div>
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
