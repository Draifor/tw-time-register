import React from 'react';
import {
  Column,
  Table,
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  RowData,
  Row
} from '@tanstack/react-table';
import { makeData, Person } from './makeData';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: keyof TData) => void;
  }
}

const defaultColumn = (isEditable: boolean): Partial<ColumnDef<Person>> => ({
  cell: ({ getValue, row: { index }, column: { id }, table }) => {
    const initialValue = getValue();
    const [value, setValue] = React.useState(initialValue);
    const [isChanghed, setIsChanged] = React.useState(false);

    const onBlur = () => {
      if (!isChanghed) return;
      table.options.meta?.updateData(index, id, value as keyof Person);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      setIsChanged(true);
    };

    React.useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    return isEditable ? (
      <input
        type={typeof initialValue === 'number' ? 'number' : 'text'}
        value={value as keyof Person}
        onChange={onChange}
        onBlur={onBlur}
      />
    ) : (
      value
    );
  }
});

function useSkipper() {
  const shouldSkipRef = React.useRef(true);
  const shouldSkip = shouldSkipRef.current;

  const skip = React.useCallback(() => {
    shouldSkipRef.current = false;
  }, []);

  React.useEffect(() => {
    shouldSkipRef.current = true;
  });

  return [shouldSkip, skip] as const;
}

function Filter({ column, table }: { column: Column<any, any>; table: Table<any> }) {
  const firstValue = table.getPreFilteredRowModel().flatRows[0]?.getValue(column.id);

  const columnFilterValue = column.getFilterValue();

  return typeof firstValue === 'number' ? (
    <div className="flex space-x-2">
      <input
        type="number"
        value={(columnFilterValue as [number, number])?.[0] ?? ''}
        onChange={(e) => column.setFilterValue((old: [number, number]) => [e.target.value, old?.[1]])}
        placeholder="Min"
        className="w-24 border shadow rounded"
      />
      <input
        type="number"
        value={(columnFilterValue as [number, number])?.[1] ?? ''}
        onChange={(e) => column.setFilterValue((old: [number, number]) => [old?.[0], e.target.value])}
        placeholder="Max"
        className="w-24 border shadow rounded"
      />
    </div>
  ) : (
    <input
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(e) => column.setFilterValue(e.target.value)}
      placeholder="Search..."
      className="w-36 border shadow rounded"
    />
  );
}

function App({ isEditable }: { isEditable?: boolean }) {
  const rerender = React.useReducer(() => ({}), {})[1];

  const saveDataToDB = (rowIndex: number, columnId: string, value: unknown) => {
    // Simulate an API call
    console.log(`Saving data to DB: row ${rowIndex}, column ${columnId}, value ${value}`);
  };

  const deleteDataFromDB = (rowIndex: number) => {
    console.log(`Deleting data from DB: row ${rowIndex}`);
  };

  const [data, setData] = React.useState(() => makeData(1000));
  const refreshData = () => setData(() => makeData(1000));

  const deleteRow = (rowIndex: number) => {
    setData((old) => old.filter((_, index) => index !== rowIndex));
    // Simulate API call to delete data
    deleteDataFromDB(rowIndex);
  };

  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  interface RowPerson {
    row: Row<Person>;
  }

  function handleDeleteRow({ row }: RowPerson) {
    return <button onClick={() => deleteRow(row.index)}>Delete</button>;
  }

  interface ColumnFooterProps {
    column: Column<any, any>;
  }

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        header: 'Name',
        footer: (props: ColumnFooterProps) => props.column.id,
        columns: [
          {
            accessorKey: 'firstName',
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            accessorFn: (row: Person) => row.lastName,
            id: 'lastName',
            header: () => 'Last Name',
            footer: (props: ColumnFooterProps) => props.column.id
          }
        ]
      },
      {
        header: 'Info',
        footer: (props: ColumnFooterProps) => props.column.id,
        columns: [
          {
            accessorKey: 'age',
            header: () => 'Age',
            footer: (props: ColumnFooterProps) => props.column.id
          },
          {
            header: 'More Info',
            columns: [
              {
                accessorKey: 'visits',
                header: () => 'Visits',
                footer: (props: ColumnFooterProps) => props.column.id
              },
              {
                accessorKey: 'status',
                header: 'Status',
                footer: (props: ColumnFooterProps) => props.column.id
              },
              {
                accessorKey: 'progress',
                header: 'Profile Progress',
                footer: (props: ColumnFooterProps) => props.column.id
              }
            ]
          }
        ]
      },
      ...(isEditable
        ? [
            {
              header: 'Actions',
              footer: (props: ColumnFooterProps) => props.column.id,
              columns: [
                {
                  id: 'delete',
                  header: 'Delete',
                  cell: handleDeleteRow
                }
              ]
            }
          ]
        : [])
    ],
    [isEditable]
  );

  const table = useReactTable({
    data,
    columns,
    defaultColumn: defaultColumn(isEditable ?? false),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex,
    meta: {
      updateData: (rowIndex, columnId, value) => {
        skipAutoResetPageIndex();
        setData((old) =>
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

  const addRow = () => {
    setData((old) => [
      ...old,
      {
        firstName: '',
        lastName: '',
        age: 0,
        visits: 0,
        status: 'single',
        progress: 0
      }
    ]);
  };

  return (
    <>
      {isEditable && <button onClick={addRow}>Add Row</button>}
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : (
                    <div>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanFilter() ? (
                        <div>
                          <Filter column={header.column} table={table} />
                        </div>
                      ) : null}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
          {'<<'}
        </button>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          {'<'}
        </button>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          {'>'}
        </button>
        <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
          {'>>'}
        </button>
        <span>
          Page{' '}
          <strong>
            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </strong>{' '}
        </span>
        <span>
          | Go to page:{' '}
          <input
            type="number"
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0;
              table.setPageIndex(page);
            }}
            style={{ width: '50px' }}
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value));
          }}
        >
          {[10, 20, 30, 40, 50].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
      <div>{table.getRowModel().rows.length} Rows</div>
      <button onClick={rerender}>Force Rerender</button>
      <button onClick={refreshData}>Refresh Data</button>
    </>
  );
}

export default App;
