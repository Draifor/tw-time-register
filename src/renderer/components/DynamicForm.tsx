import React from 'react';
import { DefaultValues, FieldValues, useForm } from 'react-hook-form';
import { Column, NewRecord } from '../../types/dataTable';
import FormField from './FormField';

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
    reset
    // formState: { errors, isSubmitting }
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
    <>
      <form
        className="flex flex-row rounded-lg shadow-lg flex-wrap space-x-4 p-4 justify-center items-start"
        onSubmit={handleSubmit(handleFormSubmit)}
      >
        {fields.map((field) => (
          <FormField key={field.accessorKey} field={field} control={control} />
        ))}
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Añadir
        </button>
      </form>
      {/* <form className="space-y-4 p-6 bg-white rounded-lg shadow-sm" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((field) => (
            <div key={String(field.name)} className="space-y-2">
              <label htmlFor={String(field.name)} className="block text-sm font-medium text-gray-700">
                {field.header}
                {field.rules && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FormField field={field} control={control} />
              {errors[field.name] && <p className="text-sm text-red-500">{errors[field.name]?.message as string}</p>}
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
          >
            {isSubmitting ? 'Enviando...' : 'Añadir'}
          </button>
        </div>
      </form> */}
    </>
  );
}

export default DynamicForm;
