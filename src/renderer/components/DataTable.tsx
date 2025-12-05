import React, { useRef, useCallback, useEffect } from 'react';
import { ColumnDef, RowData, flexRender } from '@tanstack/react-table';
import { FieldValues } from 'react-hook-form';
import { Plus, Loader2, Inbox, AlertCircle } from 'lucide-react';
import useTable from '../hooks/useTable';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

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
}

// Skeleton loader component
function SkeletonTable({
  title,
  columnCount,
  showAddButton
}: {
  title?: string;
  columnCount: number;
  showAddButton: boolean;
}) {
  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center justify-between gap-4 mb-4">
          <Skeleton className="h-9 w-[200px]" />
          {showAddButton && <Skeleton className="h-9 w-[100px]" />}
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {[...Array(columnCount)].map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {[...Array(columnCount)].map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Empty state component
function EmptyState({ onAddRow }: { onAddRow?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No data yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-[300px]">
        Get started by adding your first entry. Your data will appear here.
      </p>
      {onAddRow && (
        <Button onClick={onAddRow} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Add First Entry
        </Button>
      )}
    </div>
  );
}

// Error state component
function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Something went wrong</h3>
      <p className="text-sm text-muted-foreground max-w-[300px]">{message || 'An unexpected error occurred'}</p>
    </div>
  );
}

function DataTable<T extends FieldValues>({
  columns,
  data,
  isLoading,
  isEditable = false,
  error,
  title,
  onAddRow
}: DataTableProps<T>) {
  const { table, globalFilter, setGlobalFilter, loadMoreRows, hasMoreRows, visibleRowCount, totalRows } = useTable({
    columns,
    data,
    isEditable
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Handle scroll to load more rows
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loadingRef.current || !hasMoreRows) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollThreshold = 100; // pixels from bottom

    if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
      loadingRef.current = true;
      loadMoreRows();
      // Reset loading flag after a short delay
      setTimeout(() => {
        loadingRef.current = false;
      }, 100);
    }
  }, [hasMoreRows, loadMoreRows]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  if (isLoading) return <SkeletonTable title={title} columnCount={columns.length} showAddButton={isEditable} />;
  if (error) return <ErrorState message={error.message} />;

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
            <Button onClick={onAddRow} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          )}
        </div>

        <div ref={scrollContainerRef} className="rounded-md border max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="transition-colors hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32">
                    {globalFilter ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <p className="text-muted-foreground mb-1">No results found for "{globalFilter}"</p>
                        <Button variant="ghost" size="sm" onClick={() => setGlobalFilter('')}>
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      <EmptyState onAddRow={isEditable ? onAddRow : undefined} />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Infinite scroll status */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
            <span>
              Showing {visibleRowCount} of {totalRows} rows
            </span>
            {hasMoreRows && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Scroll for more...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataTable;
