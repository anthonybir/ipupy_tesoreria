# Performance Monitoring Guide - IPU PY Tesorería

## Overview

This guide covers performance monitoring, metrics tracking, and optimization strategies for IPU PY Tesorería. The system handles financial data for 22 churches and requires consistent performance for optimal user experience.

**BIRHAUS Principle #8**: Performance is UX - Speed and responsiveness are user experience features, not technical details.

---

## Performance Targets

### Core Web Vitals (Google)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **LCP** (Largest Contentful Paint) | < 2.5s | TBD | 🟡 Monitor |
| **FID** (First Input Delay) | < 100ms | TBD | 🟡 Monitor |
| **CLS** (Cumulative Layout Shift) | < 0.1 | TBD | 🟡 Monitor |
| **TTFB** (Time to First Byte) | < 200ms | TBD | 🟡 Monitor |
| **FCP** (First Contentful Paint) | < 1.8s | TBD | 🟡 Monitor |

### Application Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Response Time** (p95) | < 500ms | Server logs |
| **Database Query Time** (p95) | < 200ms | Supabase dashboard |
| **Page Load Time** (p95) | < 2s | Vercel Analytics |
| **Bundle Size** (Initial JS) | < 500KB | Next.js build output |
| **Lighthouse Score** | > 90 | Lighthouse CI |

---

## Monitoring Stack

### 1. Vercel Analytics (Built-in)

**What it monitors**:
- Real User Monitoring (RUM)
- Core Web Vitals
- Page load times
- Geographic distribution
- Device breakdown

**Access**: Vercel Dashboard → ipupytesoreria → Analytics

**Key Metrics to Watch**:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- Top Pages performance
- Traffic sources

### 2. Supabase Dashboard

**What it monitors**:
- Database query performance
- Connection pool usage
- API request volume
- Storage usage
- Authentication metrics

**Access**: Supabase Dashboard → Project → Reports

**Key Queries**:
```sql
-- Slow queries (> 1 second)
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## Performance Optimization Strategies

### 1. Database Query Optimization

**Check Missing Indexes**:
```sql
-- Queries without index usage
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
ORDER BY n_distinct DESC;
```

**Add Strategic Indexes**:
```sql
-- Speed up report lookups
CREATE INDEX CONCURRENTLY idx_monthly_reports_church_year
ON monthly_reports(church_id, year, month)
WHERE status = 'approved';
```

### 2. Frontend Optimization

**Code Splitting**:
```typescript
// ✅ GOOD - Load only when needed
const handleExport = async () => {
  const { exportToExcel } = await import('@/lib/excel');
  exportToExcel(data);
};
```

**Image Optimization**:
```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority={false}
  quality={85}
/>
```

### 3. Caching Strategies

**API Route Caching**:
```typescript
// app/api/churches/route.ts
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const churches = await getChurches();
  return NextResponse.json(churches);
}
```

**Client-Side Caching**:
```typescript
import { useQuery } from '@tanstack/react-query';

export function useReports(churchId: number) {
  return useQuery({
    queryKey: ['reports', churchId],
    queryFn: () => api.getReports(churchId),
    staleTime: 5 * 60 * 1000,      // 5 minutes
    cacheTime: 10 * 60 * 1000      // 10 minutes
  });
}
```

---

## Performance Monitoring Tools

### 1. Lighthouse CI

```bash
npm install -D @lhci/cli

# Run audit
npx lhci autorun
```

### 2. Web Vitals Tracking

```typescript
import { onCLS, onFID, onLCP } from 'web-vitals';

export function useWebVitals() {
  useEffect(() => {
    onCLS(metric => console.log('CLS:', metric.value));
    onFID(metric => console.log('FID:', metric.value));
    onLCP(metric => console.log('LCP:', metric.value));
  }, []);
}
```

---

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Supabase Performance](https://supabase.com/docs/guides/platform/performance)

---

**Last Updated**: October 2025
**Performance Target**: LCP < 2.5s, FID < 100ms, CLS < 0.1
