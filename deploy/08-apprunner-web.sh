#!/usr/bin/env bash
# Step 8 — App Runner service for the admin web dashboard. No VPC connector needed —
# it never talks to RDS directly, only to the API over the public internet.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var WEB_IMAGE_URI
require_var ACCESS_ROLE_ARN
require_var INSTANCE_ROLE_ARN
require_var CLERK_SECRET_KEY_ARN
require_var NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

SERVICE_NAME="getway-web"
CONFIG_FILE="$(mktemp)"
trap 'rm -f "$CONFIG_FILE"' EXIT

cat > "$CONFIG_FILE" <<JSON
{
  "ServiceName": "${SERVICE_NAME}",
  "SourceConfiguration": {
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": { "AccessRoleArn": "${ACCESS_ROLE_ARN}" },
    "ImageRepository": {
      "ImageIdentifier": "${WEB_IMAGE_URI}",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3000",
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}",
          "NEXT_PUBLIC_CLERK_SIGN_IN_URL": "/sign-in",
          "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL": "/dashboard"
        },
        "RuntimeEnvironmentSecrets": {
          "CLERK_SECRET_KEY": "${CLERK_SECRET_KEY_ARN}"
        }
      }
    }
  },
  "InstanceConfiguration": { "Cpu": "1 vCPU", "Memory": "2 GB", "InstanceRoleArn": "${INSTANCE_ROLE_ARN}" }
}
JSON

EXISTING_ARN="$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" --output text 2>/dev/null || true)"

if [ -n "$EXISTING_ARN" ] && [ "$EXISTING_ARN" != "None" ]; then
  echo "Service $SERVICE_NAME already exists — updating with the new image/config."
  python3 - "$CONFIG_FILE" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    cfg = json.load(f)
cfg.pop("ServiceName", None)
with open(sys.argv[1], "w") as f:
    json.dump(cfg, f)
PY
  aws apprunner update-service --service-arn "$EXISTING_ARN" --cli-input-json "file://$CONFIG_FILE" >/dev/null
  SERVICE_ARN="$EXISTING_ARN"
else
  SERVICE_ARN="$(aws apprunner create-service --cli-input-json "file://$CONFIG_FILE" --query 'Service.ServiceArn' --output text)"
  echo "Created service: $SERVICE_ARN"
fi

state_set WEB_SERVICE_ARN "$SERVICE_ARN"

poll_until "web service RUNNING" \
  "aws apprunner describe-service --service-arn '$SERVICE_ARN' --query 'Service.Status' --output text" \
  "RUNNING" 60 15

WEB_URL="https://$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --query 'Service.ServiceUrl' --output text)"
state_set WEB_SERVICE_URL "$WEB_URL"
echo "WEB_SERVICE_URL=$WEB_URL"
