import React from 'react';
import { Controller } from 'react-hook-form';
import Select from 'react-select';
import useDarkMode from '../../hooks/useDarkMode';

interface Option {
  value: string;
  label: string;
}

interface props {
  name?: string;
  options: Option[];
  placeholder?: string;
  value?: Option;
  onChange?: any;
  control?: any;
  rules?: any;
  className?: string;
}

function SelectComponent({ name, control, options, placeholder, rules, className, value, onChange, ...rest }: props) {
  const { isDark } = useDarkMode();

  return control ? (
    <Controller
      name={name ?? ''}
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
  ) : (
    <Select
      options={options}
      placeholder={placeholder}
      value={value}
      className={`${isDark ? 'text-gray-800' : ''} ${className}`}
      onChange={onChange}
      {...rest}
    />
  );
}

export default SelectComponent;
