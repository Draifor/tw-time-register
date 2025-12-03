import { FieldValues, Control } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';

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
  isEditable?: boolean;
  error: { message: string } | null;
  formFunction?: (newData: NewRecord<T>) => void;
  onEdit?: (rowData: T) => void;
  onDelete?: (rowData: T) => void;
}

export interface UseTableProps<T extends FieldValues> {
  columns: ColumnDef<T>[];
  data: T[];
  isEditable: boolean;
}

export interface FormFieldProps<T extends FieldValues> {
  field: Column;
  control: Control<T>;
  className?: string;
}
