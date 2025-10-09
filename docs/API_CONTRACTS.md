# API Response Contracts

**Last Updated:** October 9, 2025  
**Maintainers:** Platform team

This document codifies the REST response envelope used across the IPU PY Tesorería application. All routes return an `ApiResponse<T>` discriminated union exported from `src/types/utils.ts`.

```ts
export type ApiErrorResponse = {
  success: false;
  error: string;
  details?: unknown;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

## Standard Patterns

| Pattern | Usage | Example |
| --- | --- | --- |
| **Simple Success** | CRUD endpoints returning a single record or array | `{ success: true, data: ReportRecord }` |
| **Success + Metadata** | Collections that need counts, pagination, or aggregate stats | `ApiResponse<Transaction[]> & { pagination: Pagination; totals: Totals }` |
| **Success + Message** | Mutations that surface user-visible toasts (e.g., DELETE) | `ApiResponse<Record<string, never>> & { message: string }` |
| **Error** | Validation, auth, or server failures | `{ success: false, error: 'Mensaje descriptivo', details?: unknown }` |

### Metadata Intersections

When additional metadata accompanies the payload, we intersect the base envelope with a structural type rather than nesting under `data`. Examples:

```ts
type TransactionsResponse = ApiResponse<Transaction[]> & {
  pagination: Pagination;
  totals: Totals;
};

type ProvidersResponse = ApiResponse<Provider[]> & {
  count: number;
};
```

### Top-Level Messages

Legacy consumers expect toast-friendly messages at the top level (e.g., `/api/churches` DELETE). We preserve this contract via:

```ts
type DeleteResponse = ApiResponse<Record<string, never>> & { message: string };
```

The `data` payload is always an empty object in these cases.

## Batch Operations

`/api/financial/transactions` supports bulk inserts and Multi-Status responses. The endpoint now returns:

```ts
type BulkTransactionData = {
  created: Transaction[];
  createdCount: number;
  failedCount: number;
  errors?: Array<{ index: number; error: string }>;
  errorDetails?: Array<{ index: number; transaction: unknown; error: string }>;
};

type BulkTransactionResponse = ApiResponse<BulkTransactionData> & { message: string };
```

- **201 Created** – all transactions succeeded (`failedCount === 0`).
- **207 Multi-Status** – partial success (`failedCount > 0`) with descriptive errors.
- Consumers unwrap via the shared helper in `src/lib/utils/transaction-helpers.ts`, which normalizes the response to the historical `{ created, failed, errors }` summary.

## CORS Helpers

Legacy routes that require CORS headers use helper utilities to emit envelopes consistently:

```ts
const corsJson = <T extends ApiResponse<unknown>>(
  payload: T,
  init?: ResponseInit,
) => {
  const response = NextResponse.json(payload, init);
  setCORSHeaders(response);
  return response;
};

const corsError = (message: string, status: number, details?: unknown) =>
  corsJson<ApiResponse<never>>(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status },
  );
```

These helpers ensure every response includes the required headers while maintaining the `ApiResponse<T>` contract.

## Checklist for New Endpoints

1. Return an `ApiResponse<T>`-compliant object (success path) or pass errors to `handleApiError`.
2. Preserve legacy top-level `message` fields (DELETE/POST notifications) by intersecting the type with `{ message: string }`.
3. Document any exceptions (e.g., batch operations) in this file and expose a helper to normalize the payload for clients.
4. Update `docs/TASK_TRACKER.md` and `CHANGELOG.md` when introducing new response patterns.
