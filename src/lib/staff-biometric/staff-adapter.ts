import type { StaffBiometricDevice } from '@prisma/client';
import type { BiometricAdapter, RawPunch } from '@/lib/biometric/biometric-adapter';
import { HikvisionIsapiAdapter } from '@/lib/biometric/hikvision-isapi-adapter';

/**
 * Resolve a `StaffBiometricDevice` to a poll/test adapter.
 *
 * The internal-staff device row is structurally compatible with the outsourcing
 * `BiometricDevice` fields the adapters read (`id`, `adapterKind`, `config`),
 * so we reuse the existing (read-only) Hikvision ISAPI adapter.
 */
export type StaffDeviceRow = Pick<StaffBiometricDevice, 'id' | 'adapterKind' | 'config'>;

/** Adapter kinds that support a live network connection test / device poll. */
export function staffAdapterSupportsConnection(adapterKind: string): boolean {
  return adapterKind === 'hikvision_isapi';
}

export function staffAdapterForDevice(device: StaffDeviceRow): BiometricAdapter {
  switch (device.adapterKind) {
    case 'hikvision_isapi':
    default:
      return new HikvisionIsapiAdapter(device);
  }
}

export type StaffProbeResult = {
  ok: boolean;
  httpStatus?: number;
  deviceInfo?: Record<string, unknown>;
  error?: string;
};

/** Probe reachability/credentials for a staff device (Hikvision ISAPI only). */
export async function probeStaffDevice(device: StaffDeviceRow): Promise<StaffProbeResult> {
  if (device.adapterKind !== 'hikvision_isapi') {
    return {
      ok: false,
      error: `Connection test is not available for adapter "${device.adapterKind}".`,
    };
  }
  const adapter = new HikvisionIsapiAdapter(device);
  return adapter.probeConnection();
}

/** Poll new raw punches from a staff device since `since` (Hikvision ISAPI only). */
export async function pollStaffDevice(device: StaffDeviceRow, since?: Date): Promise<RawPunch[]> {
  if (!staffAdapterSupportsConnection(device.adapterKind)) return [];
  const adapter = staffAdapterForDevice(device);
  return adapter.pollEvents(since);
}
