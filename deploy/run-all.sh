#!/usr/bin/env bash
# Runs steps 1–9 in order (everything except the data migration, which you trigger
# separately and deliberately with ./10-migrate-data.sh once you're ready for it).
# Safe to re-run — every step checks for and reuses what already exists.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for step in 01-iam 02-networking 03-rds 04-secrets 05-ecr-build-push-api 06-apprunner-api 07-ecr-build-push-web 08-apprunner-web 09-update-api-cors; do
  echo
  echo "############################################"
  echo "# $step"
  echo "############################################"
  bash "$DEPLOY_DIR/${step}.sh"
done

echo
echo "All done. API + web are RUNNING. Data migration is separate:"
echo "  bash deploy/10-migrate-data.sh"
