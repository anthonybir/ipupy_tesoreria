# Accessibility Restoration Plan - IPU PY Tesorería

## Executive Summary

**Status**: ⚠️ CRITICAL - Accessibility features removed Sept 22, 2025

On September 22, 2025, several critical accessibility features were removed from the codebase, violating BIRHAUS Principle #6: "Accessibility = Dignity". This plan outlines the restoration strategy to achieve WCAG 2.1 AA compliance.

**Impact**:
- Screen reader users cannot navigate effectively
- Keyboard-only users cannot access dialogs/modals
- Route changes not announced to assistive technology
- Focus management broken in interactive components

**Timeline**: 2-3 sprints (6-9 weeks)
**Priority**: HIGH (legal compliance + user dignity)

---

## Removed Features (Sept 22, 2025)

### 1. Screen Reader Announcements

**What Was Removed**:
- Route change announcements
- Live region updates for dynamic content
- Status message announcements
- Error announcements

**Impact**:
- Users with screen readers don't know when navigation occurs
- Dynamic updates (new reports, balance changes) go unnoticed
- Form validation errors not announced

**Example Removed Code**:
```tsx
// ❌ REMOVED
import { useRouter } from 'next/navigation';

useEffect(() => {
  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    announcer.textContent = `Navigated to ${pathname}`;
  }
}, [pathname]);

// Live region for announcements
<div
  id="route-announcer"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
/>
```

### 2. Keyboard Navigation

**What Was Removed**:
- Tab order management in complex components
- Keyboard shortcuts (Escape to close, Enter to submit)
- Arrow key navigation in lists/tables
- Focus visible indicators

**Impact**:
- Keyboard users cannot navigate modals/dialogs
- No way to close dialogs without mouse
- Table/list navigation requires excessive tabbing

**Example Removed Code**:
```tsx
// ❌ REMOVED
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    onClose();
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    onSubmit();
  }
};

useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### 3. Focus Trapping

**What Was Removed**:
- Focus trap in modals/dialogs
- Auto-focus on modal open
- Focus restoration on modal close
- Focus-visible polyfill

**Impact**:
- Focus escapes from modals (keyboard users get lost)
- No visual indicator of focus position
- Closing modal doesn't return focus to trigger element

**Example Removed Code**:
```tsx
// ❌ REMOVED
import FocusTrap from 'focus-trap-react';

<FocusTrap>
  <Dialog>
    <button ref={firstFocusableRef} onClick={onClose}>
      Close
    </button>
    {/* Dialog content */}
  </Dialog>
</FocusTrap>
```

### 4. Skip Navigation Links

**What Was Removed**:
- "Skip to main content" link
- "Skip to navigation" link
- Landmark navigation shortcuts

**Impact**:
- Keyboard/screen reader users must tab through entire header/nav on every page
- No quick way to jump to main content

**Example Removed Code**:
```tsx
// ❌ REMOVED
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white"
>
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {/* Page content */}
</main>
```

---

## Restoration Strategy

### Phase 1: Foundation (Sprint 1 - Week 1-3)

#### 1.1 Install Dependencies

```bash
npm install focus-trap-react @radix-ui/react-visually-hidden
npm install -D @axe-core/react
```

#### 1.2 Create Accessibility Utilities

**File**: `src/lib/utils/accessibility.ts`

```typescript
// Announce to screen readers
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcer = document.getElementById('screen-reader-announcer');
  if (announcer) {
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

// Trap focus within element
export function useFocusTrap(isActive: boolean) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !elementRef.current) return;

    const focusableElements = elementRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    elementRef.current.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      elementRef.current?.removeEventListener('keydown', handleTab);
    };
  }, [isActive]);

  return elementRef;
}
```

#### 1.3 Add Global Announcer Component

**File**: `src/components/Shared/ScreenReaderAnnouncer.tsx`

```typescript
'use client';

export function ScreenReaderAnnouncer() {
  return (
    <div
      id="screen-reader-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
```

**Add to Root Layout**:
```tsx
// src/app/layout.tsx
import { ScreenReaderAnnouncer } from '@/components/Shared/ScreenReaderAnnouncer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ScreenReaderAnnouncer />
        {children}
      </body>
    </html>
  );
}
```

---

### Phase 2: Component Restoration (Sprint 1-2 - Week 3-6)

#### 2.1 Restore Modal/Dialog Accessibility

**File**: `src/components/ui/dialog.tsx`

```tsx
'use client';

import FocusTrap from 'focus-trap-react';
import { useEffect, useRef } from 'react';
import { announce } from '@/lib/utils/accessibility';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ isOpen, onClose, title, children }: DialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Announce dialog opened
      announce(`Dialog opened: ${title}`);

      // Focus close button
      closeButtonRef.current?.focus();
    }
  }, [isOpen, title]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        announce('Dialog closed');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <FocusTrap>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className="bg-white rounded-lg p-6 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 id="dialog-title" className="text-xl font-semibold">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Cerrar diálogo"
              className="p-2 hover:bg-gray-100 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
```

#### 2.2 Restore Form Field Accessibility

**File**: `src/components/Forms/FormField.tsx`

```tsx
'use client';

import { useId } from 'react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function FormField({ label, error, helpText, ...props }: FormFieldProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const helpId = helpText ? `${id}-help` : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {props.required && (
          <span className="text-red-500 ml-1" aria-label="requerido">*</span>
        )}
      </label>

      <input
        id={id}
        aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={cn(
          "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500",
          error && "border-red-500"
        )}
        {...props}
      />

      {helpText && (
        <p id={helpId} className="text-sm text-gray-600">
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

#### 2.3 Restore Route Announcements

**File**: `src/components/Layout/RouteAnnouncer.tsx`

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { announce } from '@/lib/utils/accessibility';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Panel de control',
  '/churches': 'Iglesias',
  '/reports': 'Informes',
  '/funds': 'Fondos',
  '/transactions': 'Transacciones',
};

export function RouteAnnouncer() {
  const pathname = usePathname();

  useEffect(() => {
    const label = routeLabels[pathname] || pathname;
    announce(`Navegado a ${label}`, 'polite');
  }, [pathname]);

  return null; // This component only announces, no UI
}
```

**Add to Root Layout**:
```tsx
// src/app/layout.tsx
import { RouteAnnouncer } from '@/components/Layout/RouteAnnouncer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ScreenReaderAnnouncer />
        <RouteAnnouncer />
        {children}
      </body>
    </html>
  );
}
```

#### 2.4 Restore Skip Links

**File**: `src/components/Layout/SkipLinks.tsx`

```tsx
'use client';

export function SkipLinks() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Saltar al contenido principal
      </a>
      <a
        href="#navigation"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-20 focus:z-50 focus:p-4 focus:bg-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Saltar a la navegación
      </a>
    </>
  );
}
```

**Update Layout**:
```tsx
// src/app/layout.tsx
<body>
  <SkipLinks />
  <nav id="navigation">...</nav>
  <main id="main-content" tabIndex={-1}>
    {children}
  </main>
</body>
```

---

### Phase 3: Enhanced Features (Sprint 2-3 - Week 6-9)

#### 3.1 Keyboard Shortcuts

**File**: `src/hooks/useKeyboardShortcuts.ts`

```typescript
'use client';

import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcuts.find(s =>
        s.key === e.key &&
        (s.ctrl === undefined || s.ctrl === e.ctrlKey) &&
        (s.shift === undefined || s.shift === e.shiftKey) &&
        (s.alt === undefined || s.alt === e.altKey)
      );

      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Usage in dashboard
function Dashboard() {
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      description: 'Crear nuevo informe',
      action: () => router.push('/reports/new')
    },
    {
      key: '/',
      description: 'Buscar',
      action: () => searchInputRef.current?.focus()
    }
  ]);

  return (/* ... */);
}
```

#### 3.2 Table Navigation

**File**: `src/components/Shared/AccessibleTable.tsx`

```tsx
'use client';

import { useRef, useEffect } from 'react';

interface AccessibleTableProps<T> {
  data: T[];
  columns: { key: keyof T; label: string }[];
  onRowAction?: (row: T) => void;
}

export function AccessibleTable<T>({ data, columns, onRowAction }: AccessibleTableProps<T>) {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('tr')) return;

      const currentRow = target.closest('tr');
      const rows = Array.from(tableRef.current?.querySelectorAll('tbody tr') || []);
      const currentIndex = rows.indexOf(currentRow!);

      let nextRow: HTMLElement | null = null;

      switch (e.key) {
        case 'ArrowDown':
          nextRow = rows[currentIndex + 1] as HTMLElement;
          break;
        case 'ArrowUp':
          nextRow = rows[currentIndex - 1] as HTMLElement;
          break;
        case 'Home':
          nextRow = rows[0] as HTMLElement;
          break;
        case 'End':
          nextRow = rows[rows.length - 1] as HTMLElement;
          break;
      }

      if (nextRow) {
        e.preventDefault();
        (nextRow.querySelector('button') as HTMLElement)?.focus();
      }
    };

    tableRef.current?.addEventListener('keydown', handleKeyDown);
    return () => tableRef.current?.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <table ref={tableRef} className="w-full">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={String(col.key)} scope="col">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columns.map(col => (
              <td key={String(col.key)}>
                {String(row[col.key])}
              </td>
            ))}
            {onRowAction && (
              <td>
                <button onClick={() => onRowAction(row)}>
                  Acción
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### 3.3 Live Region Updates

**File**: `src/hooks/useLiveRegion.ts`

```typescript
'use client';

import { announce } from '@/lib/utils/accessibility';

export function useLiveRegion() {
  return {
    announceSuccess: (message: string) => announce(message, 'polite'),
    announceError: (message: string) => announce(message, 'assertive'),
    announceStatus: (message: string) => announce(message, 'polite'),
  };
}

// Usage in report submission
function ReportForm() {
  const { announceSuccess, announceError } = useLiveRegion();

  const { mutate: submitReport } = useMutation({
    mutationFn: api.submitReport,
    onSuccess: () => {
      announceSuccess('Informe enviado exitosamente');
      toast.success('Informe enviado');
    },
    onError: (error) => {
      announceError(`Error: ${error.message}`);
      toast.error('Error al enviar informe');
    }
  });

  return (/* ... */);
}
```

---

## Testing Plan

### Automated Testing

**Install**: `npm install -D @axe-core/react jest-axe`

**File**: `src/tests/accessibility.test.tsx`

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('Dialog has no violations', async () => {
    const { container } = render(
      <Dialog isOpen={true} onClose={() => {}} title="Test">
        Content
      </Dialog>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('FormField has proper labels', async () => {
    const { container } = render(
      <FormField label="Email" type="email" required />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Manual Testing Checklist

**Keyboard Navigation**:
- [ ] Tab through entire page (logical order)
- [ ] All interactive elements reachable
- [ ] Escape closes modals/dialogs
- [ ] Enter submits forms
- [ ] Arrow keys navigate tables/lists

**Screen Reader** (NVDA/JAWS on Windows, VoiceOver on macOS):
- [ ] Route changes announced
- [ ] Form errors announced
- [ ] Live region updates announced
- [ ] Buttons have clear labels
- [ ] Images have alt text

**Focus Management**:
- [ ] Focus visible on all interactive elements
- [ ] Focus trapped in modals
- [ ] Focus restored after modal close
- [ ] Skip links work

**Color Contrast** (WCAG AA):
- [ ] Text contrast ratio ≥ 4.5:1
- [ ] Large text contrast ratio ≥ 3:1
- [ ] Interactive elements contrast ≥ 3:1

---

## Rollout Strategy

### Week 1-3: Foundation
- [ ] Install dependencies
- [ ] Create accessibility utilities
- [ ] Add screen reader announcer
- [ ] Add route announcer
- [ ] Add skip links

### Week 4-6: Core Components
- [ ] Restore Dialog accessibility
- [ ] Restore FormField accessibility
- [ ] Restore Button focus styles
- [ ] Update all shadcn/ui components

### Week 7-9: Enhanced Features
- [ ] Keyboard shortcuts
- [ ] Table arrow key navigation
- [ ] Live region updates
- [ ] Focus management in complex components

### Post-Implementation
- [ ] Run automated accessibility audit (axe-core)
- [ ] Manual testing with screen readers
- [ ] Update documentation
- [ ] Train team on accessibility best practices

---

## Success Metrics

**Target**: WCAG 2.1 AA Compliance

| Criterion | Current | Target | Status |
|-----------|---------|--------|--------|
| **Perceivable** | 40% | 100% | 🔴 Critical |
| **Operable** | 30% | 100% | 🔴 Critical |
| **Understandable** | 60% | 100% | 🟡 Needs Work |
| **Robust** | 70% | 100% | 🟡 Needs Work |

**Key Performance Indicators**:
- Zero critical axe-core violations
- All interactive elements keyboard-accessible
- All routes announced to screen readers
- Focus management in all modals/dialogs
- ARIA labels on all form fields

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [BIRHAUS Principle #6: Accessibility = Dignity](../design_philosophy/BIRHAUS_PRINCIPLES.md#6-accessibility--dignity)

---

**Last Updated**: October 2025
**Owner**: Development Team
**Review Date**: January 2026
