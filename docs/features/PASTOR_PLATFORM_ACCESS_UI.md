# Pastor Platform Access - Admin UI Implementation

**Status**: ✅ Complete
**Date**: Octubre 2025
**Migration**: 032 (Pastor-Profile Linkage)

## Overview

Admin UI components for managing pastor platform access have been successfully implemented. Administrators can now grant, modify, and revoke system access for pastors through a dedicated interface in the Admin Configuration panel.

## Implementation Summary

### 1. Admin Configuration Tab

**File**: [src/app/admin/configuration/page.tsx](../../src/app/admin/configuration/page.tsx)

Added new "Acceso Pastores" tab to admin configuration with:
- Real-time statistics dashboard
- Pastor access table with filtering
- Action buttons for access management

**Key Features**:
- **Statistics Cards**: Display total pastors, active access, no access, and revoked counts
- **Pastor Table**: Shows pastor name, church, pastoral role, platform role, and access status
- **Contextual Actions**: Grant/Change/Revoke buttons based on current access status

### 2. Dialog Components

**File**: [src/components/Admin/PastorAccessDialogs.tsx](../../src/components/Admin/PastorAccessDialogs.tsx)

Three specialized dialog components:

#### GrantAccessDialog
- **Purpose**: Grant platform access to pastors without accounts
- **Modes**:
  - Link to existing profile (requires UUID)
  - Create new profile (email, password, role)
- **Auto-fills**: Email based on pastor name
- **Roles**: Admin, District Supervisor, Pastor, Treasurer, Secretary, Member

#### ChangeRoleDialog
- **Purpose**: Modify platform role for pastors with active access
- **Features**:
  - Shows current role
  - Dropdown for new role selection
  - Immediate role change on confirmation

#### RevokeAccessDialog
- **Purpose**: Remove platform access from pastors
- **Safety**:
  - Confirmation dialog with pastor details
  - Warning about immediate access loss
  - Preserves pastoral directory record

### 3. Type Definitions

**File**: [src/types/api.ts](../../src/types/api.ts) (lines 345-386)

```typescript
export type PastorAccessStatus = 'active' | 'no_access' | 'revoked';

export type PastorUserAccess = {
  pastorId: number;
  churchId: number;
  pastorName: string;
  churchName: string;
  pastoralRole?: string | null;
  profileId?: string | null;
  platformRole?: string | null;
  platformActive?: boolean | null;
  accessStatus: PastorAccessStatus;
};

export type PastorLinkRequest = {
  pastor_id: number;
  profile_id?: string;
  create_profile?: {
    email: string;
    password?: string;
    role: string;
  };
};
```

### 4. React Hooks

**File**: [src/hooks/usePastorAccess.ts](../../src/hooks/usePastorAccess.ts)

TanStack Query hooks for data fetching and mutations:

```typescript
// Fetch pastor access data
usePastorAccess(filters?: { status?: string; church_id?: string })

// Link pastor to profile
useLinkPastorProfile()

// Unlink pastor from profile
useUnlinkPastorProfile()
```

## User Workflow

### Grant Access (Pastor without account)

1. Navigate to Admin → Configuration → Acceso Pastores
2. Find pastor with "Sin Acceso" status
3. Click "Otorgar" button
4. Choose method:
   - **Link Existing**: Enter profile UUID → Link
   - **Create New**: Enter email/password/role → Create & Link
5. Pastor receives immediate platform access

### Change Role (Pastor with active access)

1. Find pastor with "Activo" status
2. Click "Cambiar" button
3. Select new role from dropdown
4. Confirm → Role updated immediately

### Revoke Access (Pastor with active access)

1. Find pastor with "Activo" status
2. Click "Revocar" button
3. Review pastor details in confirmation dialog
4. Confirm → Access revoked immediately
5. Pastor record remains in pastoral directory

### Reactivate Access (Revoked pastor)

1. Find pastor with "Revocado" status
2. Click "Reactivar" button
3. Follow grant access workflow
4. New profile created or linked

## Access Status Indicators

| Status | Badge Color | Description |
|--------|-------------|-------------|
| Activo | Green | Pastor has active platform access |
| Sin Acceso | Gray | Pastor exists in directory but no platform account |
| Revocado | Red | Pastor had access but was revoked |

## Technical Details

### API Endpoints Used

- `GET /api/admin/pastors/access` - Fetch pastor access list with summary
- `POST /api/admin/pastors/link-profile` - Link pastor to profile (existing or new)
- `DELETE /api/admin/pastors/link-profile` - Unlink pastor from profile

### Database Views

- `pastor_user_access` - Aggregates pastor, church, and profile data with access status

### RLS Policies

All operations enforce Row Level Security:
- Only admins can modify pastor-profile linkages
- Changes logged to `user_activity` table via triggers

### Audit Trail

Every access change is automatically logged:
- **Event**: `pastor_profile_linked` / `pastor_profile_unlinked`
- **Metadata**: Old/new profile IDs, role changes
- **Actor**: Admin user ID from session context

## Migration Dependencies

This UI requires migration 032 to be applied:

```bash
# Check if migration applied
SELECT version FROM schema_migrations WHERE version = '032';

# If not applied, run migration
psql -f migrations/032_pastor_profile_linkage.sql
```

## Validation & Testing

✅ **TypeScript**: No type errors (`npx tsc --noEmit`)
✅ **ESLint**: No linting errors (`npm run lint`)
✅ **Component Mounting**: Dialogs mount/unmount correctly
✅ **Data Fetching**: TanStack Query hooks fetch and cache data
✅ **Mutations**: Link/unlink operations trigger cache invalidation

## Security Considerations

1. **Admin-Only Access**: Tab only visible to users with `admin` role
2. **RLS Enforcement**: All database queries use session context
3. **Password Validation**: Enforces minimum 8 character password
4. **Email Validation**: Validates email format before profile creation
5. **Audit Logging**: All access changes tracked with admin user ID

## Future Enhancements

Potential improvements for future iterations:

- [ ] Bulk access grant for multiple pastors
- [ ] Email notifications to pastors when access granted/revoked
- [ ] Access history timeline per pastor
- [ ] CSV export of pastor access report
- [ ] Search and filter by church/status
- [ ] Role change reason/notes field

## Related Documentation

- [PASTOR_USER_MANAGEMENT.md](../guides/PASTOR_USER_MANAGEMENT.md) - Backend API documentation
- [DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) - Schema v2.1.0 with pastor-profile linkage
- [Migration 032](../../migrations/032_pastor_profile_linkage.sql) - Database migration

## Troubleshooting

### Dialog not opening
- Check browser console for React errors
- Verify `selectedPastor` state is set correctly
- Ensure TanStack Query has fetched data

### Mutation failures
- Check API route logs for validation errors
- Verify RLS context is set (admin role required)
- Check database constraints (unique profile_id)

### Access status not updating
- Query cache may be stale - refresh page
- Check `pastor_user_access` view for correct data
- Verify `profile_id` linkage in pastors table

## Code Quality

**Lines of Code**: ~450 (UI) + ~300 (Dialogs)
**Components**: 4 (PastorAccessManagementSection + 3 dialogs)
**Hooks Used**: 3 (usePastorAccess, useLinkPastorProfile, useUnlinkPastorProfile)
**Type Safety**: Fully typed with TypeScript strict mode

---

**Implementation Complete** ✅

Admin UI for pastor platform access management is production-ready.
