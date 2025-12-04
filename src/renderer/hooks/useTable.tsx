import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { FieldValues } from 'react-hook-form';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel
} from '@tanstack/react-table';
import { UseTableProps } from '../../types/dataTable';
import { Input } from '../components/ui/input';

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
    const [value, setValue] = useState(initialValue);
    const [isChanghed, setIsChanged] = useState(false);

    const onBlur = () => {
      if (!isChanghed) return;
      table.options.meta?.updateData(index, id, value as keyof T);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      setIsChanged(true);
    };

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

function useTable<T extends FieldValues>({ columns, data, isEditable }: UseTableProps<T>) {
  const memoColumns = useMemo(() => columns, [columns]);
  const [localData, setLocalData] = useState(data || []);
  const { shouldSkip: autoResetPageIndex, skip: skipAutoResetPageIndex } = useSkipper();
  const [globalFilter, setGlobalFilter] = useState('');

  const saveDataToDB = (rowIndex: number, columnId: string, value: unknown) => {
    // Simulate an API call
    console.log(`Saving data to DB: row ${rowIndex}, column ${columnId}, value ${value}`);
  };

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
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
    autoResetPageIndex,
    meta: {
      updateData: (rowIndex, columnId, value) => {
        skipAutoResetPageIndex();
        setLocalData((old) =>
          old.map((row, index) => {
            if (index === rowIndex) {
              return {
                ...old[rowIndex],
                [columnId]: value
              };
            }
            return row;
          })
        );
        // Simulate API call to save data
        saveDataToDB(rowIndex, columnId, value);
      }
    },
    debugTable: true
  });
  return {
    table,
    globalFilter,
    setGlobalFilter
  };
}

export default useTable;
