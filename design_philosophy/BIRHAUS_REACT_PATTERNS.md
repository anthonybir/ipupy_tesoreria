# BIRHAUS React Patterns - IPU PY Tesorería

## Overview

This document translates BIRHAUS design principles into practical Next.js 15 + React 19 + TypeScript patterns for IPU PY Tesorería.

**Target Stack**:
- Next.js 15 (App Router)
- React 19 (Server/Client Components)
- TypeScript 5+ (Strict Mode)
- Tailwind CSS 4
- TanStack Query v5
- shadcn/ui components

---

## Principle 1: Form Serves Flow

### Pattern: Workflow-Driven Page Structure

**Anti-Pattern** (Arbitrary structure):
```tsx
// ❌ Navigation doesn't follow user workflow
export default function AdminPage() {
  return (
    <div>
      <Tabs>
        <Tab>Settings</Tab>
        <Tab>Users</Tab>
        <Tab>Reports</Tab>
        <Tab>Churches</Tab>
      </Tabs>
    </div>
  );
}
```

**BIRHAUS Pattern** (Flow-driven):
```tsx
// ✅ Structure mirrors natural workflow
export default function ReportCreationPage() {
  const [step, setStep] = useState<'income' | 'expenses' | 'summary'>('income');

  return (
    <Wizard currentStep={step}>
      <WizardStep id="income" title="Ingresos del Mes">
        <IncomeForm onNext={() => setStep('expenses')} />
      </WizardStep>

      <WizardStep id="expenses" title="Egresos del Mes">
        <ExpenseForm
          onNext={() => setStep('summary')}
          onBack={() => setStep('income')}
        />
      </WizardStep>

      <WizardStep id="summary" title="Resumen y Confirmación">
        <ReportSummary onBack={() => setStep('expenses')} />
      </WizardStep>
    </Wizard>
  );
}
```

### Pattern: Breadcrumb-Based Navigation

```tsx
// src/components/Layout/Breadcrumbs.tsx
import { usePathname } from 'next/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Map technical paths to user-friendly labels
  const labels: Record<string, string> = {
    churches: 'Iglesias',
    reports: 'Informes',
    funds: 'Fondos',
    transactions: 'Transacciones',
  };

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link href="/dashboard">Inicio</Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const label = labels[segment] || segment;

          return (
            <li key={segment} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4" />
              <Link href={href}>{label}</Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

---

## Principle 2: Honest Data Presentation

### Pattern: Transparent Metrics Display

```tsx
// src/components/Dashboard/MetricCard.tsx
interface MetricCardProps {
  label: string;
  value: number;
  previousValue?: number;
  format?: 'currency' | 'number' | 'percentage';
}

export function MetricCard({ label, value, previousValue, format = 'number' }: MetricCardProps) {
  const formattedValue = format === 'currency'
    ? formatCurrency(value)
    : value.toLocaleString('es-PY');

  const change = previousValue
    ? ((value - previousValue) / previousValue) * 100
    : null;

  return (
    <div className="p-4 border rounded-lg">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="mt-1">
        <span className="text-2xl font-semibold">{formattedValue}</span>
        {change !== null && (
          <span className={cn(
            "ml-2 text-sm",
            change > 0 ? "text-green-600" : "text-red-600"
          )}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
            <span className="ml-1 text-neutral-500">
              vs anterior ({formatCurrency(previousValue!)})
            </span>
          </span>
        )}
      </dd>
    </div>
  );
}
```

### Pattern: Chart with Full Context

```tsx
// src/components/Reports/IncomeChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function IncomeChart({ data }: { data: MonthlyReport[] }) {
  // ✅ Linear scale (not logarithmic)
  // ✅ Y-axis starts at 0 (not truncated)
  // ✅ Show actual values in tooltip
  return (
    <div>
      <LineChart width={600} height={300} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis
          domain={[0, 'auto']} // Start at 0
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => `Mes: ${label}`}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="total_income"
          stroke="var(--absd-authority)"
          name="Ingresos Totales"
        />
      </LineChart>

      {/* ✅ Show table with exact values below chart */}
      <DataTable
        data={data}
        columns={[
          { key: 'month', label: 'Mes' },
          { key: 'total_income', label: 'Ingresos', format: 'currency' },
        ]}
      />
    </div>
  );
}
```

---

## Principle 3: One Clear Action

### Pattern: Primary Action Hierarchy

```tsx
// src/components/Reports/ReportActions.tsx
interface ReportActionsProps {
  onSave: () => void;
  onCancel: () => void;
  onSaveDraft?: () => void;
  loading?: boolean;
}

export function ReportActions({
  onSave,
  onCancel,
  onSaveDraft,
  loading
}: ReportActionsProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Secondary action - subdued */}
      <Button
        variant="ghost"
        onClick={onCancel}
        disabled={loading}
      >
        Cancelar
      </Button>

      <div className="flex gap-2">
        {/* Tertiary action - minimal */}
        {onSaveDraft && (
          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={loading}
          >
            Guardar Borrador
          </Button>
        )}

        {/* ✅ PRIMARY ACTION - visually dominant */}
        <Button
          variant="primary"
          size="lg"
          onClick={onSave}
          loading={loading}
          className="min-w-[200px]"
        >
          Guardar Informe
        </Button>
      </div>
    </div>
  );
}
```

### Pattern: Visual Hierarchy Tokens

```css
/* src/styles/button-hierarchy.css */

/* PRIMARY - Dominant, unmistakable */
.button-primary {
  background: var(--absd-authority);
  color: white;
  font-size: 1.125rem;        /* 18px */
  padding: 1rem 2rem;         /* 16px 32px */
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* SECONDARY - Supporting action */
.button-secondary {
  background: transparent;
  color: var(--absd-neutral-700);
  font-size: 1rem;            /* 16px */
  padding: 0.75rem 1.5rem;    /* 12px 24px */
  border: 1px solid var(--absd-neutral-300);
}

/* TERTIARY - Minimal, unobtrusive */
.button-tertiary {
  background: transparent;
  color: var(--absd-neutral-600);
  font-size: 0.875rem;        /* 14px */
  padding: 0.5rem 1rem;       /* 8px 16px */
  text-decoration: underline;
}
```

---

## Principle 4: Progressive Disclosure

### Pattern: Expandable Details

```tsx
// src/components/Shared/ExpandableCard.tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableCardProps {
  summary: React.ReactNode;
  details: React.ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableCard({ summary, details, defaultExpanded = false }: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50"
        aria-expanded={isExpanded}
      >
        <div>{summary}</div>
        {isExpanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t">
          {details}
        </div>
      )}
    </div>
  );
}

// Usage in report summary
<ExpandableCard
  summary={
    <div>
      <h3 className="font-semibold">Total Ingresos</h3>
      <p className="text-2xl">₲ 25.400.000</p>
    </div>
  }
  details={
    <dl className="grid grid-cols-2 gap-2 mt-2">
      <dt>Diezmos:</dt>
      <dd className="text-right">₲ 15.234.000</dd>
      <dt>Ofrendas:</dt>
      <dd className="text-right">₲ 8.450.000</dd>
      <dt>Misiones:</dt>
      <dd className="text-right">₲ 1.716.000</dd>
    </dl>
  }
/>
```

### Pattern: Infinite Scroll with Load More

```tsx
// src/components/Transactions/TransactionList.tsx
import { useInfiniteQuery } from '@tanstack/react-query';

export function TransactionList({ fundId }: { fundId: number }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['transactions', fundId],
    queryFn: ({ pageParam = 0 }) => fetchTransactions(fundId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0
  });

  return (
    <div>
      {/* ✅ Show recent transactions immediately */}
      {data?.pages.map((page) => (
        page.transactions.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} />
        ))
      ))}

      {/* ✅ Load more on demand, not auto-scroll */}
      {hasNextPage && (
        <Button
          variant="ghost"
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
          className="w-full mt-4"
        >
          Cargar Más Transacciones
        </Button>
      )}
    </div>
  );
}
```

---

## Principle 5: Undo Over Confirm

### Pattern: Reversible Delete with Toast

```tsx
// src/hooks/useReversibleDelete.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useReversibleDelete<T>(
  mutationFn: (id: number) => Promise<void>,
  queryKey: string[],
  itemName: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (id) => {
      // Snapshot current data
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically remove from UI
      queryClient.setQueryData(queryKey, (old: T[] | undefined) =>
        old?.filter((item: any) => item.id !== id)
      );

      return { previous };
    },
    onSuccess: (_, id, context) => {
      toast.success(`${itemName} eliminado`, {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            // Restore from snapshot
            queryClient.setQueryData(queryKey, context.previous);
            await restoreItem(id); // API call to restore
          }
        },
        duration: 5000 // 5 seconds to undo
      });
    },
    onError: (err, id, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKey, context.previous);
      toast.error('Error al eliminar');
    }
  });
}

// Usage
const deleteMutation = useReversibleDelete(
  deleteTransaction,
  ['transactions', fundId],
  'Transacción'
);

<Button onClick={() => deleteMutation.mutate(transaction.id)}>
  Eliminar
</Button>
```

### Pattern: Draft Auto-Save

```tsx
// src/hooks/useAutoSave.ts
import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { debounce } from 'lodash';

export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  delay = 2000
) {
  const { mutate } = useMutation({ mutationFn: saveFn });

  const debouncedSave = useRef(
    debounce((data: T) => {
      mutate(data);
      toast.info('Borrador guardado automáticamente');
    }, delay)
  ).current;

  useEffect(() => {
    if (data) {
      debouncedSave(data);
    }
  }, [data, debouncedSave]);

  return null;
}

// Usage in form
function ReportForm() {
  const [formData, setFormData] = useState<ReportData>(initialData);

  useAutoSave(formData, saveDraft, 3000);

  return (
    <form>
      {/* ✅ No "Save Draft" button needed */}
      {/* Form fields update formData */}
    </form>
  );
}
```

---

## Principle 6: Accessibility = Dignity

### Pattern: Accessible Form Field

```tsx
// src/components/Forms/FormField.tsx
import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export function FormField({
  label,
  error,
  helpText,
  required,
  ...inputProps
}: FormFieldProps) {
  const id = useId();
  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-neutral-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="requerido">*</span>}
      </label>

      <input
        id={id}
        aria-describedby={helpTextId}
        aria-invalid={error ? 'true' : 'false'}
        aria-errormessage={errorId}
        className={cn(
          "w-full px-3 py-2 border rounded-md",
          error && "border-red-500"
        )}
        {...inputProps}
      />

      {helpText && (
        <p id={helpTextId} className="text-sm text-neutral-600">
          {helpText}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Pattern: Keyboard-Navigable Modal

```tsx
// src/components/Shared/Modal.tsx
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on open
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <FocusTrap>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div
          className="bg-white p-6 rounded-lg max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 id="modal-title" className="text-xl font-semibold">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-1 hover:bg-neutral-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {children}
        </div>
      </div>
    </FocusTrap>
  );
}
```

---

## Principle 7: Bilingual by Design

### Pattern: i18n-Ready Component

```tsx
// src/lib/i18n/translations.ts
export const translations = {
  es: {
    reports: {
      title: 'Informes Mensuales',
      createNew: 'Crear Nuevo Informe',
      status: {
        draft: 'Borrador',
        submitted: 'Enviado',
        approved: 'Aprobado'
      },
      fields: {
        month: 'Mes',
        year: 'Año',
        tithes: 'Diezmos',
        offerings: 'Ofrendas'
      }
    }
  },
  // Future: English, Guaraní
  en: {
    reports: {
      title: 'Monthly Reports',
      createNew: 'Create New Report',
      // ...
    }
  }
} as const;

// Type-safe translation hook
export function useTranslation(namespace: keyof typeof translations.es) {
  const locale = 'es'; // From context or localStorage
  return translations[locale][namespace];
}

// Usage in component
export function ReportList() {
  const t = useTranslation('reports');

  return (
    <div>
      <h1>{t.title}</h1>
      <Button>{t.createNew}</Button>
    </div>
  );
}
```

### Pattern: Locale-Aware Formatting

```tsx
// src/lib/utils/formatting.ts
import { useLocale } from '@/hooks/useLocale';

export function useFormatting() {
  const locale = useLocale(); // 'es-PY' default

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat(locale).format(num);
  };

  return { formatCurrency, formatDate, formatNumber };
}
```

---

## Principle 8: Performance is UX

### Pattern: Optimistic UI Updates

```tsx
// src/hooks/useOptimisticMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useOptimisticUpdate<T>(
  mutationFn: (data: T) => Promise<T>,
  queryKey: string[],
  updateFn: (old: T[] | undefined, newData: T) => T[]
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previous = queryClient.getQueryData<T[]>(queryKey);

      // Optimistically update
      queryClient.setQueryData<T[]>(queryKey, (old) =>
        updateFn(old, newData)
      );

      return { previous };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    }
  });
}

// Usage
const updateReport = useOptimisticUpdate(
  api.updateReport,
  ['reports', reportId],
  (old, updated) => old?.map(r => r.id === updated.id ? updated : r) ?? []
);
```

### Pattern: Virtualized Data Table

```tsx
// src/components/Shared/VirtualizedTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface VirtualizedTableProps<T> {
  data: T[];
  columns: { key: keyof T; label: string }[];
  rowHeight?: number;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 48
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5 // Render 5 extra rows for smooth scrolling
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = data[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
              className="flex border-b"
            >
              {columns.map((col) => (
                <div key={String(col.key)} className="flex-1 px-4 py-2">
                  {String(row[col.key])}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Principle 9: Consistency via Tokens

### Pattern: Token-Based Component

```tsx
// src/components/ui/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // Base styles using tokens
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[var(--absd-authority)] text-white hover:bg-[var(--absd-authority)]/90",
        secondary: "bg-[var(--absd-neutral-100)] text-[var(--absd-neutral-900)] hover:bg-[var(--absd-neutral-200)]",
        destructive: "bg-[var(--absd-urgent)] text-white hover:bg-[var(--absd-urgent)]/90",
        ghost: "hover:bg-[var(--absd-neutral-100)] hover:text-[var(--absd-neutral-900)]",
      },
      size: {
        sm: "h-9 px-[var(--space-2)] text-sm",
        md: "h-10 px-[var(--space-3)] text-base",
        lg: "h-12 px-[var(--space-4)] text-lg",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
```

---

## Principle 10: Auditability & Transparency

### Pattern: Audit Trail Hook

```tsx
// src/hooks/useAuditedMutation.ts
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export function useAuditedMutation<TData, TVariables>(
  mutationFn: (vars: TVariables, auth: AuthContext) => Promise<TData>,
  action: string,
  resourceType: string
) {
  const { auth } = useAuth();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!auth) throw new Error('Not authenticated');

      // Execute mutation with audit context
      const result = await mutationFn(variables, auth);

      // Log action (handled server-side in executeWithContext)
      return result;
    }
  });
}

// Usage
const updateReportMutation = useAuditedMutation(
  api.updateReport,
  'update',
  'monthly_report'
);
```

### Pattern: Activity Timeline

```tsx
// src/components/Admin/ActivityTimeline.tsx
export function ActivityTimeline({ resourceId, resourceType }: {
  resourceId: number;
  resourceType: string;
}) {
  const { data: activities } = useQuery({
    queryKey: ['activity', resourceType, resourceId],
    queryFn: () => fetchActivityLog(resourceType, resourceId)
  });

  return (
    <div className="space-y-4">
      {activities?.map((activity) => (
        <div key={activity.id} className="flex gap-4">
          <div className="flex-shrink-0">
            <ActivityIcon action={activity.action} />
          </div>
          <div className="flex-1">
            <p className="font-medium">{activity.user_name}</p>
            <p className="text-sm text-neutral-600">
              {activity.action_label} - {formatDate(activity.created_at)}
            </p>
            {activity.details && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-blue-600">
                  Ver detalles
                </summary>
                <pre className="mt-2 p-2 bg-neutral-50 rounded">
                  {JSON.stringify(activity.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Server Component Patterns

### Pattern: Data Fetching in Server Component

```tsx
// app/reports/[id]/page.tsx (Server Component)
import { getAuthFromCookies } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db-admin';
import { ReportView } from '@/components/Reports/ReportView';

interface PageProps {
  params: { id: string };
}

export default async function ReportPage({ params }: PageProps) {
  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect('/login');
  }

  // ✅ Fetch data server-side with RLS context
  const report = await executeWithContext(auth, async (client) => {
    const result = await client.query(
      'SELECT * FROM monthly_reports WHERE id = $1',
      [params.id]
    );
    return result.rows[0];
  });

  if (!report) {
    notFound();
  }

  // ✅ Pass data to Client Component
  return <ReportView report={report} />;
}
```

### Pattern: Mixed Server/Client Components

```tsx
// app/dashboard/page.tsx (Server Component)
import { Suspense } from 'react';
import { getAuthFromCookies } from '@/lib/auth-supabase';
import { DashboardMetrics } from '@/components/Dashboard/Metrics'; // Client
import { RecentReports } from '@/components/Dashboard/RecentReports'; // Server
import { QuickActions } from '@/components/Dashboard/QuickActions'; // Client

export default async function DashboardPage() {
  const auth = await getAuthFromCookies();

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* ✅ Client component for interactivity */}
      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardMetrics auth={auth} />
      </Suspense>

      {/* ✅ Server component for data fetching */}
      <Suspense fallback={<ReportsSkeleton />}>
        <RecentReports auth={auth} />
      </Suspense>

      {/* ✅ Client component for user actions */}
      <QuickActions />
    </div>
  );
}
```

---

## Testing BIRHAUS Patterns

### Pattern: Accessibility Testing

```tsx
// src/components/Reports/ReportForm.test.tsx
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ReportForm } from './ReportForm';

expect.extend(toHaveNoViolations);

describe('ReportForm - Accessibility', () => {
  it('should have no WCAG violations', async () => {
    const { container } = render(<ReportForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', () => {
    render(<ReportForm />);
    const firstInput = screen.getByLabelText(/monto/i);
    firstInput.focus();
    expect(firstInput).toHaveFocus();

    // Tab to next field
    userEvent.tab();
    expect(screen.getByLabelText(/descripción/i)).toHaveFocus();
  });
});
```

---

**Last Updated**: October 2025
**See Also**: [BIRHAUS Principles](./BIRHAUS_PRINCIPLES.md)
