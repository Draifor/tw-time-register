import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { FieldValues } from 'react-hook-form';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel
} from '@tanstack/react-table';
import { UseTableProps } from '../../types/dataTable';
import { Input } from '../components/ui/input';

const INITIAL_ROWS = 20;
const ROWS_PER_LOAD = 10;

function useSkipper() {
  const shouldSkipRef = useRef(true);
  const shouldSkip = shouldSkipRef.current;

  const skip = useCallback(() => {
    shouldSkipRef.current = false;
  }, []);

  useEffect(() => {
    shouldSkipRef.current = true;
  });

  return { shouldSkip, skip } as const;
}

const defaultColumn = <T,>(isEditable: boolean): Partial<ColumnDef<T>> => ({
  cell: ({ getValue, row: { index }, column: { id }, table }) => {
    const initialValue = getValue();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState(initialValue);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [isChanghed, setIsChanged] = useState(false);

    const onBlur = () => {
      if (!isChanghed) return;
      table.options.meta?.updateData(index, id, value as keyof T);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      setIsChanged(true);
    };

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    return isEditable ? (
      <Input
        type={typeof initialValue === 'number' ? 'number' : 'text'}
        value={value as string | number}
        onChange={onChange}
        onBlur={onBlur}
      />
    ) : (
      value
    );
  }
});

function useTable<T extends FieldValues>({ columns, data, isEditable, onPersist }: UseTableProps<T>) {
  const memoColumns = useMemo(() => columns, [columns]);
  const [localData, setLocalData] = useState(data || []);
  const { shouldSkip: autoResetPageIndex, skip: skipAutoResetPageIndex } = useSkipper();
  const [globalFilter, setGlobalFilter] = useState('');
  const [visibleRowCount, setVisibleRowCount] = useState(INITIAL_ROWS);

  const saveDataToDB = (rowIndex: number, columnId: string, value: unknown) => {
    // Simulate an API call
    console.log(`Saving data to DB: row ${rowIndex}, column ${columnId}, value ${value}`);
  };

  // When the user clears/changes the filter, reset the scroll window
  useEffect(() => {
    setVisibleRowCount(INITIAL_ROWS);
  }, [globalFilter]);

  // Infinite scroll: only relevant when no filter is active
  const hasMoreRows = !globalFilter && visibleRowCount < localData.length;

  const loadMoreRows = useCallback(() => {
    if (hasMoreRows) {
      setVisibleRowCount((prev) => Math.min(prev + ROWS_PER_LOAD, localData.length));
    }
  }, [hasMoreRows, localData.length]);

  // Reset visible count when data changes
  useEffect(() => {
    setVisibleRowCount(INITIAL_ROWS);
  }, [data]);

  // Sync localData when external data changes (e.g. after query loads)
  useEffect(() => {
    setLocalData(data || []);
  }, [data]);

  const table = useReactTable<T>({
    data: localData,
    columns: memoColumns as ColumnDef<T>[],
    defaultColumn: defaultColumn(isEditable ?? false),
    state: {
      globalFilter
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: 'includesString',
    autoResetPageIndex,
    meta: {
      updateData: (rowIndex, columnId, value) => {
        skipAutoResetPageIndex();
        let updatedRow: T | undefined;
        setLocalData((old) =>
          old.map((row, index) => {
            if (index === rowIndex) {
              updatedRow = { ...old[rowIndex], [columnId]: value };
              return updatedRow;
            }
            return row;
          })
        );
        if (updatedRow && onPersist) {
          onPersist(updatedRow);
        } else {
          saveDataToDB(rowIndex, columnId, value);
        }
      }
    },
    debugTable: true
  });
  return {
    table,
    globalFilter,
    setGlobalFilter,
    loadMoreRows,
    hasMoreRows,
    visibleRowCount,
    totalRows: localData.length
  };
}

export default useTable;
