#!/usr/bin/env bash
# Step 1 — two IAM roles App Runner needs:
#   1. Access role  — lets the App Runner build service pull images from this account's ECR.
#   2. Instance role — assumed by the *running* container, needed to read the getway/*
#      secrets from Secrets Manager at startup (RuntimeEnvironmentSecrets requires this).
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
state_set AWS_ACCOUNT_ID "$ACCOUNT_ID"

ACCESS_ROLE_NAME="getway-apprunner-ecr-access-role"
if aws iam get-role --role-name "$ACCESS_ROLE_NAME" >/dev/null 2>&1; then
  echo "IAM role $ACCESS_ROLE_NAME already exists, reusing."
else
  aws iam create-role \
    --role-name "$ACCESS_ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "Service": "build.apprunner.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }]
    }' \
    --description "Lets App Runner pull the getway-api/getway-web images from ECR" \
    >/dev/null

  aws iam attach-role-policy \
    --role-name "$ACCESS_ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"

  echo "Created $ACCESS_ROLE_NAME"
  NEEDS_PROPAGATION_WAIT=1
fi
ACCESS_ROLE_ARN="$(aws iam get-role --role-name "$ACCESS_ROLE_NAME" --query 'Role.Arn' --output text)"
state_set ACCESS_ROLE_ARN "$ACCESS_ROLE_ARN"
echo "ACCESS_ROLE_ARN=$ACCESS_ROLE_ARN"

INSTANCE_ROLE_NAME="getway-apprunner-instance-role"
if aws iam get-role --role-name "$INSTANCE_ROLE_NAME" >/dev/null 2>&1; then
  echo "IAM role $INSTANCE_ROLE_NAME already exists, reusing."
else
  aws iam create-role \
    --role-name "$INSTANCE_ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }]
    }' \
    --description "Assumed by the running getway-api/getway-web containers to read Secrets Manager values" \
    >/dev/null

  aws iam put-role-policy \
    --role-name "$INSTANCE_ROLE_NAME" \
    --policy-name "getway-secrets-read" \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Action\": \"secretsmanager:GetSecretValue\",
        \"Resource\": \"arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:getway/*\"
      }]
    }"

  echo "Created $INSTANCE_ROLE_NAME"
  NEEDS_PROPAGATION_WAIT=1
fi
INSTANCE_ROLE_ARN="$(aws iam get-role --role-name "$INSTANCE_ROLE_NAME" --query 'Role.Arn' --output text)"
state_set INSTANCE_ROLE_ARN "$INSTANCE_ROLE_ARN"
echo "INSTANCE_ROLE_ARN=$INSTANCE_ROLE_ARN"

if [ -n "${NEEDS_PROPAGATION_WAIT:-}" ]; then
  echo "Waiting ~10s for IAM propagation..."
  sleep 10
fi
