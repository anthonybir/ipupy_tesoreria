'use client';

export type ProgressBarProps = {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const colorMap = {
  primary: 'bg-[var(--absd-authority)]',
  success: 'bg-[var(--absd-success)]',
  warning: 'bg-[var(--absd-warning)]',
  error: 'bg-[var(--absd-error)]',
  info: 'bg-[var(--absd-info)]',
};

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = false,
  color = 'primary',
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const displayValue = isNaN(percentage) ? 0 : percentage;

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-medium text-[var(--absd-ink)]">{label}</span>}
          {showPercentage && (
            <span className="text-[rgba(15,23,42,0.65)]">
              {displayValue.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full rounded-full bg-[var(--absd-subtle)] overflow-hidden ${sizeMap[size]}`}>
        <div
          className={`${colorMap[color]} ${sizeMap[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${displayValue}%` }}
          role="progressbar"
          aria-valuenow={displayValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export type MultiProgressBarProps = {
  segments: Array<{
    value: number;
    color: 'primary' | 'success' | 'warning' | 'error' | 'info';
    label: string;
  }>;
  max: number;
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
  className?: string;
};

export function MultiProgressBar({
  segments,
  max,
  size = 'md',
  showLegend = true,
  className = '',
}: MultiProgressBarProps) {
  const percentages = segments.map((seg) => (seg.value / max) * 100);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className={`w-full rounded-full bg-[var(--absd-subtle)] overflow-hidden flex ${sizeMap[size]}`}>
        {segments.map((segment, index) => (
          <div
            key={index}
            className={`${colorMap[segment.color]} ${sizeMap[size]} transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${percentages[index]}%` }}
            role="progressbar"
            aria-valuenow={percentages[index]}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={segment.label}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-3">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div className={`w-3 h-3 rounded-sm ${colorMap[segment.color]}`} />
              <span className="font-medium text-[var(--absd-ink)]">{segment.label}</span>
              <span className="text-[rgba(15,23,42,0.65)]">
                ({percentages[index].toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}