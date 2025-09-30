'use client';

import { useMemo } from 'react';

export type MiniLineChartProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  className?: string;
};

export function MiniLineChart({
  data,
  width = 80,
  height = 24,
  color = 'var(--absd-authority)',
  strokeWidth = 2,
  showDots = false,
  className = '',
}: MiniLineChartProps) {
  const pathData = useMemo(() => {
    if (data.length < 2) return '';

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [data, width, height]);

  const dots = useMemo(() => {
    if (!showDots || data.length < 2) return [];

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    return data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return { x, y };
    });
  }, [data, width, height, showDots]);

  if (data.length < 2) {
    return <div className={className} style={{ width, height }} />;
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        dots.map((dot, index) => (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={strokeWidth}
            fill={color}
          />
        ))}
    </svg>
  );
}