#!/bin/bash

# Direct PostgreSQL database copy using pg_dump and pg_restore
# This is faster and simpler than using Prisma for large datasets

set -e  # Exit on error

# Source (local) database
SOURCE_DB="postgresql://neondb_owner:npg_Vq0poyB8OnUH@ep-small-mountain-admatw43-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Destination (production) database
DEST_DB="postgresql://neondb_owner:npg_sOGgE5quI7ab@ep-ancient-sunset-a16tps9b-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

echo "📤 Step 1: Dumping data from LOCAL database..."
echo "   Source: ep-small-mountain-admatw43-pooler"

# Extract connection details for pg_dump
SOURCE_HOST=$(echo $SOURCE_DB | sed -n 's/.*@\([^/]*\)\/.*/\1/p')
SOURCE_DBNAME=$(echo $SOURCE_DB | sed -n 's/.*\/\([^?]*\).*/\1/p')
SOURCE_USER=$(echo $SOURCE_DB | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
SOURCE_PASS=$(echo $SOURCE_DB | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Create dump file
DUMP_FILE="database-dump-$(date +%Y%m%d_%H%M%S).sql"
echo "   Creating dump file: $DUMP_FILE"

# Use PGPASSWORD environment variable for password
export PGPASSWORD="$SOURCE_PASS"

# Extract host and port
HOST_PORT=$(echo $SOURCE_HOST | sed 's/.*@//')
HOST=$(echo $HOST_PORT | cut -d: -f1)
PORT=$(echo $HOST_PORT | cut -d: -f2)
PORT=${PORT:-5432}

# Dump the database
pg_dump -h "$HOST" -p "$PORT" -U "$SOURCE_USER" -d "$SOURCE_DBNAME" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "$DUMP_FILE"

unset PGPASSWORD

echo "   ✓ Dump created: $DUMP_FILE"
echo "   File size: $(du -h $DUMP_FILE | cut -f1)"

echo ""
echo "📥 Step 2: Restoring data to PRODUCTION database..."
echo "   Destination: ep-ancient-sunset-a16tps9b-pooler"

# Extract connection details for pg_restore
DEST_HOST=$(echo $DEST_DB | sed -n 's/.*@\([^/]*\)\/.*/\1/p')
DEST_DBNAME=$(echo $DEST_DB | sed -n 's/.*\/\([^?]*\).*/\1/p')
DEST_USER=$(echo $DEST_DB | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DEST_PASS=$(echo $DEST_DB | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

export PGPASSWORD="$DEST_PASS"

# Extract host and port
DEST_HOST_PORT=$(echo $DEST_HOST | sed 's/.*@//')
DEST_HOST_ONLY=$(echo $DEST_HOST_PORT | cut -d: -f1)
DEST_PORT=$(echo $DEST_HOST_PORT | cut -d: -f2)
DEST_PORT=${DEST_PORT:-5432}

echo ""
echo "⚠️  WARNING: This will DELETE all existing data in production!"
echo "   Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

# Restore the database
psql -h "$DEST_HOST_ONLY" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DBNAME" -f "$DUMP_FILE"

unset PGPASSWORD

echo ""
echo "✅ Database copy complete!"
echo ""
echo "📊 Verifying data..."

# Quick verification
export PGPASSWORD="$DEST_PASS"
psql -h "$DEST_HOST_ONLY" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DBNAME" -c "
SELECT 
  (SELECT COUNT(*) FROM \"Zone\") as zones,
  (SELECT COUNT(*) FROM \"Equipment\") as equipment,
  (SELECT COUNT(*) FROM \"Schedule\") as schedules,
  (SELECT COUNT(*) FROM \"Engineer\") as engineers;
"
unset PGPASSWORD

echo ""
echo "🎉 Done! Production database now matches local."
echo ""
echo "💡 Tip: You can delete the dump file if you want:"
echo "   rm $DUMP_FILE"


