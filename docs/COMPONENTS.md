# Component Library Guide - IPU PY Tesorería

## Overview

IPU PY Tesorería uses a component-based architecture built on:
- **shadcn/ui** - Base UI primitives (Radix UI + Tailwind)
- **Custom Components** - Business logic components
- **BIRHAUS Design System** - Minimalist yet powerful philosophy

**Component Structure**:
```
src/components/
├── ui/              # shadcn/ui base components
├── Shared/          # Reusable utility components
├── Layout/          # Page layout components
├── Auth/            # Authentication components
├── Reports/         # Monthly report components
├── FundEvents/      # Event planning components
├── Providers/       # Provider management
├── Churches/        # Church management
├── Ledger/          # Transaction ledger
├── Admin/           # Admin-only components
└── ...
```

---

## UI Foundation (shadcn/ui)

### Button Component

**File**: `src/components/ui/button.tsx`

**Variants**:
- `primary` - Main actions (ABSD Authority Blue)
- `secondary` - Supporting actions
- `destructive` - Dangerous actions (delete, cancel)
- `ghost` - Minimal actions
- `outline` - Bordered buttons

**Sizes**: `sm`, `md` (default), `lg`

**Usage**:
```tsx
import { Button } from '@/components/ui/button';

// Primary action
<Button variant="primary" size="lg" onClick={handleSave}>
  Guardar Informe
</Button>

// Secondary action
<Button variant="secondary" onClick={handleCancel}>
  Cancelar
</Button>

// Destructive action
<Button variant="destructive" onClick={handleDelete}>
  Eliminar
</Button>

// Loading state
<Button loading={isSubmitting}>
  {isSubmitting ? 'Guardando...' : 'Guardar'}
</Button>
```

**BIRHAUS Alignment**: Principle #3 (One Clear Action) - Primary button always visually dominant

---

### Input Component

**File**: `src/components/ui/input.tsx`

**Types**: `text`, `email`, `number`, `date`, `password`

**Usage**:
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-1">
  <Label htmlFor="email">Correo Electrónico</Label>
  <Input
    id="email"
    type="email"
    placeholder="correo@ipupy.org.py"
    required
  />
</div>
```

**Accessibility**: Automatically includes `aria-invalid` when error prop provided

---

### CurrencyInput Component

**File**: `src/components/ui/currency-input.tsx`

**Purpose**: Paraguay Guaraní (₲) input with formatting

**Usage**:
```tsx
import { CurrencyInput } from '@/components/ui/currency-input';

<CurrencyInput
  label="Diezmos"
  value={diezmos}
  onChange={setDiezmos}
  required
/>

// Displays: ₲ 15.234.000
// Stores: 15234000 (number)
```

**Features**:
- Auto-formats with thousand separators
- Prevents non-numeric input
- Removes formatting on submit
- Paraguay-specific formatting

---

### Dialog Component

**File**: `src/components/ui/dialog.tsx`

**Purpose**: Modal dialogs with accessibility

**Usage**:
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirmar Eliminación</DialogTitle>
      <DialogDescription>
        Esta acción no se puede deshacer.
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Eliminar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Accessibility**: 
- Focus trap (⚠️ needs restoration)
- Escape to close
- ARIA attributes

---

### Select Component

**File**: `src/components/ui/select.tsx`

**Usage**:
```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';

<Select value={month} onValueChange={setMonth}>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar mes" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Enero</SelectItem>
    <SelectItem value="2">Febrero</SelectItem>
    {/* ... */}
  </SelectContent>
</Select>
```

---

### Card Component

**File**: `src/components/ui/card.tsx`

**Purpose**: Container for grouped content

**Usage**:
```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Total Ingresos</CardTitle>
    <CardDescription>Mes de Enero 2025</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">₲ 15.234.000</p>
  </CardContent>
  <CardFooter>
    <Button variant="outline">Ver Detalles</Button>
  </CardFooter>
</Card>
```

---

### Alert Component

**File**: `src/components/ui/alert.tsx`

**Variants**: `default`, `destructive`, `success`, `warning`

**Usage**:
```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    No se pudo guardar el informe. Intente nuevamente.
  </AlertDescription>
</Alert>
```

---

## Shared Components

### DataTable Component

**File**: `src/components/Shared/DataTable.tsx`

**Purpose**: Reusable table with pagination, sorting, filtering

**Features**:
- Server-side pagination
- Column sorting
- Global search
- Row selection
- Responsive design

**Usage**:
```tsx
import { DataTable } from '@/components/Shared/DataTable';

const columns = [
  {
    accessorKey: 'name',
    header: 'Nombre',
  },
  {
    accessorKey: 'amount',
    header: 'Monto',
    cell: ({ row }) => formatCurrency(row.getValue('amount'))
  }
];

<DataTable
  columns={columns}
  data={reports}
  pageSize={10}
  searchPlaceholder="Buscar informes..."
/>
```

**BIRHAUS Alignment**: Principle #4 (Progressive Disclosure) - Shows summary, expands on demand

---

### LoadingSpinner Component

**File**: `src/components/Shared/LoadingSpinner.tsx`

**Variants**: `sm`, `md`, `lg`

**Usage**:
```tsx
import { LoadingSpinner } from '@/components/Shared/LoadingSpinner';

// Full page loading
<div className="flex justify-center items-center h-screen">
  <LoadingSpinner size="lg" />
</div>

// Inline loading
<Button disabled>
  <LoadingSpinner size="sm" className="mr-2" />
  Cargando...
</Button>
```

---

### StatusBadge Component

**File**: `src/components/Shared/StatusBadge.tsx`

**Purpose**: Display status with color coding

**Statuses**:
- `draft` - Gray
- `submitted` - Blue
- `approved` - Green
- `rejected` - Red
- `pending_revision` - Yellow

**Usage**:
```tsx
import { StatusBadge } from '@/components/Shared/StatusBadge';

<StatusBadge status={report.status} />
// Renders: "Borrador" (gray badge)
```

---

### EmptyState Component

**File**: `src/components/Shared/EmptyState.tsx`

**Purpose**: Placeholder when no data available

**Usage**:
```tsx
import { EmptyState } from '@/components/Shared/EmptyState';

<EmptyState
  icon={FileIcon}
  title="No hay informes"
  description="Crea tu primer informe mensual para comenzar"
  action={
    <Button onClick={() => router.push('/reports/new')}>
      Crear Informe
    </Button>
  }
/>
```

---

## Layout Components

### AppLayout Component

**File**: `src/components/Layout/AppLayout.tsx`

**Purpose**: Main application shell (header, sidebar, content)

**Usage**:
```tsx
import { AppLayout } from '@/components/Layout/AppLayout';

export default function DashboardPage() {
  return (
    <AppLayout>
      <h1>Panel de Control</h1>
      {/* Page content */}
    </AppLayout>
  );
}
```

**Structure**:
```tsx
<div className="flex h-screen">
  <Sidebar />
  <div className="flex-1 flex flex-col">
    <Header />
    <main className="flex-1 overflow-auto p-6">
      {children}
    </main>
  </div>
</div>
```

---

### MainNav Component

**File**: `src/components/Layout/MainNav.tsx`

**Purpose**: Primary navigation with role-based visibility

**Features**:
- Role-based menu items
- Active state highlighting
- Icon + label
- Responsive (collapses to icons on mobile)

**Menu Items**:
```tsx
const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, roles: ['all'] },
  { href: '/reports', label: 'Informes', icon: FileText, roles: ['admin', 'treasurer', 'pastor'] },
  { href: '/churches', label: 'Iglesias', icon: Church, roles: ['admin', 'district_supervisor'] },
  { href: '/funds', label: 'Fondos', icon: Wallet, roles: ['admin', 'treasurer', 'fund_director'] },
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
];
```

---

### UserMenu Component

**File**: `src/components/Layout/UserMenu.tsx`

**Purpose**: User profile dropdown

**Features**:
- User name + email
- Role badge
- Logout action
- Theme toggle (future)

**Usage**:
```tsx
import { UserMenu } from '@/components/Layout/UserMenu';

// In Header component
<UserMenu user={currentUser} />
```

---

## Feature Components

### Reports Components

#### ReportForm Component

**File**: `src/components/Reports/ReportForm.tsx`

**Purpose**: Monthly report creation/editing

**Sections**:
1. **Income Section** (Ingresos)
   - Diezmos, Ofrendas, etc.
   - Auto-calculates total_entradas

2. **Expenses Section** (Egresos)
   - Honorarios, utilities, etc.
   - Auto-calculates fondo_nacional (10% diezmos)

3. **National Fund Section** (Fondo Nacional)
   - Direct offerings
   - Auto-calculates total_fondo_nacional

4. **Bank Deposit Section** (Depósito Bancario)
   - Date, receipt number, amount
   - File upload for receipt

**Usage**:
```tsx
import { ReportForm } from '@/components/Reports/ReportForm';

<ReportForm
  churchId={church.id}
  month={currentMonth}
  year={currentYear}
  onSuccess={() => router.push('/reports')}
/>
```

**Form Validation**:
```tsx
const schema = z.object({
  diezmos: z.number().min(0),
  ofrendas: z.number().min(0),
  // ... other fields
  fecha_deposito: z.date(),
  numero_deposito: z.string().min(1),
  monto_depositado: z.number().min(0)
});
```

#### ReportApprovalDialog Component

**File**: `src/components/Reports/ReportApprovalDialog.tsx`

**Purpose**: Admin report approval workflow

**Usage**:
```tsx
import { ReportApprovalDialog } from '@/components/Reports/ReportApprovalDialog';

<ReportApprovalDialog
  report={selectedReport}
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  onApprove={handleApprove}
  onReject={handleReject}
/>
```

---

### Fund Events Components

#### EventForm Component

**File**: `src/components/FundEvents/EventForm.tsx`

**Purpose**: Create/edit fund events

**Sections**:
1. **Basic Info**: Name, date, description
2. **Budget Manager**: Income/expense line items
3. **Actuals Manager**: Post-event actual amounts

**Workflow States**:
- **Draft**: Fund director editing
- **Submitted**: Awaiting treasurer approval
- **Approved**: Transactions created
- **Rejected**: Needs revision

**Usage**:
```tsx
import { EventForm } from '@/components/FundEvents/EventForm';

<EventForm
  fundId={selectedFund}
  onSuccess={() => router.push('/events')}
/>
```

#### BudgetManager Component

**File**: `src/components/FundEvents/BudgetManager.tsx`

**Purpose**: Manage event budget line items

**Features**:
- Add income/expense categories
- Budget amount per line item
- Auto-calculate event totals
- Inline editing

**Usage**:
```tsx
import { BudgetManager } from '@/components/FundEvents/BudgetManager';

<BudgetManager
  eventId={event.id}
  lineItems={event.line_items}
  onUpdate={refetch}
  editable={event.status === 'draft'}
/>
```

#### ActualsManager Component

**File**: `src/components/FundEvents/ActualsManager.tsx`

**Purpose**: Record actual income/expenses post-event

**Features**:
- Shows budget vs actuals
- Variance calculation
- Only editable after event approved

**Usage**:
```tsx
import { ActualsManager } from '@/components/FundEvents/ActualsManager';

<ActualsManager
  eventId={event.id}
  lineItems={event.line_items}
  editable={event.status === 'approved' && new Date() > event.event_date}
/>
```

---

### Provider Components

#### ProviderSelector Component

**File**: `src/components/Providers/ProviderSelector.tsx`

**Purpose**: Autocomplete provider search

**Features**:
- Search by name or RUC
- Create new provider inline
- RUC deduplication
- Special providers (ANDE, ESSAP) first

**Usage**:
```tsx
import { ProviderSelector } from '@/components/Providers/ProviderSelector';

<ProviderSelector
  value={selectedProvider}
  onChange={setSelectedProvider}
  categoria="servicios_publicos"
/>
```

**Autocomplete Logic**:
```tsx
const { data: providers } = useQuery({
  queryKey: ['providers', searchTerm],
  queryFn: () => searchProviders(searchTerm),
  enabled: searchTerm.length >= 2
});
```

#### AddProviderDialog Component

**File**: `src/components/Providers/AddProviderDialog.tsx`

**Purpose**: Create new provider

**Fields**:
- RUC (validated, unique)
- Nombre
- Tipo Identificación (RUC, NIS, ISSAN, CI)
- Categoría
- Contacto (optional)

**Validation**:
```tsx
const schema = z.object({
  ruc: z.string().regex(/^\d{11}$/, 'RUC debe tener 11 dígitos'),
  nombre: z.string().min(1),
  tipo_identificacion: z.enum(['RUC', 'NIS', 'ISSAN', 'CI']),
  categoria: z.enum(['servicios_publicos', 'honorarios', 'suministros', 'construccion', 'otros'])
});
```

---

### Admin Components

#### ManualReportForm Component

**File**: `src/components/Admin/ManualReportForm.tsx`

**Purpose**: Admin-only manual report entry

**Use Cases**:
- Backfill historical data
- Correct submitted reports
- Enter data on behalf of church

**Differences from Regular ReportForm**:
- Admin can select any church
- Can override auto-calculations
- Can set approved status directly

---

### Authentication Components

#### SupabaseAuth Component (Legacy)

> **Updated 2025-10-10:** This component was removed after the Convex auth
> migration. The historical notes remain here for context only.

- **Former file**: `src/components/Auth/SupabaseAuth.tsx`
- **Original purpose**: Google OAuth login using Supabase JS SDK
- **Current status**: Replaced by Convex-based `AuthProvider` + login flows

#### RequireAuth Component

**File**: `src/components/Auth/RequireAuth.tsx`

**Purpose**: Protected route wrapper

**Usage**:
```tsx
import { RequireAuth } from '@/components/Auth/RequireAuth';

export default function ProtectedPage() {
  return (
    <RequireAuth requiredRole="admin">
      <AdminContent />
    </RequireAuth>
  );
}
```

**Role Checking**:
```tsx
// Redirect if not authenticated or wrong role
if (!user || (requiredRole && user.role !== requiredRole)) {
  redirect('/login');
}
```

---

## Component Patterns

### Server vs Client Components

**Server Components** (default in Next.js 15):
```tsx
// app/reports/page.tsx
import { getAuthFromCookies } from '@/lib/auth-supabase';
import { executeWithContext } from '@/lib/db-admin';

export default async function ReportsPage() {
  const auth = await getAuthFromCookies();
  const reports = await executeWithContext(auth, async (client) => {
    const result = await client.query('SELECT * FROM monthly_reports');
    return result.rows;
  });

  return <ReportList reports={reports} />; // Client component
}
```

**Client Components** (interactive):
```tsx
'use client'; // Mark as client component

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ReportList({ reports }) {
  const [selectedReport, setSelectedReport] = useState(null);

  return (
    <div>
      {reports.map(report => (
        <Button key={report.id} onClick={() => setSelectedReport(report)}>
          {report.month}/{report.year}
        </Button>
      ))}
    </div>
  );
}
```

### Data Fetching with TanStack Query

**Pattern**: Custom hooks in `src/hooks/`

```tsx
// src/hooks/useReports.ts
import { useQuery } from '@tanstack/react-query';

export function useReports(churchId?: number) {
  return useQuery({
    queryKey: ['reports', churchId],
    queryFn: () => api.getReports(churchId),
    enabled: !!churchId
  });
}

// Usage in component
const { data: reports, isLoading, error } = useReports(churchId);
```

### Form Handling with React Hook Form

**Pattern**: Zod validation + React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  diezmos: z.number().min(0),
  ofrendas: z.number().min(0),
});

type FormData = z.infer<typeof schema>;

export function ReportForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: FormData) => {
    // Submit logic
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('diezmos')} error={errors.diezmos?.message} />
      <Input {...register('ofrendas')} error={errors.ofrendas?.message} />
      <Button type="submit">Guardar</Button>
    </form>
  );
}
```

### Optimistic Updates

**Pattern**: Update UI immediately, rollback on error

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteReport,
    onMutate: async (reportId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['reports'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['reports']);

      // Optimistically remove from UI
      queryClient.setQueryData(['reports'], (old: Report[]) =>
        old.filter(r => r.id !== reportId)
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['reports'], context.previous);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });
}
```

---

## Styling Conventions

### Tailwind Class Order

**Recommended order** (enforced by Prettier plugin):
1. Layout (flex, grid, display)
2. Positioning (absolute, relative, z-index)
3. Box model (width, height, padding, margin)
4. Typography (font, text)
5. Visual (background, border, shadow)
6. Interactive (cursor, pointer-events)
7. Responsive modifiers (sm:, md:, lg:)

**Example**:
```tsx
<div className="flex flex-col items-center justify-center w-full h-screen p-6 bg-gray-50 rounded-lg shadow-md">
  {/* Content */}
</div>
```

### Design Tokens (CSS Variables)

**File**: `src/styles/tokens.css`

```css
:root {
  /* ABSD Colors */
  --absd-authority: #002556;
  --absd-trust: #0066CC;
  --absd-success: #00A651;
  --absd-caution: #FFB81C;
  --absd-urgent: #DA291C;

  /* Spacing (8px grid) */
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2rem;
}
```

**Usage**:
```tsx
<Button className="bg-[var(--absd-authority)] px-[var(--space-3)]">
  Guardar
</Button>
```

### Responsive Design

**Breakpoints**:
- `sm`: 640px (Mobile landscape)
- `md`: 768px (Tablet)
- `lg`: 1024px (Desktop)
- `xl`: 1280px (Large desktop)

**Pattern**: Mobile-first

```tsx
<div className="
  grid grid-cols-1        /* Mobile: 1 column */
  md:grid-cols-2          /* Tablet: 2 columns */
  lg:grid-cols-3          /* Desktop: 3 columns */
  gap-4
">
  {/* Cards */}
</div>
```

---

## Component Testing

### Unit Testing Pattern

```tsx
// src/components/ui/button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    screen.getByText('Click').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Accessibility Testing

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Dialog Accessibility', () => {
  it('has no violations', async () => {
    const { container } = render(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent>Test</DialogContent>
      </Dialog>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Best Practices

### 1. Component Composition

**✅ GOOD** (Composable):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Total</CardTitle>
  </CardHeader>
  <CardContent>
    <MetricDisplay value={total} />
  </CardContent>
</Card>
```

**❌ BAD** (Monolithic):
```tsx
<MetricCard title="Total" value={total} />
```

### 2. TypeScript Props

**✅ GOOD** (Explicit types):
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  // ...
}
```

### 3. Event Handlers

**✅ GOOD** (Typed handlers):
```tsx
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  // Logic
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};
```

### 4. Conditional Rendering

**✅ GOOD** (Early returns):
```tsx
export function ReportList({ reports }: Props) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (reports.length === 0) return <EmptyState />;

  return (
    <div>
      {reports.map(report => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
```

---

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [BIRHAUS React Patterns](../design_philosophy/BIRHAUS_REACT_PATTERNS.md)
- [Next.js 15 Documentation](https://nextjs.org/docs)

---

**Last Updated**: October 2025
**Component Count**: 50+ components
**Coverage**: Core UI + Feature Components
