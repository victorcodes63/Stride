import type { OvertimeConfig } from './types';

/**
 * R6: Overtime minutes = max(0, workedLength − scheduledLength − dailyThresholdMinutes)
 * in whole minutes (lengths from instants, threshold from policy).
 */
export function computeOvertimeMinutes(
  workedStartMs: number,
  workedEndMs: number,
  scheduledStartMs: number,
  scheduledEndMs: number,
  config: OvertimeConfig
): number {
  const worked = workedEndMs - workedStartMs;
  const sched = scheduledEndMs - scheduledStartMs;
  const thMs = (config.dailyThresholdMinutes ?? 0) * 60_000;
  return Math.max(0, Math.floor((worked - sched - thMs) / 60_000));
}
