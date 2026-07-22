-- Add EXTENSION_REQUESTED to ReservationStatus. Isolated in its own migration
-- because Postgres rejects ALTER TYPE ... ADD VALUE inside a transaction that
-- also runs other statements.
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'EXTENSION_REQUESTED';
