import { FieldValues } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';

export interface Column {
  accessorKey: string;
  header: string;
  label?: string;
  options?: { value: string; label: string }[];
  rules?: { required: string };
  type?: string;
}

export interface UseTableProps<T extends FieldValues> {
  columns: ColumnDef<T>[];
  data: T[];
  isEditable: boolean;
  onPersist?: (row: T) => void;
}
