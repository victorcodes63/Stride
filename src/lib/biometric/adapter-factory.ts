import type { BiometricDevice } from '@prisma/client';
import type { BiometricAdapter } from './biometric-adapter';
import { HikvisionIsapiAdapter } from './hikvision-isapi-adapter';

/**
 * Resolves a persisted `BiometricDevice` to a poll/test adapter implementation.
 */
export function adapterForDevice(
  device: Pick<BiometricDevice, 'id' | 'adapterKind' | 'config'>
): BiometricAdapter {
  switch (device.adapterKind) {
    case 'hikvision_isapi':
    default:
      return new HikvisionIsapiAdapter(device);
  }
}
