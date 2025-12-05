import React from 'react';
import { Controller } from 'react-hook-form';
import DateTimePicker from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';

interface InputDateProps {
  className?: string;
  control: any;
  name: string;
  rules?: any;
  options?: any;
}

function InputDate({ className, control, name, rules, options }: InputDateProps) {
  const DateTimePickerAny = DateTimePicker as any;
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  const defaultOptions = {
    dateFormat: 'Y-m-d',
    allowInput: true,
    ...options
  };

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <div className="w-full">
          <DateTimePickerAny
            value={field.value || ''}
            onChange={(dates: Date[], dateStr: string) => {
              // Store as string in Y-m-d format for consistency
              field.onChange(dateStr);
            }}
            className={`${baseStyles} ${className || ''}`}
            options={defaultOptions}
          />
          {fieldState?.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}

export default InputDate;
