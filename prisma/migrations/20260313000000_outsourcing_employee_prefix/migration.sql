-- Optional prefix for auto employee numbers e.g. BW-001
ALTER TABLE "OutsourcingClient" ADD COLUMN IF NOT EXISTS "employeeNumberPrefix" TEXT;
