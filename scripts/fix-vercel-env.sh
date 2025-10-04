#!/bin/bash

# Fix Vercel environment variables with trailing newlines
# This script removes and re-adds variables to strip whitespace

PROJECT="ipupy-tesoreria"

echo "🔧 Fixing Vercel environment variables..."
echo ""

# Variables that need fixing based on inspection
VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "DATABASE_URL"
  "SUPABASE_SERVICE_KEY"
)

# Get current values (will have newlines)
for VAR in "${VARS[@]}"; do
  echo "Processing $VAR..."

  # Get value from production
  VALUE=$(vercel env pull --yes .env.temp 2>/dev/null && grep "^${VAR}=" .env.temp | cut -d'=' -f2- | tr -d '\n')

  if [ -z "$VALUE" ]; then
    echo "  ⚠️  No value found for $VAR, skipping..."
    continue
  fi

  # Remove from all environments
  vercel env rm "$VAR" production --yes 2>/dev/null
  vercel env rm "$VAR" preview --yes 2>/dev/null
  vercel env rm "$VAR" development --yes 2>/dev/null

  # Re-add with trimmed value
  echo "$VALUE" | vercel env add "$VAR" production --yes >/dev/null 2>&1
  echo "$VALUE" | vercel env add "$VAR" preview --yes >/dev/null 2>&1
  echo "$VALUE" | vercel env add "$VAR" development --yes >/dev/null 2>&1

  echo "  ✅ Fixed $VAR"
done

# Cleanup
rm -f .env.temp

echo ""
echo "✨ Done! Trigger a new deployment to apply changes."
echo "   Run: vercel --prod"
