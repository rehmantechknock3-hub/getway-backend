#!/usr/bin/env bash
# Step 6 — App Runner service for the API, on the VPC connector, secrets wired from
# Secrets Manager. WEB_URL/SOCKET_CORS_ORIGIN start as placeholders — 09-update-api-cors.sh
# fixes them once the web service (step 8) has a real URL.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var API_IMAGE_URI
require_var ACCESS_ROLE_ARN
require_var INSTANCE_ROLE_ARN
require_var VPC_CONNECTOR_ARN
require_var DATABASE_URL_ARN
require_var CLERK_SECRET_KEY_ARN
require_var CLERK_WEBHOOK_SECRET_ARN
require_var STRIPE_SECRET_KEY_ARN
require_var STRIPE_WEBHOOK_SECRET_ARN
require_var GOOGLE_MAPS_API_KEY_ARN

SERVICE_NAME="getway-api"
CONFIG_FILE="$(mktemp)"
trap 'rm -f "$CONFIG_FILE"' EXIT

cat > "$CONFIG_FILE" <<JSON
{
  "ServiceName": "${SERVICE_NAME}",
  "SourceConfiguration": {
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": { "AccessRoleArn": "${ACCESS_ROLE_ARN}" },
    "ImageRepository": {
      "ImageIdentifier": "${API_IMAGE_URI}",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3001",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "HOST": "0.0.0.0",
          "PORT": "3001",
          "STRIPE_COMMISSION_PERCENT": "15",
          "DRIVING_DISTANCE_CACHE_TTL_HOURS": "24",
          "WEB_URL": "https://placeholder.invalid",
          "SOCKET_CORS_ORIGIN": "https://placeholder.invalid"
        },
        "RuntimeEnvironmentSecrets": {
          "DATABASE_URL": "${DATABASE_URL_ARN}",
          "CLERK_SECRET_KEY": "${CLERK_SECRET_KEY_ARN}",
          "CLERK_WEBHOOK_SECRET": "${CLERK_WEBHOOK_SECRET_ARN}",
          "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY_ARN}",
          "STRIPE_WEBHOOK_SECRET": "${STRIPE_WEBHOOK_SECRET_ARN}",
          "GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY_ARN}"
        }
      }
    }
  },
  "InstanceConfiguration": { "Cpu": "1 vCPU", "Memory": "2 GB", "InstanceRoleArn": "${INSTANCE_ROLE_ARN}" },
  "NetworkConfiguration": {
    "EgressConfiguration": { "EgressType": "VPC", "VpcConnectorArn": "${VPC_CONNECTOR_ARN}" }
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP", "Path": "/api/v1/health", "Interval": 10, "Timeout": 5,
    "HealthyThreshold": 1, "UnhealthyThreshold": 5
  }
}
JSON

EXISTING_ARN="$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" --output text 2>/dev/null || true)"

if [ -n "$EXISTING_ARN" ] && [ "$EXISTING_ARN" != "None" ]; then
  echo "Service $SERVICE_NAME already exists — updating with the new image/config."
  # update-service takes the same shape minus ServiceName/top-level service identity.
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

state_set API_SERVICE_ARN "$SERVICE_ARN"

poll_until "API service RUNNING" \
  "aws apprunner describe-service --service-arn '$SERVICE_ARN' --query 'Service.Status' --output text" \
  "RUNNING" 60 15

API_URL="https://$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --query 'Service.ServiceUrl' --output text)"
state_set API_SERVICE_URL "$API_URL"
echo "API_SERVICE_URL=$API_URL"
echo "Health check: curl ${API_URL}/api/v1/health"
