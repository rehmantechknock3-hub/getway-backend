# AWS deployment — App Runner (API + web) + RDS Postgres

Replaces the Render setup in `render.yaml` with equivalent AWS infrastructure in `us-east-1`, per
the plan in this conversation. Every script here is safe to re-run — each checks for what already
exists before creating anything new.

## Before running anything

1. **AWS credentials**, configured by you, never pasted into chat:
   ```
   aws configure
   ```
2. **Docker Desktop running** (needed for steps 5 and 7 — building/pushing images).
3. **Copy the secrets template and fill it in yourself**:
   ```
   cp deploy/.env.deploy.example deploy/.env.deploy
   # edit deploy/.env.deploy with your real values
   ```
   `deploy/.env.deploy` is gitignored. Nothing in it is ever printed by these scripts or shown
   in chat — it's read locally and piped straight into AWS Secrets Manager / App Runner.

## Running it

```
bash deploy/run-all.sh
```

Runs steps 1–9 in order — IAM role, networking (VPC connector + security groups), RDS, secrets,
build+push+deploy the API, build+push+deploy the web dashboard, then wires the API's CORS env vars
to the real web URL. Progress and resulting resource IDs/ARNs/URLs get appended to
`deploy/state.env` (also gitignored) as they're created, so a re-run after fixing an issue picks up
where it left off instead of recreating everything.

Or run any step individually, e.g. `bash deploy/03-rds.sh`, once its prerequisites (listed at the
top of each script via `require_var`) are already in `deploy/state.env` or `deploy/.env.deploy`.

## Data migration (separate, deliberate step)

Once the app is running on AWS and you're ready to bring over the existing Render data:

```
# add RENDER_DATABASE_URL to deploy/.env.deploy first (Render dashboard → Database → External
# Connection String), then:
bash deploy/10-migrate-data.sh
```

This briefly makes RDS reachable from this machine's IP only, dumps the Render DB, restores it
into RDS, then reverts RDS to private-only — even if the script fails partway through (it uses a
shell `trap` to guarantee the revert runs).

## After it's all up

- Update the webhook URLs in the **Clerk** dashboard and the **Stripe** dashboard to point at the
  new API URL (`deploy/state.env` → `API_SERVICE_URL`):
  - Clerk: `<API_SERVICE_URL>/api/v1/webhooks/clerk`
  - Stripe: `<API_SERVICE_URL>/api/v1/payments/webhook/stripe`
- Point the mobile app's `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL` (production builds only)
  at the new `API_SERVICE_URL`.
- Once you've verified everything end to end, decommissioning the Render services is your call —
  these scripts never touch Render.

## What gets created

| Resource | Name |
|---|---|
| IAM roles | `getway-apprunner-ecr-access-role` (image pull), `getway-apprunner-instance-role` (runtime Secrets Manager reads) |
| Security groups | `getway-apprunner-sg`, `getway-rds-sg` |
| App Runner VPC connector | `getway-vpc-connector` |
| RDS instance | `getway-db` (Postgres 16, `db.t4g.micro`, 20GB gp3, not publicly accessible) |
| Secrets Manager | `getway/DATABASE_URL`, `getway/CLERK_SECRET_KEY`, `getway/CLERK_WEBHOOK_SECRET`, `getway/STRIPE_SECRET_KEY`, `getway/STRIPE_WEBHOOK_SECRET`, `getway/GOOGLE_MAPS_API_KEY` |
| ECR repositories | `getway-api`, `getway-web` |
| App Runner services | `getway-api` (port 3001), `getway-web` (port 3000) |

Rough cost at this sizing: ~$30–50/month at idle (RDS ~$13–16, two App Runner services ~$10–25
combined, Secrets Manager ~$2.40). Scales up with real traffic.
