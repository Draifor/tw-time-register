import React from 'react';
import { Controller, Control, RegisterOptions } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const selectStyles =
  'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer';

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
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const selectedOption = options.find((opt) => opt.value === selectedValue) || null;
    onChange?.(selectedOption);
  };

  const selectElement = (fieldValue?: Option, onFieldChange?: (option: Option | null) => void) => (
    <div className="relative">
      <select
        className={cn(selectStyles, className)}
        value={fieldValue?.value || ''}
        onChange={(e) => {
          const selectedValue = e.target.value;
          const selectedOption = options.find((opt) => opt.value === selectedValue) || null;
          onFieldChange?.(selectedOption);
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" />
    </div>
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
    <div className="relative">
      <select className={cn(selectStyles, className)} value={value?.value || ''} onChange={handleChange}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" />
    </div>
  );
}

export default SelectComponent;
