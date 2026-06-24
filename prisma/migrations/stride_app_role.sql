-- RAV-62: Application DB role — enforces RLS (no BYPASSRLS).
-- Run as neondb_owner: npm run db:app-role
-- Production: point DATABASE_URL at stride_app; keep neondb_owner for DIRECT_DATABASE_URL migrations only.

DO $do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'stride_app') THEN
    CREATE ROLE stride_app WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  ELSE
    ALTER ROLE stride_app WITH NOBYPASSRLS;
  END IF;
END
$do$;

GRANT CONNECT ON DATABASE neondb TO stride_app;
GRANT USAGE ON SCHEMA public TO stride_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stride_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stride_app;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stride_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO stride_app;

-- Allow owner to SET ROLE stride_app (for tests / admin tooling).
GRANT stride_app TO neondb_owner;
