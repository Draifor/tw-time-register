import { useState, useMemo } from 'react';
import { FieldValues } from 'react-hook-form';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  // getPaginationRowModel,
  getSortedRowModel
} from '@tanstack/react-table';
import { UseTableProps } from '../../types/dataTable';

function useTable<T extends FieldValues>({ columns, data }: UseTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState('');
  const memoColumns = useMemo(() => columns, [columns]);

  const table = useReactTable({
    data: data || [],
    columns: memoColumns,
    state: {
      globalFilter
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString' // Puedes cambiar la función de filtrado según tus necesidades
  });
  return {
    table,
    globalFilter,
    setGlobalFilter
  };
}

export default useTable;
