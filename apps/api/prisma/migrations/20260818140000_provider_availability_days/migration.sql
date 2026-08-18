-- AlterTable
ALTER TABLE "provider_profiles" ADD COLUMN "availabilityDays" JSONB NOT NULL DEFAULT '[]';
