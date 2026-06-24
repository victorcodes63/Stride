-- Deduplicate national IDs before unique constraint: keep earliest row (createdAt, then id) per
-- normalized ID; clear idNumber on other rows so staff can review and re-enter if needed.
UPDATE "Employee" AS e
SET "idNumber" = NULL
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim("idNumber"))
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Employee"
  WHERE "idNumber" IS NOT NULL AND trim("idNumber") <> ''
) AS sub
WHERE e.id = sub.id AND sub.rn > 1;

-- Align stored values with app normalization (trim + lowercase).
UPDATE "Employee"
SET "idNumber" = lower(trim("idNumber"))
WHERE "idNumber" IS NOT NULL AND trim("idNumber") <> '';

-- CreateIndex
CREATE UNIQUE INDEX "Employee_idNumber_key" ON "Employee"("idNumber");
