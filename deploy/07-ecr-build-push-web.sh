#!/usr/bin/env bash
# Step 7 — ECR repo + build/push the web image. Must run AFTER 06-apprunner-api.sh:
# NEXT_PUBLIC_* vars are inlined at build time, so the web image needs the API's real
# URL baked in before it's built.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"
require_var API_SERVICE_URL
require_var NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
require_var AWS_ACCOUNT_ID

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon isn't running — start Docker Desktop and re-run this script." >&2
  exit 1
fi

REPO_NAME="getway-web"
REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

aws ecr describe-repositories --repository-names "$REPO_NAME" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO_NAME" --image-scanning-configuration scanOnPush=true >/dev/null
state_set WEB_ECR_REPO_URI "$REPO_URI"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "Building getway-web image with NEXT_PUBLIC_API_URL=${API_SERVICE_URL} (a few minutes)..."
docker build --platform linux/amd64 \
  -f "$REPO_ROOT/apps/web/Dockerfile" \
  --build-arg "NEXT_PUBLIC_API_URL=${API_SERVICE_URL}" \
  --build-arg "NEXT_PUBLIC_SOCKET_URL=${API_SERVICE_URL}" \
  --build-arg "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}" \
  -t "${REPO_URI}:latest" "$REPO_ROOT"

echo "Pushing to ECR..."
docker push "${REPO_URI}:latest"

state_set WEB_IMAGE_URI "${REPO_URI}:latest"
echo "WEB_IMAGE_URI=${REPO_URI}:latest"
