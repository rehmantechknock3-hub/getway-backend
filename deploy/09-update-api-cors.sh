#!/usr/bin/env bash
# Step 9 — now that the web service has a real URL (step 8), point the API's
# WEB_URL/SOCKET_CORS_ORIGIN at it and redeploy. Runtime env var only — no image rebuild.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var API_SERVICE_ARN
require_var API_IMAGE_URI
require_var ACCESS_ROLE_ARN
require_var INSTANCE_ROLE_ARN
require_var VPC_CONNECTOR_ARN
require_var WEB_SERVICE_URL
require_var DATABASE_URL_ARN
require_var CLERK_SECRET_KEY_ARN
require_var CLERK_WEBHOOK_SECRET_ARN
require_var STRIPE_SECRET_KEY_ARN
require_var STRIPE_WEBHOOK_SECRET_ARN
require_var GOOGLE_MAPS_API_KEY_ARN

CONFIG_FILE="$(mktemp)"
trap 'rm -f "$CONFIG_FILE"' EXIT

cat > "$CONFIG_FILE" <<JSON
{
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
          "WEB_URL": "${WEB_SERVICE_URL}",
          "SOCKET_CORS_ORIGIN": "${WEB_SERVICE_URL}"
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

aws apprunner update-service --service-arn "$API_SERVICE_ARN" --cli-input-json "file://$CONFIG_FILE" >/dev/null

poll_until "API service RUNNING after CORS update" \
  "aws apprunner describe-service --service-arn '$API_SERVICE_ARN' --query 'Service.Status' --output text" \
  "RUNNING" 60 15

echo "API now trusts WEB_URL / SOCKET_CORS_ORIGIN = ${WEB_SERVICE_URL}"
