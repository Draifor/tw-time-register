import React from 'react';
import { Controller } from 'react-hook-form';
import DateTimePicker from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';
import useDarkMode from '../../hooks/useDarkMode';

interface InputTimeProps {
  className?: string;
  control: any;
  name: string;
  rules?: any;
  options?: any;
}

function InputTime({ className, control, name, rules, options }: InputTimeProps) {
  const { isDark } = useDarkMode();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <DateTimePicker
          {...field}
          value={field.value || []} // Asignamos un valor inicial si `field.value` es `undefined`
          onChange={(date) => field.onChange(date)} // Actualiza el valor en react-hook-form
          className={`${isDark ? 'text-gray-800' : ''} border border-gray-300 rounded px-2 py-1 h-10 ${className}`}
          options={options}
        />
      )}
    />
  );
}

export default InputTime;
