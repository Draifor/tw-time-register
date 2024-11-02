import React from 'react';
import { Controller } from 'react-hook-form';
import Select from 'react-select';
import useDarkMode from '../../hooks/useDarkMode';

interface props {
  name: string;
  control: any;
  options: any;
  rules?: any;
  placeholder: string;
  className?: string;
}

function SelectComponent({ name, control, options, placeholder, rules, className }: props) {
  const { isDark } = useDarkMode();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={options[0]}
      rules={rules}
      render={({ field }) => (
        <Select
          {...field}
          options={options}
          placeholder={placeholder}
          className={`${isDark ? 'text-gray-800' : ''} ${className}`}
        />
      )}
    />
  );
}

export default SelectComponent;
