import React from 'react';
import { Controller } from 'react-hook-form';
import Select, { StylesConfig } from 'react-select';

interface Option {
  value: string;
  label: string;
}

interface SelectComponentProps {
  name?: string;
  options: Option[];
  placeholder?: string;
  value?: Option;
  onChange?: (option: Option | null) => void;
  control?: any;
  rules?: any;
  className?: string;
}

const customStyles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: '36px',
    height: '36px',
    borderRadius: '0.375rem',
    borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
    boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    backgroundColor: 'transparent',
    '&:hover': {
      borderColor: 'hsl(var(--ring))'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 8px',
    height: '34px'
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: 'hsl(var(--foreground))'
  }),
  singleValue: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))'
  }),
  placeholder: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))'
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: '34px'
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.375rem',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
    color: state.isFocused ? 'hsl(var(--accent-foreground))' : 'hsl(var(--popover-foreground))',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: 'hsl(var(--accent))'
    }
  })
};

function SelectComponent({
  name,
  control,
  options,
  placeholder,
  rules,
  className,
  value,
  onChange,
  ...rest
}: SelectComponentProps) {
  return control ? (
    <Controller
      name={name ?? ''}
      control={control}
      defaultValue={options[0]}
      rules={rules}
      render={({ field }) => (
        <Select {...field} options={options} placeholder={placeholder} styles={customStyles} className={className} />
      )}
    />
  ) : (
    <Select
      options={options}
      placeholder={placeholder}
      value={value}
      styles={customStyles}
      className={className}
      onChange={onChange}
      {...rest}
    />
  );
}

export default SelectComponent;
