import React, { useRef, useCallback, useEffect } from 'react';
import { ColumnDef, RowData, flexRender } from '@tanstack/react-table';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Inbox, SearchX } from 'lucide-react';
import useTable from '../hooks/useTable';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { EmptyState, ErrorState } from './ui/empty-state';
import { TableToolbar, TableToolbarSearch } from './ui/table-toolbar';

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
  onPersist?: (row: T) => void;
  hideSearch?: boolean;
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

function DataTable<T extends FieldValues>({
  columns,
  data,
  isLoading,
  isEditable = false,
  error,
  title,
  onAddRow,
  onPersist,
  hideSearch = false
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { table, globalFilter, setGlobalFilter, loadMoreRows, hasMoreRows, visibleRowCount, totalRows } = useTable({
    columns,
    data,
    isEditable,
    onPersist
  });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest values available to the identity-stable scroll handler so
  // the listener can attach once instead of on every data change.
  const hasMoreRowsRef = useRef(hasMoreRows);
  const loadMoreRowsRef = useRef(loadMoreRows);

  useEffect(() => {
    hasMoreRowsRef.current = hasMoreRows;
  }, [hasMoreRows]);

  useEffect(() => {
    loadMoreRowsRef.current = loadMoreRows;
  }, [loadMoreRows]);

  // When filtering: show all matching rows; when not: respect the infinite-scroll window
  const allRows = table.getRowModel().rows;
  const rowsToRender = globalFilter ? allRows : allRows.slice(0, visibleRowCount);

  // Handle scroll to load more rows
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loadingRef.current || !hasMoreRowsRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollThreshold = 100; // pixels from bottom

    if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
      loadingRef.current = true;
      loadMoreRowsRef.current();
      // Reset loading flag after a short delay
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        loadingRef.current = false;
        resetTimerRef.current = null;
      }, 100);
    }
  }, []);

  // Attach the listener to the scroll container once per mount. Using a ref
  // callback means the listener is not re-attached when data changes.
  const attachScrollContainer = useCallback(
    (node: HTMLDivElement | null) => {
      const previous = scrollContainerRef.current;
      if (previous && previous !== node) {
        previous.removeEventListener('scroll', handleScroll);
      }
      scrollContainerRef.current = node;
      if (node) {
        node.addEventListener('scroll', handleScroll);
      }
    },
    [handleScroll]
  );

  // Clear any pending "reset loadingRef" timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  if (isLoading) return <SkeletonTable title={title} columnCount={columns.length} showAddButton={isEditable} />;
  if (error) return <ErrorState title={t('table.errorTitle')} message={error.message || t('common.errorOccurred')} />;

  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <TableToolbar className="mb-4">
          {!hideSearch && (
            <TableToolbarSearch
              value={globalFilter || ''}
              onChange={setGlobalFilter}
              placeholder={t('table.searchPlaceholder')}
            />
          )}
          {isEditable && onAddRow && (
            <Button onClick={onAddRow} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              {t('table.addRow')}
            </Button>
          )}
        </TableToolbar>

        <div ref={attachScrollContainer} className="rounded-md border max-h-[60vh] overflow-auto">
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
              {rowsToRender?.length ? (
                rowsToRender.map((row) => (
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
                      <EmptyState
                        icon={SearchX}
                        title={t('table.noResults', { query: globalFilter })}
                        action={
                          <Button variant="ghost" size="sm" onClick={() => setGlobalFilter('')}>
                            {t('table.clearSearch')}
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Inbox}
                        title={t('table.emptyTitle')}
                        description={t('table.emptyDescription')}
                        action={
                          isEditable && onAddRow ? (
                            <Button onClick={onAddRow} size="sm" className="gap-1">
                              <Plus className="h-4 w-4" />
                              {t('table.addFirstEntry')}
                            </Button>
                          ) : undefined
                        }
                      />
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
              {globalFilter
                ? t('table.resultsOf', { count: allRows.length, total: totalRows })
                : t('table.showingRows', { shown: Math.min(visibleRowCount, totalRows), total: totalRows })}
            </span>
            {hasMoreRows && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('table.scrollForMore')}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataTable;
