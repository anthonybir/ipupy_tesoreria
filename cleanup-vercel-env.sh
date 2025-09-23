#!/bin/bash

# Legacy variables to remove from Vercel
LEGACY_VARS=(
  "JWT_SECRET"
  "JWT_EXPIRES_IN"
  "ADMIN_EMAIL"
  "ADMIN_PASSWORD"
  "BCRYPT_ROUNDS"
  "RATE_LIMIT_REQUESTS"
  "RATE_LIMIT_WINDOW_MS"
  "ALLOWED_ORIGINS"
  "UPLOAD_PATH"
  "BACKUP_ENABLED"
  "BACKUP_FREQUENCY"
  "SMTP_PORT"
  "EMAIL_FROM"
  "SET_API_URL"
  "BANK_API_ENABLED"
  "DEBUG_SQL"
  "LOG_LEVEL"
)

echo "🧹 Removing legacy Express/JWT environment variables from Vercel..."

for var in "${LEGACY_VARS[@]}"; do
  echo "Removing $var..."

  # Try removing from each environment
  for env in production preview development; do
    vercel env rm "$var" "$env" --yes 2>/dev/null && echo "  ✓ Removed from $env" || echo "  - Not found in $env"
  done
done

echo ""
echo "✅ Legacy variables cleanup complete!"
echo ""
echo "📝 Now updating GOOGLE_ALLOWED_DOMAINS to remove admin@ipupy.org..."

# Update GOOGLE_ALLOWED_DOMAINS to only include ipupy.org.py
vercel env add GOOGLE_ALLOWED_DOMAINS production --yes <<< "ipupy.org.py"
vercel env add GOOGLE_ALLOWED_DOMAINS preview --yes <<< "ipupy.org.py"
vercel env add GOOGLE_ALLOWED_DOMAINS development --yes <<< "ipupy.org.py"

echo "✅ Updated GOOGLE_ALLOWED_DOMAINS"
echo ""
echo "🔍 Current environment variables:"
vercel env ls