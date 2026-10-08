import React from 'react';
import { ColumnDef, RowData, flexRender } from '@tanstack/react-table';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Inbox, SearchX } from 'lucide-react';
import useTable from '../hooks/useTable';
import useIncrementalRows from '../hooks/useIncrementalRows';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { TableRowCount } from './ui/table-row-count';
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
  onPersist?: (row: T) => void;
  hideSearch?: boolean;
}

// Skeleton loader component
function SkeletonTable({ title, columnCount }: { title?: string; columnCount: number }) {
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
  onPersist,
  hideSearch = false
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { table, globalFilter, setGlobalFilter } = useTable({
    columns,
    data,
    isEditable,
    onPersist
  });

  // Row windowing is unified on `useIncrementalRows` (D-3): only the first
  // `visibleCount` rows of the filtered model are mounted, and the sentinel below
  // the table reveals the next batch as the document scrolls. `getRowModel()`
  // already applies the global filter, so the window always tracks the visible
  // result set. The sentinel is mounted only while `hasMore`, and
  // `useInfiniteScroll`'s callback ref re-attaches it after the loading ->
  // loaded transition (the hooks must stay above the early returns).
  const allRows = table.getRowModel().rows;
  const { visibleCount, hasMore, showMore } = useIncrementalRows(allRows.length);
  const rowsToRender = allRows.slice(0, visibleCount);
  const sentinelRef = useInfiniteScroll({ hasMore, loadMore: showMore });

  if (isLoading) return <SkeletonTable title={title} columnCount={columns.length} />;
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
        </TableToolbar>

        <div className="rounded-md border">
          <Table>
            <TableHeader className="sticky top-[5.5rem] bg-background z-10">
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
                      />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Sentinel: mounted only while more rows remain (D-3). A false -> true
              `hasMore` transition mounts a fresh node the callback ref can
              observe (R3-HASMORE-REARM contract). */}
          {hasMore && <div ref={sentinelRef} data-sentinel="catalog" aria-hidden="true" />}
        </div>

        {/* Shared record count (D-4). */}
        <TableRowCount shown={visibleCount} total={allRows.length} filtered={Boolean(globalFilter)} hasMore={hasMore} />
      </CardContent>
    </Card>
  );
}

export default DataTable;
