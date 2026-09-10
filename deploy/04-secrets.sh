#!/usr/bin/env bash
# Step 4 — push DATABASE_URL + app secrets to Secrets Manager. Values are read from
# deploy/state.env and deploy/.env.deploy and never printed by this script.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var DB_ENDPOINT
require_var DB_USERNAME
require_var DB_NAME
require_var DB_MASTER_PASSWORD
require_var CLERK_SECRET_KEY
require_var CLERK_WEBHOOK_SECRET
require_var STRIPE_SECRET_KEY
require_var STRIPE_WEBHOOK_SECRET
require_var GOOGLE_MAPS_API_KEY

DATABASE_URL="postgresql://${DB_USERNAME}:${DB_MASTER_PASSWORD}@${DB_ENDPOINT}:5432/${DB_NAME}?sslmode=require"

# put_secret NAME VALUE → prints only the secret's ARN to stdout (status goes to stderr),
# so `arn="$(put_secret ...)"` never accidentally captures anything but the ARN.
put_secret() {
  local name="$1" value="$2"
  if aws secretsmanager describe-secret --secret-id "$name" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --secret-id "$name" --secret-string "$value" >/dev/null
    echo "Updated secret: $name" >&2
  else
    aws secretsmanager create-secret --name "$name" --secret-string "$value" >/dev/null
    echo "Created secret: $name" >&2
  fi
  aws secretsmanager describe-secret --secret-id "$name" --query 'ARN' --output text
}

state_set DATABASE_URL_ARN            "$(put_secret getway/DATABASE_URL "$DATABASE_URL")"
state_set CLERK_SECRET_KEY_ARN        "$(put_secret getway/CLERK_SECRET_KEY "$CLERK_SECRET_KEY")"
state_set CLERK_WEBHOOK_SECRET_ARN    "$(put_secret getway/CLERK_WEBHOOK_SECRET "$CLERK_WEBHOOK_SECRET")"
state_set STRIPE_SECRET_KEY_ARN       "$(put_secret getway/STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY")"
state_set STRIPE_WEBHOOK_SECRET_ARN   "$(put_secret getway/STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET")"
state_set GOOGLE_MAPS_API_KEY_ARN     "$(put_secret getway/GOOGLE_MAPS_API_KEY "$GOOGLE_MAPS_API_KEY")"

echo "All 6 secrets are in Secrets Manager (values not shown here or anywhere in state.env)."
