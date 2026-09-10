#!/usr/bin/env bash
# Step 5 — ECR repo + build/push the API image. Needs Docker Desktop running locally.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon isn't running — start Docker Desktop and re-run this script." >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
state_set AWS_ACCOUNT_ID "$ACCOUNT_ID"

REPO_NAME="getway-api"
REPO_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

aws ecr describe-repositories --repository-names "$REPO_NAME" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO_NAME" --image-scanning-configuration scanOnPush=true >/dev/null
state_set API_ECR_REPO_URI "$REPO_URI"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "Building getway-api image (a few minutes)..."
docker build --platform linux/amd64 -f "$REPO_ROOT/apps/api/Dockerfile" -t "${REPO_URI}:latest" "$REPO_ROOT"

echo "Pushing to ECR..."
docker push "${REPO_URI}:latest"

state_set API_IMAGE_URI "${REPO_URI}:latest"
echo "API_IMAGE_URI=${REPO_URI}:latest"
