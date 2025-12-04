import React from 'react';
import { FieldValues } from 'react-hook-form';
import { FormFieldProps } from '../../types/dataTable';
import Input from './ui/input-form';
import { Label } from './ui/label';
import Select from './ui/select-custom';

function FormField<T extends FieldValues>({ field, control, className }: FormFieldProps<T>) {
  const { accessorKey, header, type = 'text', label, rules, options } = field;

  if (options) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[150px]">
        {label && (
          <Label htmlFor={accessorKey as string} className="text-sm font-medium">
            {label}
          </Label>
        )}
        <Select
          name={accessorKey as string}
          control={control}
          options={options}
          placeholder={header}
          rules={rules}
          className={className}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[150px]">
      {label && (
        <Label htmlFor={accessorKey as string} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <Input
        name={accessorKey as string}
        control={control}
        rules={rules}
        type={type}
        placeholder={header}
        className={className}
      />
    </div>
  );
}

export default FormField;
