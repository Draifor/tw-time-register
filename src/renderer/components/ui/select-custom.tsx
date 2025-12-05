import React from 'react';
import { Controller, Control, RegisterOptions } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

interface Option {
  value: string;
  label: string;
}

interface SelectComponentProps {
  name?: string;
  options: Option[];
  placeholder?: string;
  value?: Option | null;
  onChange?: (option: Option | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control?: Control<any>;
  rules?: RegisterOptions;
  className?: string;
}

function SelectComponent({
  name,
  control,
  options,
  placeholder,
  rules,
  className,
  value,
  onChange
}: SelectComponentProps) {
  const handleChange = (selectedValue: string) => {
    const selectedOption = options.find((opt) => opt.value === selectedValue) || null;
    onChange?.(selectedOption);
  };

  const selectElement = (fieldValue?: Option, onFieldChange?: (option: Option | null) => void) => (
    <Select
      value={fieldValue?.value || ''}
      onValueChange={(val) => {
        const selectedOption = options.find((opt) => opt.value === val) || null;
        onFieldChange?.(selectedOption);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (control && name) {
    return (
      <Controller
        name={name}
        control={control}
        defaultValue={options[0]}
        rules={rules}
        render={({ field }) => selectElement(field.value, field.onChange)}
      />
    );
  }

  return (
    <Select value={value?.value || ''} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SelectComponent;
