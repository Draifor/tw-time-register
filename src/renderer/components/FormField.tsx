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
      <div className="flex items-end space-x-2 flex-1 justify-center">
        {label && <Label htmlFor={accessorKey as string}>{label}</Label>}
        <Select
          name={accessorKey as string}
          control={control}
          options={options}
          placeholder={header}
          rules={rules}
          className={`w-full ${className}`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-end space-x-2 flex-1 justify-center">
      {label && <Label htmlFor={accessorKey as string}>{label}</Label>}
      <Input
        name={accessorKey as string}
        control={control}
        rules={rules}
        type={type}
        placeholder={header}
        className={`w-full ${className}`}
      />
    </div>
  );
}

export default FormField;
