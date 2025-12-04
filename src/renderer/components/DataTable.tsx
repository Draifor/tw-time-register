import React, { useMemo } from 'react';
import { FieldValues } from 'react-hook-form';
import { Row, flexRender } from '@tanstack/react-table';
import Button from './ui/Button';
import Input from './ui/InputForm';
import { Column, DataTableProps } from '../../types/dataTable';
import DynamicForm from './DynamicForm';
import useTable from '../hooks/useTable';

// Define interfaces for better type safety
interface ActionCellProps<T> {
  row: Row<T>;
  onEdit: (data: T) => void;
  onDelete: (data: T) => void;
}

// Define ActionCell outside of DataTable
function ActionCell<T>({ row, onEdit, onDelete }: ActionCellProps<T>) {
  return (
    <div className="flex space-x-2">
      <button
        onClick={() => onEdit(row.original)}
        className="px-3 py-1 text-sm text-blue-500 hover:text-blue-700 transition-colors"
      >
        Editar
      </button>
      <button
        onClick={() => onDelete(row.original)}
        className="px-3 py-1 text-sm text-red-500 hover:text-red-700 transition-colors"
      >
        Eliminar
      </button>
    </div>
  );
}

function DataTable<T extends FieldValues>({
  columns,
  data,
  isLoading,
  isEditable = false,
  error,
  formFunction,
  onEdit,
  onDelete
}: DataTableProps<T>) {
  interface RowActionT<TField> {
    row: Row<TField>;
  }
  const handleActionCell = ({ row }: RowActionT<T>) =>
    onEdit && onDelete ? <ActionCell<T> row={row} onEdit={onEdit} onDelete={onDelete} /> : null;

  const actionColumn = useMemo<Column>(
    () => ({
      id: 'actions',
      header: 'Acciones',
      accessorKey: 'actions',
      cell: handleActionCell
    }),
    [onEdit, onDelete]
  );

  const tableColumns = useMemo(() => {
    if (onEdit && onDelete) {
      return [...columns, actionColumn];
    }
    return columns;
  }, [columns, actionColumn, onEdit, onDelete]);

  const { table, globalFilter, setGlobalFilter } = useTable({ columns: tableColumns, data, isEditable });

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
      {formFunction && <DynamicForm fields={columns} onSubmit={formFunction} />}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse block md:table">
          <thead className="block md:table-header-group">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border md:table-row">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border md:table-cell px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex flex-col">
                        {flexRender(header.column.columnDef.header, header.getContext())}
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
