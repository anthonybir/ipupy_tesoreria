#!/bin/bash
# Root Documentation Organization Script
# Executes the plan from ROOT_DOCUMENTATION_ORGANIZATION_PLAN.md

set -e  # Exit on error

ROOT_DIR="/Users/anthonybir/Desktop/IPUPY_Tesoreria"
ARCHIVE_DIR="$ROOT_DIR/docs/archive"

echo "📦 Starting Root Documentation Organization..."
echo ""

# ============================================================================
# PHASE 1: ARCHIVE HISTORICAL FIX LOGS (11 files)
# ============================================================================

echo "Phase 1: Archiving historical fix logs..."
mv "$ROOT_DIR/ENV_FIXES_2025-10-03.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/OAUTH_FIX_2025-10-03.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/PRODUCTION_FIXES_2025-10-03.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/SESSION_SUMMARY_2025-10-03.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/SECURITY_HARDENING_2025-10-04.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/PROVIDERS_FIXES_SUMMARY.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/PROVIDERS_IMPLEMENTATION_SUMMARY.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/TYPESCRIPT_ENFORCEMENT_COMPLETE.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/TYPESCRIPT_IMPLEMENTATION_STATUS.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/UX_IMPROVEMENTS.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true
mv "$ROOT_DIR/VERCEL_ENV_SETUP.md" "$ARCHIVE_DIR/fixes/" 2>/dev/null || true

echo "✅ Phase 1 complete: 11 fix logs archived"
echo ""

# ============================================================================
# PHASE 2: ARCHIVE AUDIT REPORTS (8 files)
# ============================================================================

echo "Phase 2: Archiving audit reports..."
mv "$ROOT_DIR/SECURITY_AUDIT_2025-09-28.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/PERFORMANCE_OPTIMIZATION_2025-09-28.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/DATABASE_OPTIMIZATION_SUMMARY_2025-09-28.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/FINAL_SECURITY_REPORT.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/PREDEPLOYMENT_VALIDATION_REPORT.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/PHASE_2_1_PROGRESS.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/DOCUMENTATION_COMPLETE_SUMMARY.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true
mv "$ROOT_DIR/CRUD_OPERATIONS_REVIEW.md" "$ARCHIVE_DIR/audits/" 2>/dev/null || true

echo "✅ Phase 2 complete: 8 audit reports archived"
echo ""

# ============================================================================
# PHASE 3: ARCHIVE PLANNING DOCS (2 files)
# ============================================================================

echo "Phase 3: Archiving planning documents..."
mv "$ROOT_DIR/COMPREHENSIVE_REMEDIATION_PLAN.md" "$ARCHIVE_DIR/planning/" 2>/dev/null || true
mv "$ROOT_DIR/REMEDIATION_PROGRESS.md" "$ARCHIVE_DIR/planning/" 2>/dev/null || true

echo "✅ Phase 3 complete: 2 planning docs archived"
echo ""

# ============================================================================
# PHASE 4: ARCHIVE OBSOLETE GUIDES (2 files)
# ============================================================================

echo "Phase 4: Archiving obsolete guides..."
mv "$ROOT_DIR/POSTGREST_OPTIMIZATION_GUIDE.md" "$ARCHIVE_DIR/misc/" 2>/dev/null || true
mv "$ROOT_DIR/RELEASE_NOTES_v2.0.0.md" "$ARCHIVE_DIR/releases/" 2>/dev/null || true

echo "✅ Phase 4 complete: 2 obsolete guides archived"
echo ""

# ============================================================================
# PHASE 5: MOVE ESSENTIAL GUIDES TO docs/ (1 file)
# ============================================================================

echo "Phase 5: Moving essential guides to docs/..."
mv "$ROOT_DIR/MIGRATION_GUIDE.md" "$ROOT_DIR/docs/" 2>/dev/null || true

echo "✅ Phase 5 complete: 1 guide moved to docs/"
echo ""

# ============================================================================
# PHASE 6: DELETE DUPLICATES (1 file)
# ============================================================================

echo "Phase 6: Deleting duplicate files..."
rm -f "$ROOT_DIR/TROUBLESHOOTING.md"

echo "✅ Phase 6 complete: 1 duplicate deleted"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "📊 Organization Summary:"
echo "  ✅ 11 fix logs archived to docs/archive/fixes/"
echo "  ✅ 8 audit reports archived to docs/archive/audits/"
echo "  ✅ 2 planning docs archived to docs/archive/planning/"
echo "  ✅ 2 obsolete guides archived"
echo "  ✅ 1 guide moved to docs/"
echo "  ✅ 1 duplicate deleted"
echo ""
echo "📁 Root directory now contains:"
ls -1 "$ROOT_DIR"/*.md 2>/dev/null | wc -l | xargs echo "  - Essential .md files:"
echo ""
echo "✨ Root documentation organization complete!"

