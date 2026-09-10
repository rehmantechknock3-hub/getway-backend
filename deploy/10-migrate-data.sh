#!/usr/bin/env bash
# Step 10 — one-time data migration from the current Render Postgres into the new RDS
# instance. Briefly flips RDS to publicly accessible, scoped to only this machine's IP,
# then reverts both the public-access flag and the security-group rule no matter what
# (trap on EXIT) — RDS should never be left reachable from the internet.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var RENDER_DATABASE_URL
require_var DB_ENDPOINT
require_var DB_USERNAME
require_var DB_NAME
require_var DB_MASTER_PASSWORD
require_var RDS_SG_ID

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found — installing via Homebrew (libpq)..."
  brew install libpq
  brew link --force libpq
fi

DATABASE_URL="postgresql://${DB_USERNAME}:${DB_MASTER_PASSWORD}@${DB_ENDPOINT}:5432/${DB_NAME}?sslmode=require"
DB_IDENTIFIER="getway-db"
MY_IP="$(curl -s https://checkip.amazonaws.com)"

if [ -z "$MY_IP" ]; then
  echo "Could not determine this machine's public IP — aborting rather than risk an open rule." >&2
  exit 1
fi

echo "Temporarily allowing ${MY_IP}/32 to reach RDS directly for the migration..."
aws rds modify-db-instance --db-instance-identifier "$DB_IDENTIFIER" --publicly-accessible --apply-immediately >/dev/null
aws ec2 authorize-security-group-ingress --group-id "$RDS_SG_ID" --protocol tcp --port 5432 --cidr "${MY_IP}/32" >/dev/null

cleanup() {
  echo "Reverting RDS to private-only access..."
  aws ec2 revoke-security-group-ingress --group-id "$RDS_SG_ID" --protocol tcp --port 5432 --cidr "${MY_IP}/32" >/dev/null 2>&1 || true
  aws rds modify-db-instance --db-instance-identifier "$DB_IDENTIFIER" --no-publicly-accessible --apply-immediately >/dev/null 2>&1 || true
  echo "RDS is private-only again (no inbound from the internet)."
}
trap cleanup EXIT

poll_until "RDS instance available (after publicly-accessible toggle)" \
  "aws rds describe-db-instances --db-instance-identifier '$DB_IDENTIFIER' --query 'DBInstances[0].DBInstanceStatus' --output text" \
  "available" 30 10
echo "Giving the network change a moment to propagate..."
sleep 30

DUMP_FILE="$(mktemp -t getway-db).dump"
echo "Dumping the current Render database..."
pg_dump --format=custom --no-owner --no-acl --file="$DUMP_FILE" "$RENDER_DATABASE_URL"

echo "Restoring into the new RDS database (existing objects are dropped/recreated)..."
pg_restore --no-owner --no-acl --clean --if-exists --dbname="$DATABASE_URL" "$DUMP_FILE" || {
  echo "pg_restore reported errors above — check them before trusting the migration (some are expected/benign, e.g. 'role does not exist' from --no-owner)." >&2
}

rm -f "$DUMP_FILE"
echo
echo "Migration attempted. Spot-check before trusting it:"
echo "  psql \"\$RENDER_DATABASE_URL\" -c 'select count(*) from users; select count(*) from bookings;'"
echo "  psql \"$DATABASE_URL\" -c 'select count(*) from users; select count(*) from bookings;'"
echo "Row counts should match."
