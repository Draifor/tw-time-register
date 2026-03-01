import React from 'react';
import { Controller, Control, FieldValues, RegisterOptions } from 'react-hook-form';
import DateTimePicker from 'react-flatpickr';
import { Options } from 'flatpickr/dist/types/options';
import 'flatpickr/dist/flatpickr.css';

interface InputTimeProps {
  className?: string;
  control: Control<FieldValues>;
  name: string;
  rules?: RegisterOptions;
  options?: Partial<Options>;
}

function InputTime({ className, control, name, rules, options }: InputTimeProps) {
  const DateTimePickerAny = DateTimePicker as React.ComponentType<Record<string, unknown>>;
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <DateTimePickerAny
          {...field}
          value={field.value || []}
          onChange={(date: Date[]) => field.onChange(date)}
          className={`${baseStyles} ${className || ''}`}
          options={options}
        />
      )}
    />
  );
}

export default InputTime;
