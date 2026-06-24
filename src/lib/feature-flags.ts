export type FeatureFlagKey = 'attendanceV2' | 'leavePolicyV2' | 'biometricOpsV2';

function parseBoolean(v: string | undefined, defaultValue = true): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

const envMap: Record<FeatureFlagKey, string> = {
  attendanceV2: 'FEATURE_ATTENDANCE_V2',
  leavePolicyV2: 'FEATURE_LEAVE_POLICY_V2',
  biometricOpsV2: 'FEATURE_BIOMETRIC_OPS_V2',
};

/** Platform capabilities default on — set FEATURE_*=false only to disable. */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return parseBoolean(process.env[envMap[key]], true);
}

export function listFeatureFlags() {
  return {
    attendanceV2: isFeatureEnabled('attendanceV2'),
    leavePolicyV2: isFeatureEnabled('leavePolicyV2'),
    biometricOpsV2: isFeatureEnabled('biometricOpsV2'),
  };
}

