#!/bin/bash
# ─────────────────────────────────────────────────────────────
# LifeSe — Database Migration Script
# Migrates from JSON flat file (db.json) to PostgreSQL via Prisma
#
# USAGE:
#   1. Set DATABASE_URL in backend/.env to your PostgreSQL URL
#   2. Run: chmod +x scripts/migrate-to-postgres.sh && ./scripts/migrate-to-postgres.sh
# ─────────────────────────────────────────────────────────────

set -e  # Exit on any error

echo "🏥 LifeSe — Database Migration to PostgreSQL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL is not set in your environment."
    echo "   Add it to backend/.env"
    exit 1
fi

echo "📦 Step 1: Generate Prisma client..."
npx prisma generate

echo "🔨 Step 2: Push schema to database (creates tables)..."
npx prisma db push

echo "🗄️  Step 3: Migrate existing JSON data..."
node -e "
import('./src/db.js').then(({ getDb }) => {
  const db = getDb();
  console.log('Users to migrate:', db.users.length);
  console.log('Prescriptions to migrate:', db.prescriptions?.length || 0);
  console.log('Bookings to migrate:', db.bookings?.length || 0);
  console.log('');
  console.log('⚠️  Run the manual data import script (scripts/import-json-data.js) next.');
});
"

echo ""
echo "✅ Schema migration complete!"
echo ""
echo "👉 Next steps:"
echo "   1. Set DATABASE_URL in backend/.env"
echo "   2. Replace getDb() calls in routes with Prisma client"
echo "   3. Run: npx prisma studio to view your data"
echo ""
