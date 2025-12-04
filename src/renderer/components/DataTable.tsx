import React from 'react';
import { ColumnDef, RowData, flexRender } from '@tanstack/react-table';
import { FieldValues } from 'react-hook-form';
import useTable from '../hooks/useTable';
import { Button } from './ui/button';
import { Input } from './ui/input';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: keyof TData) => void;
  }
}

interface DataTableProps<T extends FieldValues> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  isEditable?: boolean;
  error: { message: string } | null;
  onAddRow?: () => void;
  formFunction?: (newData: any) => void;
  onEdit?: (rowData: T) => void;
  onDelete?: (rowData: T) => void;
}

function DataTable<T extends FieldValues>({
  columns,
  data,
  isLoading,
  isEditable = false,
  error,
  onAddRow,
  formFunction,
  onEdit,
  onDelete
}: DataTableProps<T>) {
  const { table, globalFilter, setGlobalFilter } = useTable({ columns, data, isEditable });

  if (isLoading)
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  if (error)
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-red-500">Error: {error.message}</div>
      </div>
    );

  return (
    <div className="p-4">
      {isEditable && onAddRow && (
        <div className="mb-4">
          <button onClick={onAddRow}>Add Row</button>
        </div>
      )}
      <div className="mb-4 flex justify-center">
        <Input
          type="text"
          name="globalFilter"
          value={globalFilter || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value)}
          placeholder="Filter..."
          className="w-3/4"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse block md:table">
          <thead className="block md:table-header-group">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border md:table-row">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="border md:table-cell px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex flex-col">
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="block md:table-row-group">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border md:table-row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2 border md:table-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(table.getCanNextPage() || table.getCanPreviousPage()) && (
        <div className="flex justify-around mt-4">
          <Button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
          <span className="px-4 py-2">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
        </div>
      )}
    </div>
  );
}

export default DataTable;
