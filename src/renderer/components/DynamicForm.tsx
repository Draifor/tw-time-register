import React from 'react';
import { DefaultValues, FieldValues, useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Column, NewRecord } from '../../types/dataTable';
import FormField from './FormField';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface DynamicFormProps<T extends FieldValues> {
  fields: Column[];
  onSubmit: (data: T) => void | Promise<void>;
  onError?: (error: any) => void;
  initialValues?: Partial<T>;
}

function DynamicForm<T extends FieldValues>({ fields, onSubmit, onError, initialValues }: DynamicFormProps<T>) {
  const defaultValues = fields.reduce((acc, field) => {
    (acc as any)[field.accessorKey] = (initialValues as any)?.[field.accessorKey] ?? '';
    return acc;
  }, {} as DefaultValues<T>);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<T>({
    defaultValues
  });

  const transformData = (data: T): NewRecord<T> => {
    const transformedData = {} as NewRecord<T>;
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && 'value' in value) {
        transformedData[key as keyof T] = value.value;
      } else {
        transformedData[key as keyof T] = value;
      }
    });
    return transformedData;
  };

  const handleFormSubmit = (data: T) => {
    try {
      const transformedData = transformData(data);
      onSubmit(transformedData);
      reset(defaultValues);
    } catch (error) {
      onError?.(error);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <form
          className="flex flex-row flex-wrap gap-4 items-end justify-center"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          {fields.map((field) => (
            <FormField key={field.accessorKey} field={field} control={control} />
          ))}
          <Button type="submit" disabled={isSubmitting} className="gap-1">
            <Plus className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default DynamicForm;
