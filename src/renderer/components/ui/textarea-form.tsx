import React, { useRef, useEffect, useCallback } from 'react';
import { Controller, ControllerRenderProps, ControllerFieldState, FieldValues } from 'react-hook-form';

interface TextareaProps {
  className?: string;
  name: string;
  control?: unknown;
  required?: boolean;
  rules?: Record<string, unknown>;
  rows?: number;
  [key: string]: unknown;
}

interface TextareaFieldProps {
  field: ControllerRenderProps<FieldValues, string>;
  fieldState: ControllerFieldState;
  className?: string;
  baseStyles: string;
  rows: number;
  rest: Record<string, unknown>;
}

function TextareaField({ field, fieldState, className, baseStyles, rows, rest }: TextareaFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const element = textareaRef.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  }, []);

  // Adjust height when value changes or on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      adjustHeight();
    });
  }, [field.value, adjustHeight]);

  // Combine refs: our ref + react-hook-form's ref
  const setRefs = useCallback(
    (element: HTMLTextAreaElement | null) => {
      // Set our internal ref
      (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = element;
      // Call react-hook-form's ref
      field.ref(element);
    },
    [field]
  );

  return (
    <div className="w-full">
      <textarea
        ref={setRefs}
        className={`${baseStyles} ${className || ''}`}
        rows={rows}
        onInput={adjustHeight}
        name={field.name}
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        {...rest}
      />
      {fieldState?.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
    </div>
  );
}

function TextareaForm({ className, control, name, rules, rows = 1, ...rest }: TextareaProps) {
  const baseStyles =
    'flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  if (control) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState }) => (
          <TextareaField
            field={field}
            fieldState={fieldState}
            className={className}
            baseStyles={baseStyles}
            rows={rows}
            rest={rest}
          />
        )}
      />
    );
  }

  // Fallback for uncontrolled usage
  return (
    <div className="w-full">
      <textarea className={`${baseStyles} ${className || ''}`} rows={rows} {...rest} />
    </div>
  );
}

export default TextareaForm;
