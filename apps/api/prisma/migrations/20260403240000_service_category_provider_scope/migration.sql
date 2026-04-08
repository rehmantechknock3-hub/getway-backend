-- Per-provider category labels; shared catalog rows keep "providerId" NULL.

ALTER TABLE "service_categories" ADD COLUMN "providerId" TEXT;

ALTER TABLE "service_categories"
  ADD CONSTRAINT "service_categories_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "service_categories" AS sc
SET "providerId" = sub.only_provider
FROM (
  SELECT s."categoryId", MIN(s."providerId") AS only_provider
  FROM "services" s
  GROUP BY s."categoryId"
  HAVING COUNT(DISTINCT s."providerId") = 1
) AS sub
WHERE sc.id = sub."categoryId";

CREATE INDEX "service_categories_providerId_idx" ON "service_categories"("providerId");

DROP INDEX IF EXISTS "service_categories_name_key";

CREATE UNIQUE INDEX "service_categories_shared_name_lower_key"
  ON "service_categories" (LOWER("name"))
  WHERE "providerId" IS NULL;

CREATE UNIQUE INDEX "service_categories_provider_name_lower_key"
  ON "service_categories" ("providerId", LOWER("name"))
  WHERE "providerId" IS NOT NULL;
