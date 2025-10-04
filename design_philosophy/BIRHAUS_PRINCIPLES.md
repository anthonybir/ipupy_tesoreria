# BIRHAUS Design Principles - IPU PY Tesorería

## Overview

**BIRHAUS** is the design system philosophy for IPU PY Tesorería, focusing on **minimalist yet powerful interfaces** that embody dignity, functionality, and cultural sensitivity. These 10 principles guide all UI/UX decisions.

**BIRHAUS** stands for:
- **B**ilingual by design
- **I**ntuitive workflows
- **R**esponsive & accessible
- **H**onest data presentation
- **A**uditability & transparency
- **U**ndo over confirm
- **S**implicity in action

## The 10 BIRHAUS Principles

### 1. Form Serves Flow (Flujo sobre Forma)

**Principle**: UI structure follows natural user workflows, not arbitrary visual hierarchies.

**In Practice**:
- Monthly report creation follows chronological data entry (income → expenses → summary)
- Dashboard prioritizes most frequent tasks (view reports, check balances)
- Navigation reflects organizational hierarchy (church → funds → transactions)

**Implementation Example**:
```tsx
// ✅ Flow-driven navigation
<Breadcrumbs>
  <BreadcrumbItem>Iglesias</BreadcrumbItem>
  <BreadcrumbItem>Iglesia Central</BreadcrumbItem>
  <BreadcrumbItem>Informes Mensuales</BreadcrumbItem>
  <BreadcrumbItem>Enero 2025</BreadcrumbItem>
</Breadcrumbs>

// ❌ Arbitrary visual hierarchy
<Menu>
  <MenuItem>Reports</MenuItem>
  <MenuItem>Churches</MenuItem>
  <MenuItem>Funds</MenuItem>
</Menu>
```

**Current Gaps**:
- ⚠️ Some admin flows require too many clicks (user management)
- ⚠️ Fund event approval workflow could be streamlined

---

### 2. Honest Data Presentation (Datos Honestos)

**Principle**: Show data truthfully without manipulation, exaggeration, or misleading visualizations.

**In Practice**:
- Financial charts use linear scales (never logarithmic for treasury data)
- Percentages always show actual numbers alongside
- Missing data labeled explicitly ("No disponible"), not hidden
- Variance analysis shows both positive and negative clearly

**Implementation Example**:
```tsx
// ✅ Honest data display
<MetricCard>
  <MetricLabel>Diezmos Recibidos</MetricLabel>
  <MetricValue>₲ 15.234.000</MetricValue>
  <MetricChange variant="positive">
    +12% vs mes anterior (₲ 13.602.000)
  </MetricChange>
</MetricCard>

// ❌ Misleading visualization
<Chart startYAxis={10000} /> {/* Truncated axis exaggerates changes */}
```

**Current Implementation**:
- ✅ All currency displays include full numbers (no rounding to "15M")
- ✅ Transaction ledger shows actual timestamps
- ✅ Audit trail preserves complete history

---

### 3. One Clear Action (Una Acción Clara)

**Principle**: Every screen has ONE primary action, visually dominant and unmistakable.

**In Practice**:
- Report creation page: Primary = "Guardar Informe"
- Fund event page: Primary = "Aprobar Evento"
- Dashboard: Primary = "Crear Nuevo Informe"

**Implementation Example**:
```tsx
// ✅ Clear primary action
<ReportForm>
  <FormFields>...</FormFields>
  <ButtonGroup>
    <Button variant="primary" size="lg">
      Guardar Informe
    </Button>
    <Button variant="ghost" size="sm">
      Cancelar
    </Button>
  </ButtonGroup>
</ReportForm>

// ❌ Competing actions
<ButtonGroup>
  <Button variant="primary">Save</Button>
  <Button variant="primary">Save & Submit</Button>
  <Button variant="primary">Save Draft</Button>
</ButtonGroup>
```

**Design Tokens**:
```css
/* Primary action - ABSD Authority Blue */
.button-primary {
  background: var(--absd-authority); /* #002556 */
  font-size: 1.125rem;
  padding: 1rem 2rem;
}

/* Secondary actions - subdued */
.button-secondary {
  background: transparent;
  color: var(--absd-neutral-600);
  font-size: 0.875rem;
}
```

---

### 4. Progressive Disclosure (Revelación Progresiva)

**Principle**: Show essential information first, reveal complexity on demand.

**In Practice**:
- Dashboard shows summary cards, details on click
- Report forms use collapsible sections (optional fields hidden)
- Admin settings grouped by category, expanded one at a time

**Implementation Example**:
```tsx
// ✅ Progressive disclosure
<ReportSummary>
  <SummaryCard>
    <h3>Total Ingresos: ₲ 25.400.000</h3>
    <ExpandableDetails>
      <DetailRow>Diezmos: ₲ 15.234.000</DetailRow>
      <DetailRow>Ofrendas: ₲ 8.450.000</DetailRow>
      <DetailRow>Misiones: ₲ 1.716.000</DetailRow>
    </ExpandableDetails>
  </SummaryCard>
</ReportSummary>

// ❌ Information overload
<ReportSummary>
  <Table rows={500} showAllColumns />
</ReportSummary>
```

**Current Implementation**:
- ✅ DataTable component with pagination/filtering
- ✅ Collapsible admin configuration sections
- ⚠️ Could improve: Fund transaction history (show recent, load more)

---

### 5. Undo Over Confirm (Deshacer sobre Confirmar)

**Principle**: Allow reversible actions instead of blocking with confirmation dialogs.

**In Practice**:
- Soft delete with "Restaurar" option (profiles, transactions)
- Draft reports saved automatically, can be discarded later
- Transaction edits create new version, preserve history

**Implementation Example**:
```tsx
// ✅ Undo pattern
const handleDelete = async () => {
  const backup = data;
  await softDelete(id);

  toast({
    title: "Eliminado",
    action: <Button onClick={() => restore(backup)}>Deshacer</Button>
  });
};

// ❌ Confirmation dialog
const handleDelete = async () => {
  if (confirm("¿Está seguro?")) {
    await hardDelete(id); // No way back
  }
};
```

**Future Enhancements**:
- [ ] Add "Deshacer" to transaction deletions (currently confirm dialog)
- [ ] Implement soft delete for fund events
- [ ] Add edit history viewer for reports

---

### 6. Accessibility = Dignity (Accesibilidad = Dignidad)

**Principle**: Accessible design is not optional, it's a matter of respect and dignity for all users.

**In Practice**:
- WCAG 2.1 AA compliance minimum
- Keyboard navigation for all critical flows
- Screen reader announcements for financial updates
- High contrast mode support
- Spanish language fully supported

**Implementation Requirements**:
```tsx
// ✅ Accessible component
<Button
  aria-label="Guardar informe mensual de enero 2025"
  onClick={handleSave}
>
  Guardar Informe
</Button>

<FormField>
  <Label htmlFor="amount">Monto (Guaraníes)</Label>
  <Input
    id="amount"
    type="number"
    aria-describedby="amount-help"
    aria-invalid={errors.amount ? "true" : "false"}
  />
  <HelpText id="amount-help">
    Ingrese el monto en guaraníes sin puntos ni comas
  </HelpText>
  {errors.amount && (
    <ErrorText role="alert">{errors.amount}</ErrorText>
  )}
</FormField>
```

**CRITICAL: Features Removed (Sept 22, 2025)**:
- ❌ Screen reader announcements for route changes
- ❌ Keyboard navigation for modals
- ❌ Focus trap in dialogs
- ❌ Skip to content links

**Action Required**: See [ACCESSIBILITY_RESTORATION_PLAN.md](../docs/ACCESSIBILITY_RESTORATION_PLAN.md)

---

### 7. Bilingual by Design (Bilingüe por Diseño)

**Principle**: Spanish is the primary language, but internationalization is built-in from day one.

**In Practice**:
- All UI text in Spanish (Paraguay)
- Code uses English for variables/functions
- i18n structure prepared for future expansion
- Currency formatted for Paraguay (₲, thousands separator)

**Implementation Example**:
```tsx
// ✅ Bilingual structure
const translations = {
  es: {
    reports: {
      title: "Informes Mensuales",
      createNew: "Crear Nuevo Informe",
      status: {
        draft: "Borrador",
        submitted: "Enviado",
        approved: "Aprobado"
      }
    }
  },
  // Future: en, gn (Guaraní)
};

// Code internals in English
const calculateTotalIncome = (report: MonthlyReport) => {
  return report.tithes + report.offerings + report.missions;
};

// ❌ Mixed language code
const calcularTotalIngresos = (informe) => { ... }
```

**Currency Formatting**:
```typescript
// ✅ Paraguay-specific formatting
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
  }).format(amount);
  // Output: "₲ 15.234.000"
};
```

---

### 8. Performance is UX (Rendimiento es UX)

**Principle**: Speed and responsiveness are user experience features, not technical details.

**In Practice**:
- Page load < 2 seconds (LCP target)
- API responses < 500ms (95th percentile)
- Optimistic UI updates for user actions
- Skeleton screens during data loading

**Implementation Example**:
```tsx
// ✅ Optimistic update
const { mutate } = useMutation({
  mutationFn: updateReport,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['reports', id]);

    // Snapshot previous value
    const previous = queryClient.getQueryData(['reports', id]);

    // Optimistically update
    queryClient.setQueryData(['reports', id], newData);

    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['reports', id], context.previous);
  }
});

// ❌ Blocking UI
const handleSubmit = async () => {
  setLoading(true);
  await updateReport(data); // User waits...
  setLoading(false);
};
```

**Performance Metrics**:
- ✅ DataTable virtualization for 1000+ rows
- ✅ Image optimization with Next.js Image component
- ⚠️ Could improve: Excel export streaming (currently loads all in memory)

---

### 9. Consistency via Tokens (Consistencia por Tokens)

**Principle**: Visual consistency comes from design tokens, not manual CSS.

**In Practice**:
- All colors from ABSD token system
- Typography defined in tokens (16px base, 1.5 line height)
- Spacing uses 8px grid system
- No arbitrary values in components

**Design Tokens** (`src/styles/tokens.css`):
```css
:root {
  /* ABSD Colors */
  --absd-authority: #002556;      /* Primary actions, headers */
  --absd-trust: #0066CC;          /* Links, info states */
  --absd-success: #00A651;        /* Positive feedback */
  --absd-caution: #FFB81C;        /* Warnings */
  --absd-urgent: #DA291C;         /* Errors, critical actions */
  --absd-neutral-50: #F8F9FA;
  --absd-neutral-100: #E9ECEF;
  --absd-neutral-900: #212529;

  /* Typography */
  --font-base: 16px;
  --font-scale: 1.25;             /* Major third scale */
  --line-height: 1.5;

  /* Spacing (8px grid) */
  --space-1: 0.5rem;  /* 8px */
  --space-2: 1rem;    /* 16px */
  --space-3: 1.5rem;  /* 24px */
  --space-4: 2rem;    /* 32px */
}
```

**Component Usage**:
```tsx
// ✅ Token-based styling
<Button className="bg-[var(--absd-authority)] text-white px-[var(--space-3)]">
  Guardar
</Button>

// ❌ Arbitrary values
<Button className="bg-[#002556] text-white px-6">
  Guardar
</Button>
```

---

### 10. Auditability & Transparency (Auditabilidad y Transparencia)

**Principle**: Every action is logged, traceable, and explainable.

**In Practice**:
- All database changes logged in `user_activity` table
- Financial transactions immutable (audit trail preserved)
- Report approval workflow fully documented
- Admin actions require justification

**Implementation Example**:
```typescript
// ✅ Audit trail
export const updateReport = async (reportId: number, data: ReportData, auth: AuthContext) => {
  const result = await executeWithContext(auth, async (client) => {
    // Update report
    await client.query(
      `UPDATE monthly_reports SET ... WHERE id = $1`,
      [reportId]
    );

    // Log action
    await client.query(
      `INSERT INTO user_activity (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'update', 'monthly_report', $2, $3)`,
      [auth.userId, reportId, JSON.stringify({ changes: data })]
    );

    return result;
  });
};

// ❌ No audit trail
const updateReport = async (id, data) => {
  await db.query(`UPDATE monthly_reports SET ... WHERE id = $1`, [id]);
  // No record of who changed what
};
```

**Audit Requirements**:
- ✅ User activity table with complete history
- ✅ RLS context logged for all queries
- ✅ Report status changes tracked
- ✅ Transaction edits create new versions

---

## Alignment Assessment

### Current Implementation Status

| Principle | Status | Score | Notes |
|-----------|--------|-------|-------|
| 1. Form Serves Flow | ⚠️ Partial | 7/10 | Some admin flows need optimization |
| 2. Honest Data | ✅ Strong | 9/10 | Excellent currency/data display |
| 3. One Clear Action | ✅ Good | 8/10 | Most pages have clear primary action |
| 4. Progressive Disclosure | ⚠️ Partial | 6/10 | Could improve data table details |
| 5. Undo Over Confirm | ⚠️ Weak | 4/10 | Still uses confirm dialogs heavily |
| 6. Accessibility | ❌ Critical | 2/10 | Features removed Sept 22, 2025 |
| 7. Bilingual | ✅ Strong | 9/10 | Spanish primary, i18n ready |
| 8. Performance | ✅ Good | 8/10 | Fast loads, could optimize exports |
| 9. Consistency | ✅ Strong | 9/10 | Token system well-implemented |
| 10. Auditability | ✅ Strong | 9/10 | Comprehensive audit trail |

**Overall Score**: 71/100

### Priority Improvements

1. **CRITICAL**: Restore accessibility features (Score: 2/10 → 8/10)
   - See [ACCESSIBILITY_RESTORATION_PLAN.md](../docs/ACCESSIBILITY_RESTORATION_PLAN.md)
   - Timeline: 2-3 sprints
   - Impact: Legal compliance + user dignity

2. **HIGH**: Implement undo patterns (Score: 4/10 → 8/10)
   - Replace confirm dialogs with undo toasts
   - Add soft delete for transactions
   - Timeline: 1-2 sprints

3. **MEDIUM**: Improve progressive disclosure (Score: 6/10 → 9/10)
   - Add "Load More" to transaction history
   - Collapsible report sections
   - Timeline: 1 sprint

## Design Review Checklist

Before implementing new features, verify alignment with BIRHAUS:

- [ ] **Form Serves Flow**: Does the UI follow the natural user workflow?
- [ ] **Honest Data**: Are charts/metrics truthful and complete?
- [ ] **One Clear Action**: Is there ONE dominant primary action?
- [ ] **Progressive Disclosure**: Is complex info revealed on demand?
- [ ] **Undo Over Confirm**: Can users reverse actions easily?
- [ ] **Accessibility**: WCAG 2.1 AA compliant? Keyboard navigable?
- [ ] **Bilingual**: Spanish UI, English code, i18n structure?
- [ ] **Performance**: < 2s page load? Optimistic updates?
- [ ] **Consistency**: Using design tokens? No arbitrary values?
- [ ] **Auditability**: All actions logged in user_activity?

## Resources

- [ABSD Design System](https://absd.design) _(if available)_
- [BIRHAUS React Patterns](./BIRHAUS_REACT_PATTERNS.md)
- [Accessibility Restoration Plan](../docs/ACCESSIBILITY_RESTORATION_PLAN.md)
- [Component Library Guide](../docs/COMPONENTS.md)

---

**Last Updated**: October 2025
**Next Review**: January 2026
