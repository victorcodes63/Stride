import type { Prisma } from '@prisma/client';
import type { StaffUser } from '@/lib/staff-api-auth';

/**
 * Internal-staff (tenant-own) biometric device configuration helpers.
 *
 * `StaffBiometricDevice.config` is a free-form JSON blob (the schema cannot be
 * changed). We keep a small typed contract on top of it so both the API routes
 * and the connection adapter read/write the same shape:
 *
 * - Connection details (`host`, `port`, `notes`, and optional Hikvision ISAPI
 *   credentials) — mirrors the outsourcing `BiometricDevice.config` contract
 *   consumed by `HikvisionIsapiAdapter`.
 * - `subjectMap` — a persisted `rawSubjectId -> userId` mapping used to resolve
 *   raw device/CSV punches to internal staff Users (since we cannot add a
 *   dedicated mapping table).
 */
export const STAFF_BIOMETRIC_ADAPTER_KINDS = ['hikvision_isapi', 'csv'] as const;
export type StaffBiometricAdapterKind = (typeof STAFF_BIOMETRIC_ADAPTER_KINDS)[number];

export type StaffDeviceConfig = {
  host?: string;
  port?: number;
  notes?: string;
  username?: string;
  password?: string;
  useHttps?: boolean;
  timezone?: string;
  /** rawSubjectId -> internal staff User id */
  subjectMap?: Record<string, string>;
};

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const v = record[key];
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return undefined;
}

function readPort(record: Record<string, unknown>): number | undefined {
  const p = record.port;
  if (typeof p === 'number' && Number.isFinite(p) && p > 0 && p < 65536) return Math.floor(p);
  if (typeof p === 'string' && /^\d+$/.test(p.trim())) {
    const n = Number(p.trim());
    if (n > 0 && n < 65536) return n;
  }
  return undefined;
}

/** Parse the raw JSON config into a typed, sanitized shape. */
export function parseStaffDeviceConfig(config: Prisma.JsonValue | null | undefined): StaffDeviceConfig {
  const record = asRecord(config);
  const out: StaffDeviceConfig = {};

  const host = readString(record, 'host') ?? readString(record, 'ip') ?? readString(record, 'address');
  if (host) out.host = host;
  const port = readPort(record);
  if (port) out.port = port;
  const notes = readString(record, 'notes');
  if (notes) out.notes = notes;
  const username = readString(record, 'username') ?? readString(record, 'user');
  if (username) out.username = username;
  const password = readString(record, 'password') ?? readString(record, 'pass');
  if (password) out.password = password;
  const timezone = readString(record, 'timezone') ?? readString(record, 'timeZone');
  if (timezone) out.timezone = timezone;
  if (record.useHttps === true || record.tls === true) out.useHttps = true;

  out.subjectMap = getSubjectMap(config);
  return out;
}

/** Extract the persisted `rawSubjectId -> userId` map from a device config blob. */
export function getSubjectMap(config: Prisma.JsonValue | null | undefined): Record<string, string> {
  const record = asRecord(config);
  const raw = record.subjectMap;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim() !== '' && key.trim() !== '') {
      out[key.trim()] = value.trim();
    }
  }
  return out;
}

/** Serialize a typed config to a Prisma-writable JSON value (drops empties). */
export function serializeStaffDeviceConfig(config: StaffDeviceConfig): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  if (config.host) out.host = config.host;
  if (typeof config.port === 'number') out.port = config.port;
  if (config.notes) out.notes = config.notes;
  if (config.username) out.username = config.username;
  if (config.password) out.password = config.password;
  if (config.useHttps) out.useHttps = true;
  if (config.timezone) out.timezone = config.timezone;
  out.subjectMap = config.subjectMap ?? {};
  return out as Prisma.InputJsonValue;
}

/** Public (non-secret) view of a device config — never leaks credentials to the client. */
export function publicStaffDeviceConfig(config: Prisma.JsonValue | null | undefined): {
  host: string | null;
  port: number | null;
  notes: string | null;
  timezone: string | null;
  useHttps: boolean;
  hasCredentials: boolean;
} {
  const parsed = parseStaffDeviceConfig(config);
  return {
    host: parsed.host ?? null,
    port: parsed.port ?? null,
    notes: parsed.notes ?? null,
    timezone: parsed.timezone ?? null,
    useHttps: Boolean(parsed.useHttps),
    hasCredentials: Boolean(parsed.username),
  };
}

export function isStaffBiometricAdapterKind(value: string): value is StaffBiometricAdapterKind {
  return (STAFF_BIOMETRIC_ADAPTER_KINDS as readonly string[]).includes(value);
}

/** Build a typed connection config from an API request body (credentials preserved). */
export function buildStaffDeviceConfigFromBody(body: Record<string, unknown>): StaffDeviceConfig {
  const config: StaffDeviceConfig = {};
  const host = typeof body.host === 'string' ? body.host.trim() : '';
  if (host) config.host = host;
  const portRaw = body.port;
  if (portRaw != null && String(portRaw).trim() !== '') {
    const port = parseInt(String(portRaw), 10);
    if (Number.isFinite(port) && port > 0 && port < 65536) config.port = port;
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes) config.notes = notes;
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (username) config.username = username;
  const password = typeof body.password === 'string' ? body.password : '';
  if (password) config.password = password;
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
  if (timezone) config.timezone = timezone;
  if (body.useHttps === true) config.useHttps = true;
  return config;
}

/**
 * Manage (create/edit/delete/import/map) is restricted to admins and business
 * managers; everyone else (including `viewer`) is read-only.
 */
export function canManageStaffBiometric(
  staff: Pick<StaffUser, 'role' | 'staffUserType'>,
): boolean {
  return staff.role === 'admin' || staff.staffUserType === 'business_manager';
}
