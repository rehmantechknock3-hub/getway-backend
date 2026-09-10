#!/usr/bin/env bash
# Step 2 — default-VPC networking: a security group for the App Runner VPC connector,
# a security group for RDS that only trusts that connector SG (never 0.0.0.0/0), and the
# connector itself.
source "$(dirname "${BASH_SOURCE[0]}")/00-common.sh"

VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
  echo "No default VPC found in $AWS_REGION." >&2
  echo "Either create one (aws ec2 create-default-vpc) or tell me which VPC/subnets to use instead." >&2
  exit 1
fi
state_set VPC_ID "$VPC_ID"
echo "Using default VPC: $VPC_ID"

SUBNET_IDS="$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text)"
if [ -z "$SUBNET_IDS" ]; then
  echo "Default VPC $VPC_ID has no subnets." >&2
  exit 1
fi
state_set SUBNET_IDS "$(echo "$SUBNET_IDS" | tr '\t' ',')"
echo "Subnets: $SUBNET_IDS"

# --- Security group for the App Runner VPC connector ---
APPRUNNER_SG_ID="$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=getway-apprunner-sg" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [ -z "$APPRUNNER_SG_ID" ] || [ "$APPRUNNER_SG_ID" = "None" ]; then
  APPRUNNER_SG_ID="$(aws ec2 create-security-group \
    --group-name getway-apprunner-sg \
    --description "App Runner VPC connector for getway-api / getway-web" \
    --vpc-id "$VPC_ID" --query 'GroupId' --output text)"
  echo "Created security group $APPRUNNER_SG_ID (getway-apprunner-sg)"
else
  echo "Reusing security group $APPRUNNER_SG_ID (getway-apprunner-sg)"
fi
state_set APPRUNNER_SG_ID "$APPRUNNER_SG_ID"

# --- Security group for RDS: inbound 5432 from the App Runner SG only ---
RDS_SG_ID="$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=getway-rds-sg" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [ -z "$RDS_SG_ID" ] || [ "$RDS_SG_ID" = "None" ]; then
  RDS_SG_ID="$(aws ec2 create-security-group \
    --group-name getway-rds-sg \
    --description "RDS Postgres - inbound 5432 only from getway-apprunner-sg" \
    --vpc-id "$VPC_ID" --query 'GroupId' --output text)"
  echo "Created security group $RDS_SG_ID (getway-rds-sg)"
else
  echo "Reusing security group $RDS_SG_ID (getway-rds-sg)"
fi
state_set RDS_SG_ID "$RDS_SG_ID"

aws ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG_ID" \
  --protocol tcp --port 5432 \
  --source-group "$APPRUNNER_SG_ID" \
  >/dev/null 2>&1 && echo "Added ingress rule: 5432 from $APPRUNNER_SG_ID" \
  || echo "Ingress rule 5432 from $APPRUNNER_SG_ID already present"

# --- VPC connector ---
# Not every AZ in a region supports App Runner VPC connectors — retry with the
# offending subnet(s) removed instead of failing outright.
CONNECTOR_ARN="$(aws apprunner list-vpc-connectors \
  --query "VpcConnectors[?VpcConnectorName=='getway-vpc-connector'] | sort_by(@, &VpcConnectorRevision)[-1].VpcConnectorArn" \
  --output text 2>/dev/null || true)"
if [ -z "$CONNECTOR_ARN" ] || [ "$CONNECTOR_ARN" = "None" ]; then
  usable_subnets="$SUBNET_IDS"
  attempt=0
  while [ "$attempt" -lt 6 ]; do
    attempt=$((attempt + 1))
    err_file="$(mktemp)"
    if CONNECTOR_ARN="$(aws apprunner create-vpc-connector \
      --vpc-connector-name getway-vpc-connector \
      --subnets $(echo "$usable_subnets" | tr ',' ' ') \
      --security-groups "$APPRUNNER_SG_ID" \
      --query 'VpcConnector.VpcConnectorArn' --output text 2>"$err_file")"; then
      rm -f "$err_file"
      break
    fi
    err="$(cat "$err_file")"
    rm -f "$err_file"
    if echo "$err" | grep -q "don't support App Runner services"; then
      bad_subnets="$(echo "$err" | grep -oE 'subnet-[a-z0-9]+')"
      echo "Excluding unsupported subnet(s): $(echo "$bad_subnets" | tr '\n' ' ')"
      for bad in $bad_subnets; do
        usable_subnets="$(echo "$usable_subnets" | tr ',' '\n' | grep -v "^${bad}$" | paste -sd, -)"
      done
      if [ -z "$usable_subnets" ]; then
        echo "No subnets left after excluding unsupported AZs." >&2
        exit 1
      fi
      continue
    fi
    echo "$err" >&2
    exit 1
  done
  echo "Created VPC connector: $CONNECTOR_ARN"
  poll_until "VPC connector ACTIVE" \
    "aws apprunner describe-vpc-connector --vpc-connector-arn '$CONNECTOR_ARN' --query 'VpcConnector.Status' --output text" \
    "ACTIVE" 30 10
else
  echo "Reusing VPC connector: $CONNECTOR_ARN"
fi
state_set VPC_CONNECTOR_ARN "$CONNECTOR_ARN"
echo "VPC_CONNECTOR_ARN=$CONNECTOR_ARN"
