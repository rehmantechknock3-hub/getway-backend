-- AlterTable: users.stripeCustomerId
DO $$
BEGIN
  ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- AlterTable: provider_profiles Stripe Connect fields
DO $$
BEGIN
  ALTER TABLE "provider_profiles" ADD COLUMN "stripeAccountId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "provider_profiles" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "provider_profiles" ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "provider_profiles" ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- AlterTable: payments capture/failure tracking
DO $$
BEGIN
  ALTER TABLE "payments" ADD COLUMN "capturedAt" TIMESTAMP(3);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "payments" ADD COLUMN "failureReason" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- CreateIndex (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripeCustomerId_key" ON "users"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "provider_profiles_stripeAccountId_key" ON "provider_profiles"("stripeAccountId");
