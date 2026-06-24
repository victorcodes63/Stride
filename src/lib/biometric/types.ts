/**
 * M1 — Biometric ingestion: core types.
 *
 * Append-only semantics (enforced in persistence layer, not here):
 * - Punch rows and device event logs are never updated in place; corrections are new rows
 *   or flagging workflows that refer to the original id.
 * - Polling from devices only appends new events; dedupe by stable external event id + device.
 */

/** ISO-8601 instant string (map to/from DB and vendor APIs at boundaries). */
export type ISODateTimeString = string;

/**
 * Reference to a persisted biometric device configuration record (e.g. Prisma id).
 * Ownership of schema/migrations is outside this module.
 */
export interface BiometricDeviceConfigRef {
  id: string;
}

/**
 * Normalized time punch after vendor-specific mapping (M1 → downstream e.g. shift engine).
 */
export interface Punch {
  id: string;
  employeeId: string;
  at: ISODateTimeString;
  type: 'in' | 'out' | 'unknown';
  source: 'device' | 'manual';
}
