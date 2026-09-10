#!/usr/bin/env bash
# Step 3 — RDS Postgres 16, db.t4g.micro, single-AZ, 20GB gp3, NOT publicly accessible.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var RDS_SG_ID

DB_IDENTIFIER="getway-db"
DB_NAME="marketplace"
DB_USERNAME="getway"

if aws rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" >/dev/null 2>&1; then
  echo "RDS instance $DB_IDENTIFIER already exists, reusing (not touching its password)."
else
  echo "Generating a random master password (alphanumeric only — safe to drop straight into a connection URL)..."
  DB_PASSWORD="$(aws secretsmanager get-random-password \
    --password-length 32 --exclude-punctuation --require-each-included-type \
    --query 'RandomPassword' --output text)"
  state_set DB_MASTER_PASSWORD "$DB_PASSWORD"

  aws rds create-db-instance \
    --db-instance-identifier "$DB_IDENTIFIER" \
    --db-instance-class db.t4g.micro \
    --engine postgres \
    --engine-version 16 \
    --master-username "$DB_USERNAME" \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage 20 \
    --storage-type gp3 \
    --db-name "$DB_NAME" \
    --vpc-security-group-ids "$RDS_SG_ID" \
    --no-publicly-accessible \
    --backup-retention-period 3 \
    --no-multi-az \
    --tags Key=Project,Value=getway \
    >/dev/null
  echo "RDS instance creation started — this takes several minutes."
fi

poll_until "RDS instance available" \
  "aws rds describe-db-instances --db-instance-identifier '$DB_IDENTIFIER' --query 'DBInstances[0].DBInstanceStatus' --output text" \
  "available" 60 20

ENDPOINT="$(aws rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" --query 'DBInstances[0].Endpoint.Address' --output text)"
state_set DB_ENDPOINT "$ENDPOINT"
state_set DB_NAME "$DB_NAME"
state_set DB_USERNAME "$DB_USERNAME"
echo "DB_ENDPOINT=$ENDPOINT"

if [ -z "${DB_MASTER_PASSWORD:-}" ]; then
  echo "Reusing an existing instance — DB_MASTER_PASSWORD isn't in state.env." >&2
  echo "If you need it again, reset it: aws rds modify-db-instance --db-instance-identifier $DB_IDENTIFIER --master-user-password '<new>' --apply-immediately" >&2
fi
