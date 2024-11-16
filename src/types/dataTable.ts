import { FieldValues, Control } from 'react-hook-form';

export interface Column {
  accessorKey: string;
  header: string;
  label?: string;
  options?: { value: string; label: string }[];
  rules?: { required: string };
  type?: string;
}

export type NewRecord<T> = {
  [K in keyof T]: T[K];
};

export interface DataTableProps<T extends FieldValues> {
  columns: Column[];
  data: T[];
  isLoading: boolean;
  error: { message: string } | null;
  formFunction: (newData: NewRecord<T>) => void;
  onEdit: (rowData: T) => void;
  onDelete: (rowData: T) => void;
}

export interface UseTableProps<T extends FieldValues> {
  columns: Column[];
  data: T[];
}

export interface FormFieldProps<T extends FieldValues> {
  field: Column;
  control: Control<T>;
  className?: string;
}
