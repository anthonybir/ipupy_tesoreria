# WS-4 Profile Migration Dry-Run Guide (T-451/T-452)

## Prerequisites

### 1. Get Convex Admin Key

The migration script requires a Convex admin/deploy key to write to the database.

**Option A: From Convex Dashboard (Recommended)**
1. Go to https://dashboard.convex.dev
2. Select your project: `dashing-clownfish-472`
3. Go to **Settings** → **Deploy Keys**
4. Copy the **Deploy Key** (starts with `prod:...` or similar)

**Option B: From Local Convex CLI**
```bash
# If you have convex CLI logged in
cat ~/.convex/config.json | grep "deploymentName"
# Or check the .convex directory in your project
cat .convex/deployment_name
```

### 2. Set Environment Variables

Create or update `.env.local` with:

```bash
# Already set
NEXT_PUBLIC_CONVEX_URL=https://dashing-clownfish-472.convex.cloud

# Add this (get from Convex dashboard)
CONVEX_ADMIN_KEY=prod:dashing-clownfish-472|...your-key-here...

# Optional overrides
CONVEX_ADMIN_EMAIL=administracion@ipupy.org.py  # Default admin for migration script
PROFILE_SOURCE_FILE=convex-data/profiles.json    # Default source file
```

---

## Migration Data Preview

Current profiles to migrate (from `convex-data/profiles.json`):

- **Profile 1**: `administracion@ipupy.org.py` (active, has full_name)
- **Profile 2**: `administracion@ipupy.org.py` (inactive, duplicate)

**Expected behavior**:
- Script will deduplicate by email
- Latest `updated_at` timestamp wins
- Result: **1 profile** created/updated (not 2)

---

## Dry-Run Execution (T-451)

### Step 1: Run Dry-Run

```bash
npm run migrate:profiles -- --dry-run
```

**Expected output:**
```
DRY-RUN: upsertProfile {
  "email": "administracion@ipupy.org.py",
  "role": "admin",
  "active": true,
  "full_name": "Administrador IPUPY",
  "user_id": null,
  "church_supabase_id": null,
  "fund_supabase_id": null,
  "created_at": 1726797785584,
  "updated_at": 1727243276533
}

Migration Summary
-----------------
Total profiles: 1
Created:        0
Updated:        0
Skipped:        1   ← All skipped in dry-run
Errors:         0

ℹ️  Dry-run mode: no data was modified.
```

### Step 2: Verify Dry-Run Logic

Check that the script:
- ✅ Deduplicates 2 admin profiles → 1 record
- ✅ Picks latest `updated_at` (Oct 5, 2025 version)
- ✅ Normalizes email to lowercase
- ✅ Maps `is_active` → `active`
- ✅ Shows "Skipped: 1" (because dry-run)
- ✅ No errors

---

## Production Migration (T-452) - DO NOT RUN YET

**⚠️ IMPORTANT**: Only run actual migration after:
1. ✅ Dry-run completes successfully
2. ✅ Convex deployment is current (not behind)
3. ✅ Database backup exists (Convex auto-backups daily)
4. ✅ You're ready to test auth flow immediately after

### When Ready to Migrate:

```bash
# Remove --dry-run flag
npm run migrate:profiles
```

**Expected output:**
```
Migration Summary
-----------------
Total profiles: 1
Created:        1   ← Profile inserted into Convex
Updated:        0
Skipped:        0
Errors:         0

✅ Migration completed without errors.
```

### Post-Migration Verification:

1. **Check Convex Dashboard**
   ```
   https://dashboard.convex.dev
   → Tables → profiles
   → Should see: administracion@ipupy.org.py
   → user_id: <Convex ID> (not email string)
   → role: "admin"
   → active: true
   ```

2. **Check users table**
   ```
   Tables → users
   → Should see: administracion@ipupy.org.py
   → email: administracion@ipupy.org.py
   → name: "Administrador IPUPY"
   ```

3. **Test Auth Flow** (immediate smoke test)
   ```bash
   # Terminal 1
   npx convex dev

   # Terminal 2
   npm run dev

   # Browser: http://localhost:3000/login
   # Sign in with administracion@ipupy.org.py
   # Should NOT create duplicate profile
   # Should update existing profile's updated_at
   ```

---

## Troubleshooting

### Error: "Missing CONVEX_URL"
**Fix**: Set `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_URL` in `.env.local`

### Error: "Missing Convex admin key"
**Fix**: Get deploy key from Convex dashboard → Settings → Deploy Keys

### Error: "No profiles found in export"
**Check**:
```bash
cat convex-data/profiles.json
# Should show 2 JSON objects
```

### Error: "Usuario de Convex Auth no encontrado"
**Cause**: Migration script ran but `users` table doesn't have the user yet

**Fix**: Migration script should create user record automatically (check `upsertProfile` implementation)

### Dry-run shows "Errors: 1+"
**Action**:
1. Read error message in output
2. Check `convex/migrations.ts` for validation logic
3. Fix profiles.json data if needed
4. Re-run dry-run

---

## Success Criteria (T-452)

Before marking complete:

- ✅ Dry-run completes with 0 errors
- ✅ Dry-run shows expected deduplication (2 → 1)
- ✅ Production migration completes with 0 errors
- ✅ Convex dashboard shows 1 profile for admin
- ✅ Auth flow test confirms no duplicate creation
- ✅ `user_id` field is Convex ID (not email)

---

## Next Steps After Migration

1. Mark T-452 complete in TASK_TRACKER.md
2. Update CHANGELOG.md with migration details
3. Proceed to T-453 (remove NextAuth files) if all tests pass
4. Document any edge cases found during migration

---

## Notes

- **Idempotent**: Running migration multiple times is safe (upserts)
- **Historical data**: Current Convex data is from spreadsheet imports (Oct 7)
- **Fresh start**: Production launch will seed fresh data
- **Email-based fallback**: Migration preserves Supabase UUIDs but Convex uses email matching
