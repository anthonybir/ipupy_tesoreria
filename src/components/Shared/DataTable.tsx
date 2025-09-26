'use client';

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';

export type Alignment = 'left' | 'center' | 'right';

export type DataTableColumn<T> = {
  id: string;
  header: string;
  headerSrOnly?: boolean;
  render: (item: T) => ReactNode;
  align?: Alignment;
  className?: string;
  width?: string;
};

export type DataTableProps<T> = {
  data: T[];
  columns: Array<DataTableColumn<T>>;
  caption?: string;
  getRowId?: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  emptyContent?: ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  virtualized?: boolean;
  itemHeight?: number;
  maxHeight?: number;
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

function SkeletonRow({ columns }: { columns: Array<DataTableColumn<unknown>> }) {
  return (
    <tr>
      {columns.map((column) => (
        <td key={column.id} className={`${baseCellClass} ${alignmentClassName(column.align)}`}>
          <div className="h-3 w-full animate-pulse rounded-full bg-[var(--absd-subtle)]" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  data,
  columns,
  caption,
  getRowId,
  onRowClick,
  emptyContent,
  loading = false,
  skeletonRows = 5,
  virtualized = false,
  itemHeight = 56,
  maxHeight = 420,
}: DataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(maxHeight);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event instanceof MediaQueryList ? event.matches : event.matches);
    };

    update(mediaQuery);
    const listener = (event: MediaQueryListEvent) => update(event);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (!virtualized) {
      return;
    }
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setContainerHeight(entry.contentRect.height || maxHeight);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [virtualized, maxHeight]);

  const virtualizationEnabled = virtualized && data.length * itemHeight > containerHeight;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!virtualizationEnabled) {
      return;
    }
    setScrollTop(event.currentTarget.scrollTop);
  };

  const startIndex = virtualizationEnabled ? Math.max(0, Math.floor(scrollTop / itemHeight) - 2) : 0;
  const visibleCount = virtualizationEnabled
    ? Math.ceil(containerHeight / itemHeight) + 4
    : data.length;
  const endIndex = virtualizationEnabled ? Math.min(data.length, startIndex + visibleCount) : data.length;
  const visibleRows = virtualizationEnabled ? data.slice(startIndex, endIndex) : data;
  const offsetTop = virtualizationEnabled ? startIndex * itemHeight : 0;
  const offsetBottom = virtualizationEnabled
    ? Math.max(0, data.length * itemHeight - offsetTop - visibleRows.length * itemHeight)
    : 0;

  if (!data.length && !loading) {
    return (
      <div className="absd-card rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-6 py-12 text-center text-sm text-[rgba(15,23,42,0.6)]">
        {emptyContent ?? 'No hay datos para mostrar.'}
      </div>
    );
  }

  if (isMobile) {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: skeletonRows }).map((_, index) => (
            <div key={`mobile-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl bg-[var(--absd-subtle)]" />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3" role="region" aria-live="polite">
        {visibleRows.map((item, index) => {
          const actualIndex = virtualizationEnabled ? startIndex + index : index;
          const rowId = getRowId ? getRowId(item, actualIndex) : actualIndex;
          const clickableProps = onRowClick
            ? {
                onClick: () => onRowClick(item),
                role: 'button' as const,
                tabIndex: 0,
                className:
                  'rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] p-4 text-left shadow-sm transition hover:border-[var(--absd-authority)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]',
              }
            : {
                className:
                  'rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] p-4 shadow-sm',
              };

          return (
            <div key={rowId} {...clickableProps}>
              <dl className="space-y-2">
                {columns.map((column) => (
                  <div key={column.id} className="flex items-start justify-between gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.55)]">
                      {column.header}
                    </dt>
                    <dd className="text-sm text-[var(--absd-ink)]">{column.render(item)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm"
      role="region"
      aria-live="polite"
    >
      <div
        ref={containerRef}
        onScroll={virtualizationEnabled ? handleScroll : undefined}
        style={virtualizationEnabled ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table className="min-w-full divide-y divide-[var(--absd-border)]">
          {caption ? (
            <caption className="px-6 py-4 text-left text-sm font-medium text-[var(--absd-ink)]">
              {caption}
            </caption>
          ) : null}
          <thead className="bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={`${alignmentClassName(column.align)} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)] ${column.className ?? ''}`.trim()}
                >
                  {column.headerSrOnly ? <span className="sr-only">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--absd-border)]">
            {loading &&
              Array.from({ length: skeletonRows }).map((_, index) => (
                <SkeletonRow key={`skeleton-${index}`} columns={columns as Array<DataTableColumn<unknown>>} />
              ))}

            {!loading && virtualizationEnabled && offsetTop > 0 && (
              <tr aria-hidden style={{ height: offsetTop }}>
                <td colSpan={columns.length} />
              </tr>
            )}

            {!loading &&
              visibleRows.map((item, index) => {
                const actualIndex = virtualizationEnabled ? startIndex + index : index;
                const rowId = getRowId ? getRowId(item, actualIndex) : actualIndex;
                const handleClick = onRowClick ? () => onRowClick(item) : undefined;

                return (
                  <tr
                    key={rowId}
                    onClick={handleClick}
                    className={`transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)]' : ''
                    }`}
                    style={virtualizationEnabled ? { height: itemHeight } : undefined}
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

            {!loading && virtualizationEnabled && offsetBottom > 0 && (
              <tr aria-hidden style={{ height: offsetBottom }}>
                <td colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
