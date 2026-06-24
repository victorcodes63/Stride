import type { BiometricDeviceConfigRef } from './types';

/**
 * Single raw attendance event as returned by a device vendor API (before domain mapping).
 */
export interface RawPunch {
  /** Stable id from the device or ISAPI (for deduplication / append-only). */
  externalEventId: string;
  deviceConfigRef: BiometricDeviceConfigRef;
  /** Instant as reported by the device (parse/normalize in the mapper). */
  observedAt: Date;
  /** Vendor-specific subject identifier (e.g. card no.) until resolved to `employeeId`. */
  rawSubjectId: string;
  /** In/out if the vendor provides it; otherwise map to `unknown` in storage. */
  direction?: 'in' | 'out' | 'unknown';
  rawPayload?: Readonly<Record<string, unknown>>;
}

/**
 * Pluggable client for a biometric time terminal (Hikvision ISAPI, etc.).
 */
export interface BiometricAdapter {
  /**
   * Fetch new punch events after `since` (inclusive-exclusivity is adapter-defined; document in impl).
   * @param since - Optional watermark; if omitted, adapter may return a bounded recent window or empty.
   */
  pollEvents(since?: Date): Promise<RawPunch[]>;

  /** Check reachability / credentials; does not guarantee events exist. */
  testConnection(): Promise<boolean>;
}
