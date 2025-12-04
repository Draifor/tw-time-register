import React from 'react';
import { ColumnDef, RowData, flexRender } from '@tanstack/react-table';
import { FieldValues } from 'react-hook-form';
import useTable from '../hooks/useTable';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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
  title?: string;
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
  title,
  onAddRow,
  formFunction,
  onEdit,
  onDelete
}: DataTableProps<T>) {
  const { table, globalFilter, setGlobalFilter } = useTable({ columns, data, isEditable });

  if (isLoading)
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  if (error)
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-destructive">Error: {error.message}</div>
      </div>
    );

  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center justify-between gap-4 mb-4">
          <Input
            type="text"
            value={globalFilter || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value)}
            placeholder="Search..."
            className="max-w-sm"
          />
          {isEditable && onAddRow && (
            <Button onClick={onAddRow} size="sm">
              Add Row
            </Button>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {(table.getCanNextPage() || table.getCanPreviousPage()) && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataTable;
