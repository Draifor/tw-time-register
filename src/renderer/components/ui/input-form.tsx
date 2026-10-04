import React from 'react';
import {
  Controller,
  Control,
  FieldValues,
  RegisterOptions,
  ControllerRenderProps,
  ControllerFieldState
} from 'react-hook-form';

interface InputProps {
  className?: string;
  name: string;
  control?: Control<FieldValues>;
  required?: boolean;
  rules?: RegisterOptions;
  [key: string]: unknown;
}

function InputForm({ className, control, name, required, rules, ...rest }: InputProps) {
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  const inputElement = (field: Partial<ControllerRenderProps>, fieldState: Partial<ControllerFieldState>) => {
    const errorId = `${name}-error`;
    const hasError = Boolean(fieldState?.error);
    return (
      <div className="w-full">
        <input
          className={`${baseStyles} ${className || ''}`}
          id={name}
          {...rest}
          {...field}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          aria-required={required || undefined}
        />
        {fieldState?.error && (
          <p id={errorId} className="text-sm text-destructive mt-1">
            {fieldState.error.message}
          </p>
        )}
      </div>
    );
  };

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
