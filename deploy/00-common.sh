#!/usr/bin/env bash
# Sourced by every deploy/NN-*.sh script. Not run directly.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
STATE_FILE="$DEPLOY_DIR/state.env"
ENV_DEPLOY_FILE="$DEPLOY_DIR/.env.deploy"

export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_PROFILE="${AWS_PROFILE:-getway}"

touch "$STATE_FILE"

# load_env_file PATH — reads KEY=value lines literally and exports them. Never treats
# the file as executable bash (unlike `source`), so a stray space/quote/$/backtick in a
# pasted secret can't be misparsed as shell syntax or, worse, executed.
load_env_file() {
  local file="$1" line key value
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    # Trim leading/trailing whitespace only (never touches the middle of the value) —
    # `KEY= value` (a common habit) would otherwise bake a stray leading space into a secret.
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    case "$key" in
      [A-Za-z_]*[A-Za-z0-9_]|[A-Za-z_]) ;;
      *) continue ;;
    esac
    export "$key=$value"
  done < "$file"
}

load_env_file "$STATE_FILE"
load_env_file "$ENV_DEPLOY_FILE"

# state_set KEY VALUE — persists a value to deploy/state.env for later scripts to read,
# and exports it into the current shell. Never used for secret values (those go straight
# to Secrets Manager in 04-secrets.sh, not into this file).
state_set() {
  local key="$1" value="$2"
  grep -v "^${key}=" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null || true
  mv "${STATE_FILE}.tmp" "$STATE_FILE"
  echo "${key}=${value}" >> "$STATE_FILE"
  export "${key}=${value}"
}

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required value: $name" >&2
    echo "  → check deploy/.env.deploy, or run the earlier step that sets it." >&2
    exit 1
  fi
}

# poll_until "description" "aws ... --query '...' --output text" "EXPECTED_VALUE" [max_tries] [sleep_secs]
poll_until() {
  local desc="$1" cmd="$2" expected="$3" max_tries="${4:-60}" sleep_secs="${5:-10}"
  local tries=0 status=""
  echo -n "Waiting for $desc"
  while [ "$tries" -lt "$max_tries" ]; do
    status="$(eval "$cmd" 2>/dev/null || echo "")"
    if [ "$status" = "$expected" ]; then
      echo " → $status"
      return 0
    fi
    echo -n "."
    sleep "$sleep_secs"
    tries=$((tries + 1))
  done
  echo
  echo "Timed out waiting for $desc (last status: '$status')" >&2
  return 1
}

echo "== $(basename "$0") — region: $AWS_REGION =="
