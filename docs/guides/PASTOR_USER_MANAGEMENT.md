# Pastor User Management Guide

> **Version**: 1.0
> **Last Updated**: 2025-10-01
> **Migration**: 032_pastor_profile_linkage

## Overview

The Pastor User Management system enables administrators to grant platform access to pastors by linking their pastoral records to user profiles with specific system roles. This maintains separation between:

- **Pastoral Identity** (`pastors` table) - Directory information (name, contact, ordination)
- **Platform Access** (`profiles` table) - System roles and permissions

---

## Architecture

### Database Schema

#### **Pastors Table** (Extended)
```sql
ALTER TABLE pastors ADD COLUMN profile_id UUID REFERENCES profiles(id);
```

- **profile_id**: Links to `profiles` table for platform access
- **Unique Constraint**: One profile can only be linked to one pastor
- **ON DELETE SET NULL**: Preserve pastor record if user account deleted

#### **Pastor User Access View**
```sql
CREATE VIEW pastor_user_access AS
SELECT
  pastor details,
  profile details,
  access_status ('active' | 'no_access' | 'revoked')
FROM pastors p
LEFT JOIN profiles prof ON prof.id = p.profile_id
WHERE p.is_primary = TRUE AND p.status = 'active';
```

### Audit Trail

All linkage changes are automatically logged to `user_activity`:
- `pastor.access_granted` - Profile linked
- `pastor.access_revoked` - Profile unlinked
- `pastor.access_changed` - Profile re-linked

---

## API Endpoints

### **GET** `/api/admin/pastors/access`

Fetch all pastors with platform access status.

**Query Parameters**:
- `status` (optional): Filter by access status (`active`, `no_access`, `revoked`)
- `church_id` (optional): Filter by church

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "pastorId": 1,
      "pastorName": "Joseph Anthony Bir",
      "churchName": "IPU LAMBARÉ",
      "pastoralRole": "Obispo Consejero",
      "profileId": "uuid-here",
      "platformEmail": "pastor@ipupy.org.py",
      "platformRole": "pastor",
      "platformActive": true,
      "accessStatus": "active"
    }
  ],
  "summary": {
    "total": 38,
    "with_access": 15,
    "no_access": 20,
    "revoked": 3
  }
}
```

---

### **POST** `/api/admin/pastors/link-profile`

Grant platform access to a pastor (link to profile or create new).

**Request Body** (Option 1 - Link existing):
```json
{
  "pastor_id": 1,
  "profile_id": "existing-uuid"
}
```

**Request Body** (Option 2 - Create new):
```json
{
  "pastor_id": 1,
  "create_profile": {
    "email": "pastor@ipupy.org.py",
    "password": "optional-override",
    "role": "pastor"
  }
}
```

**Valid Roles**:
- `admin` - Full system access
- `district_supervisor` - Regional oversight
- `pastor` - Church management
- `treasurer` - Financial operations
- `secretary` - Member records
- `member` - Basic access

**Response**:
```json
{
  "success": true,
  "message": "Profile created and linked to pastor successfully",
  "data": {
    "pastor_id": 1,
    "pastor_name": "Joseph Anthony Bir",
    "church_id": 1,
    "church_name": "IPU LAMBARÉ",
    "profile_id": "uuid",
    "platform_email": "pastor@ipupy.org.py",
    "platform_role": "pastor",
    "platform_active": true
  }
}
```

---

### **DELETE** `/api/admin/pastors/link-profile`

Revoke platform access from a pastor (unlink profile).

**Query Parameters**:
- `pastor_id` (required): Pastor ID to unlink
- `delete_profile` (optional): Also delete the user profile (`true`/`false`)

**Response**:
```json
{
  "success": true,
  "message": "Pastor unlinked from profile successfully (profile preserved)"
}
```

---

## React Hooks

### **usePastorAccess()**

Fetch pastors with access status.

```typescript
import { usePastorAccess } from '@/hooks/usePastorAccess';

const { data, isLoading } = usePastorAccess({
  status: 'no_access', // Optional filter
  church_id: '1'       // Optional filter
});

// Access data
const pastors = data?.data ?? [];
const summary = data?.summary;
```

---

### **useLinkPastorProfile()**

Grant platform access to a pastor.

```typescript
import { useLinkPastorProfile } from '@/hooks/usePastorAccess';

const { mutate: linkPastor, isPending } = useLinkPastorProfile();

// Option 1: Link existing profile
linkPastor({
  pastor_id: 1,
  profile_id: 'existing-uuid'
});

// Option 2: Create new profile
linkPastor({
  pastor_id: 1,
  create_profile: {
    email: 'pastor@ipupy.org.py',
    role: 'pastor'
  }
});
```

---

### **useUnlinkPastorProfile()**

Revoke platform access.

```typescript
import { useUnlinkPastorProfile } from '@/hooks/usePastorAccess';

const { mutate: unlinkPastor } = useUnlinkPastorProfile();

// Unlink but keep profile
unlinkPastor({ pastor_id: 1 });

// Unlink and delete profile
unlinkPastor({ pastor_id: 1, delete_profile: true });
```

---

### **useChangePastorRole()**

Update a pastor's platform role.

```typescript
import { useChangePastorRole } from '@/hooks/usePastorAccess';

const { mutate: changeRole } = useChangePastorRole();

changeRole({
  profile_id: 'uuid',
  role: 'treasurer' // Change from pastor to treasurer
});
```

---

## Admin UI Workflow

### **Step 1: View Pastor Access Status**

Navigate to **Admin Configuration → Pastor Platform Access**.

The table shows:
- Pastor name & church
- Pastoral role (Ordination level)
- Platform email (if linked)
- Platform role (if linked)
- Access status badge
- Actions (Grant/Change/Revoke)

### **Step 2: Grant Access**

**For pastors with NO ACCESS**:
1. Click **"Grant Access"** button
2. Choose:
   - **Link Existing User** → Select from dropdown
   - **Create New User** → Enter email, select role
3. Submit → Access granted immediately

### **Step 3: Change Role**

**For pastors with ACTIVE access**:
1. Click role badge or **"Change Role"** button
2. Select new role from dropdown
3. Confirm → Role updated immediately

### **Step 4: Revoke Access**

**For pastors with ACTIVE access**:
1. Click **"Revoke Access"** button
2. Choose:
   - **Revoke Only** → Unlink but keep profile for later use
   - **Revoke & Delete** → Permanently remove user account
3. Confirm → Access revoked immediately

---

## Security & Permissions

### **Admin Only**
All pastor access management endpoints require `admin` role.

### **Audit Trail**
Every linkage change is logged with:
- User who made the change (`role_assigned_by`)
- Timestamp (`role_assigned_at`)
- Action details (JSON in `user_activity`)

### **RLS Protection**
- Pastors can only view their own profile
- Only admins can modify `profile_id` linkage
- Profile deletion cascades gracefully (SET NULL)

---

## Common Scenarios

### **Scenario 1: New Pastor Joins Church**
1. Admin creates pastor record in church directory
2. Admin grants platform access → Creates profile with `pastor` role
3. Pastor receives email with login credentials
4. Pastor logs in → Full church management access

### **Scenario 2: Pastor Transitions to Treasurer**
1. Admin changes platform role from `pastor` to `treasurer`
2. Pastor's access automatically adjusts
3. Pastor can still manage finances but loses broader church permissions

### **Scenario 3: Pastor Leaves Church**
1. Admin revokes platform access (profile preserved)
2. Pastor record remains in directory (historical tracking)
3. Pastor can no longer log in
4. Later re-linking is possible if pastor returns

---

## Migration Guide

### **Apply Migration**
```bash
# Via Supabase MCP
mcp__supabase__apply_migration("pastor_profile_linkage", "...")

# Or manually
psql -f migrations/032_pastor_profile_linkage.sql
```

### **Verification**
```sql
-- Check linkage column exists
SELECT profile_id FROM pastors LIMIT 1;

-- View pastor access status
SELECT * FROM pastor_user_access;

-- Check audit trigger
SELECT * FROM user_activity WHERE action LIKE 'pastor.%';
```

---

## Rollback Instructions

If needed, revert migration:

```sql
DROP TRIGGER IF EXISTS pastor_profile_link_audit ON pastors;
DROP FUNCTION IF EXISTS log_pastor_profile_link_change();
DROP VIEW IF EXISTS pastor_user_access;
DROP INDEX IF EXISTS idx_pastors_profile_unique;
DROP INDEX IF EXISTS idx_pastors_profile_id;
ALTER TABLE pastors DROP CONSTRAINT IF EXISTS pastors_profile_id_fk;
ALTER TABLE pastors DROP COLUMN IF EXISTS profile_id;
```

---

## Best Practices

### ✅ **DO**
- Assign roles based on actual responsibilities
- Use `pastor` role for church leadership
- Use `treasurer` role for financial staff only
- Revoke access when pastor transitions out
- Keep pastoral records even after access revoked

### ❌ **DON'T**
- Give `admin` role to every pastor
- Delete pastor records (use revoke instead)
- Link multiple pastors to same profile
- Manually edit `profile_id` in database

---

## Troubleshooting

### **Issue**: "Profile already linked to another pastor"
**Solution**: Unlink the existing pastor first, then create new linkage.

### **Issue**: "Pastor already has a profile linked"
**Solution**: Unlink current profile before changing to a different one.

### **Issue**: "Invalid role"
**Solution**: Ensure role is one of: admin, district_supervisor, pastor, treasurer, secretary, member.

### **Issue**: Access revoked but pastor still shows as active
**Solution**: Check `pastor_user_access` view - `access_status` should be 'revoked'. Profile may still exist but not linked.

---

## Support

For technical issues or questions:
- **Admin Email**: administracion@ipupy.org.py
- **Documentation**: `/docs/guides/PASTOR_USER_MANAGEMENT.md`
- **API Reference**: `/docs/api/ADMIN_ENDPOINTS.md`
