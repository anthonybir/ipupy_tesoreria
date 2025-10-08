# IPU PY Treasury System - Cleanup Plan

## Current Directory Structure Analysis

```
IPUPY_Tesoreria/                    # ROOT PROJECT DIRECTORY
├── src/                            # ✅ Active Express API backed by Supabase Postgres
│   ├── api/                        # Vercel-ready route handlers
│   └── lib/                        # Database adapters and shared helpers
├── public/                         # ✅ Offline dashboard assets served by Vercel
├── scripts/                        # ✅ Supabase administration and validation utilities
├── migrations/                     # ✅ SQL migrations executed against Supabase
├── docs/                           # ✅ Project documentation and planning
└── archive/                        # ♻️ Legacy artifacts retained for reference
```

## The Active Application

**`src/` + `public/` compose the current, fully-functional application:**
- ✅ Supabase Postgres integration through the shared `src/lib/db.js`
- ✅ ABSD design system implementation
- ✅ All 9 fund categories with initial balances
- ✅ Vercel deployment ready
- ✅ PWA with offline support
- ✅ Complete API endpoints

## Cleanup Strategy

### Phase 1: Safe Cleanup (Recommended First)

**Archive Legacy Files:**
```bash
# Move old files to archive directory
mkdir -p archive/legacy-versions/

# Archive old HTML versions
mv index.html archive/legacy-versions/
mv mobile.html archive/legacy-versions/

# Archive old Python server
mv server.py archive/legacy-versions/
mv start.sh archive/legacy-versions/

# Archive empty legacy databases
mv ipupy_treasurer.db archive/legacy-versions/
mv mydatabase.db archive/legacy-versions/

# Archive old compressed files
mv ipupy_treasurer.tar.gz archive/legacy-versions/
```

**Remove Empty/Minimal Directories:**
```bash
# Remove empty vercel-app
rm -rf vercel-app/

# Clean up minimal root package.json and node_modules
rm package.json package-lock.json
rm -rf node_modules/
```

### Phase 2: Project Restructure (Optional)

**Option A: Keep Current Structure**
- Keep `cloud-gateway/` as the main app directory
- Update documentation to reflect this

**Option B: Promote to Root (More Standard)**
```bash
# Move cloud-gateway contents to root
cp -r cloud-gateway/* ./
cp cloud-gateway/.* ./ 2>/dev/null || true
rm -rf cloud-gateway/

# Update any hardcoded paths in code
```

### Files to Keep (Essential)

**Business Documents:**
- ✅ `RESUMEN *.md` files (business requirements)
- ✅ `LISTA DE PASTORES.md`
- ✅ `Registro Diario IPU PY (1).xlsx` (source data)

**Technical Documentation:**
- ✅ `CLAUDE.md` (development instructions)
- ✅ `README.md` (project overview)
- ✅ `design_philosophy/` (ABSD design system)

**Configuration:**
- ✅ `.git/` (version control)
- ✅ `.gitignore`
- ✅ `LICENSE`

### Files to Archive/Remove

**Legacy Code:**
- ❌ Root `index.html` (replaced by cloud-gateway/public/)
- ❌ Root `mobile.html` (replaced by responsive design)
- ❌ `server.py` (replaced by Node.js)
- ❌ `*.sh` scripts (development artifacts)

**Empty/Minimal:**
- ❌ `vercel-app/` (empty legacy directory)
- ❌ Root `package.json` (minimal, superseded by cloud-gateway/)
- ❌ Root `node_modules/` (wrong location)

**Legacy Databases:**
- ❌ `*.db` files (legacy local SQLite snapshots superseded by Supabase)
- ❌ `*.tar.gz` (old backups)

## Recommended Action

**Execute Phase 1 cleanup immediately:**
1. Archive legacy files for safety
2. Remove empty directories
3. Clean up root-level Node.js artifacts

**Keep `cloud-gateway/` as the main app** - it's working perfectly and ready for production.

## Impact Assessment

✅ **Safe to clean up**: All functionality is preserved in `cloud-gateway/`
✅ **No data loss**: Source Excel file and business docs preserved
✅ **Deployment ready**: Vercel config in `cloud-gateway/` is complete
✅ **Development workflow**: All scripts and configs are in the right place

## File Size Savings

Estimated cleanup will remove:
- ~30MB of duplicate node_modules
- ~15MB of legacy HTML versions
- ~5MB of empty databases and archives
- **Total: ~50MB saved**

## Next Steps

1. **Review this plan** with stakeholders
2. **Execute Phase 1** cleanup (reversible)
3. **Test deployment** from `cloud-gateway/`
4. **Consider Phase 2** restructure (optional)
5. **Update documentation** to reflect new structure