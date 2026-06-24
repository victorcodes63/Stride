-- Ensure invoice numbers are globally unique across all clients.
-- Keep the first occurrence of an invoiceNumber as-is; re-number duplicates
-- to the next available numbers in created order.
WITH ranked AS (
  SELECT
    id,
    "invoiceNumber",
    ROW_NUMBER() OVER (
      PARTITION BY "invoiceNumber"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "AccountsInvoice"
),
dups AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
),
base AS (
  SELECT COALESCE(MAX("invoiceNumber"), 0) AS max_no
  FROM "AccountsInvoice"
),
reseq AS (
  SELECT
    d.id,
    b.max_no + ROW_NUMBER() OVER (ORDER BY ai."createdAt" ASC, ai.id ASC) AS new_no
  FROM dups d
  JOIN "AccountsInvoice" ai ON ai.id = d.id
  CROSS JOIN base b
)
UPDATE "AccountsInvoice" i
SET "invoiceNumber" = r.new_no
FROM reseq r
WHERE i.id = r.id;

-- Global unique constraint for invoiceNumber.
CREATE UNIQUE INDEX "AccountsInvoice_invoiceNumber_key" ON "AccountsInvoice"("invoiceNumber");
