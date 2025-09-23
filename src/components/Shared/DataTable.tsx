'use client';

import type { ReactNode } from 'react';

type Alignment = 'left' | 'center' | 'right';

type DataTableColumn<T> = {
  id: string;
  header: string;
  render: (item: T) => ReactNode;
  align?: Alignment;
  className?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Array<DataTableColumn<T>>;
  caption?: string;
  getRowId?: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  emptyContent?: ReactNode;
};

const alignmentClassName = (align: Alignment = 'left') => {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    default:
      return 'text-left';
  }
};

const baseCellClass = 'px-4 py-3 whitespace-nowrap text-sm text-slate-600';

export function DataTable<T>({
  data,
  columns,
  caption,
  getRowId,
  onRowClick,
  emptyContent,
}: DataTableProps<T>) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        {emptyContent ?? 'No hay datos para mostrar.'}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        {caption ? (
          <caption className="px-6 py-4 text-left text-sm font-medium text-slate-700">
            {caption}
          </caption>
        ) : null}
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`${alignmentClassName(column.align)} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${column.className ?? ''}`.trim()}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, index) => {
            const rowId = getRowId ? getRowId(item, index) : index;
            const handleClick = onRowClick
              ? () => {
                  onRowClick(item);
                }
              : undefined;

            return (
              <tr
                key={rowId}
                onClick={handleClick}
                className={`transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-indigo-50/50' : ''
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`${baseCellClass} ${alignmentClassName(column.align)} ${column.className ?? ''}`.trim()}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
