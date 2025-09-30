'use client';

import { useMemo } from 'react';

export type SimpleBarChartProps = {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  showValues?: boolean;
  showLabels?: boolean;
  className?: string;
};

export function SimpleBarChart({
  data,
  height = 200,
  showValues = true,
  showLabels = true,
  className = '',
}: SimpleBarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value)), [data]);

  const barWidth = useMemo(() => {
    const totalBars = data.length;
    const spacing = 8;
    return `calc((100% - ${(totalBars - 1) * spacing}px) / ${totalBars})`;
  }, [data.length]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-end justify-between gap-2" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * 100;
          const color = item.color || 'var(--absd-authority)';

          return (
            <div
              key={index}
              className="flex flex-col items-center justify-end gap-2"
              style={{ width: barWidth }}
            >
              {showValues && (
                <span className="text-xs font-semibold text-[var(--absd-ink)]">
                  {item.value.toLocaleString('es-PY')}
                </span>
              )}
              <div
                className="w-full rounded-t-lg transition-all duration-500 ease-out hover:brightness-90"
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: color,
                  minHeight: item.value > 0 ? '8px' : '0',
                }}
                role="img"
                aria-label={`${item.label}: ${item.value}`}
              />
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex items-start justify-between gap-2">
          {data.map((item, index) => (
            <div
              key={index}
              className="text-center text-xs text-[rgba(15,23,42,0.65)]"
              style={{ width: barWidth }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type ComparisonBarProps = {
  label: string;
  actual: number;
  budget: number;
  formatValue?: (value: number) => string;
  className?: string;
};

export function ComparisonBar({
  label,
  actual,
  budget,
  formatValue = (v) => v.toLocaleString('es-PY'),
  className = '',
}: ComparisonBarProps) {
  const percentage = budget > 0 ? (actual / budget) * 100 : 0;
  const variance = actual - budget;
  const isOver = variance > 0;
  const isUnder = variance < 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--absd-ink)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[rgba(15,23,42,0.65)]">
            {formatValue(actual)} / {formatValue(budget)}
          </span>
          {variance !== 0 && (
            <span
              className={`text-xs font-semibold ${
                isOver ? 'text-[var(--absd-error)]' : 'text-[var(--absd-success)]'
              }`}
            >
              {isOver ? '+' : ''}
              {formatValue(variance)}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-3 w-full rounded-full bg-[var(--absd-subtle)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOver
              ? 'bg-[var(--absd-error)]'
              : isUnder
              ? 'bg-[var(--absd-warning)]'
              : 'bg-[var(--absd-success)]'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {percentage > 100 && (
          <div
            className="absolute top-0 h-full bg-[var(--absd-error)] opacity-30"
            style={{ left: '100%', width: `${percentage - 100}%` }}
          />
        )}
      </div>
    </div>
  );
}