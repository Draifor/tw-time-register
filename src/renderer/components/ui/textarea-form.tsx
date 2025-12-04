import React from 'react';
import { Controller } from 'react-hook-form';

interface TextareaProps {
  className?: string;
  name: string;
  control?: any;
  required?: boolean;
  rules?: any;
  rows?: number;
  [key: string]: any;
}

function TextareaForm({ className, control, name, rules, rows = 1, ...rest }: TextareaProps) {
  const baseStyles =
    'flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-auto';

  const textareaElement = (field: any, fieldState: any) => (
    <div className="w-full">
      <textarea
        className={`${baseStyles} ${className || ''}`}
        rows={rows}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${target.scrollHeight}px`;
        }}
        {...rest}
        {...field}
      />
      {fieldState?.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
    </div>
  );

  if (control) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState }) => textareaElement(field, fieldState)}
      />
    );
  }

  return textareaElement({}, {});
}

export default TextareaForm;
