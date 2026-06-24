import type { DisciplinaryAction, DisciplinaryActionType, DisciplinarySeverity } from '@prisma/client';

const DISCIPLINE_SEQUENCE: DisciplinaryActionType[] = [
  'VERBAL_WARNING',
  'WRITTEN_WARNING',
  'FINAL_WARNING',
  'SHOW_CAUSE_LETTER',
  'HEARING',
];

const TERMINAL_ACTIONS: DisciplinaryActionType[] = ['SUSPENSION', 'DEMOTION', 'TERMINATION', 'CASE_DISMISSED'];
const MIN_INTERVAL_DAYS = 7;

export function validateNextAction(
  existingActions: Pick<DisciplinaryAction, 'type' | 'actionDate' | 'employeeAcknowledged' | 'acknowledgedAt'>[],
  proposedType: DisciplinaryActionType,
  severity: DisciplinarySeverity,
): { valid: boolean; message?: string; warnings: string[] } {
  const warnings: string[] = [];
  const sorted = [...existingActions].sort((a, b) => a.actionDate.getTime() - b.actionDate.getTime());
  const last = sorted[sorted.length - 1];

  if (!last) {
    if (severity === 'GROSS') {
      if (!['SHOW_CAUSE_LETTER', 'HEARING', 'SUSPENSION', 'DEMOTION', 'TERMINATION'].includes(proposedType)) {
        warnings.push('Gross misconduct should begin from show-cause, hearing, or final sanction.');
      }
      return { valid: true, warnings };
    }
    if (proposedType !== 'VERBAL_WARNING') {
      return { valid: false, message: 'A verbal warning should be issued first.', warnings };
    }
    return { valid: true, warnings };
  }

  if (TERMINAL_ACTIONS.includes(last.type)) {
    return { valid: false, message: `Case already reached terminal action: ${last.type}.`, warnings };
  }

  if (!last.employeeAcknowledged) {
    warnings.push(`Previous step (${last.type}) is not acknowledged by employee.`);
  }

  const intervalDays = Math.floor((Date.now() - last.actionDate.getTime()) / (1000 * 60 * 60 * 24));
  if (intervalDays < MIN_INTERVAL_DAYS) {
    warnings.push(`Only ${intervalDays} day(s) since last action. Recommended minimum is ${MIN_INTERVAL_DAYS} days.`);
  }

  if (severity === 'GROSS') {
    if (DISCIPLINE_SEQUENCE.includes(proposedType) || TERMINAL_ACTIONS.includes(proposedType)) {
      return { valid: true, warnings };
    }
    return { valid: false, message: 'Invalid disciplinary action type.', warnings };
  }

  const lastSeq = DISCIPLINE_SEQUENCE.indexOf(last.type);
  const nextExpected = lastSeq >= 0 && lastSeq < DISCIPLINE_SEQUENCE.length - 1 ? DISCIPLINE_SEQUENCE[lastSeq + 1] : null;

  if (last.type === 'HEARING') {
    if (!TERMINAL_ACTIONS.includes(proposedType)) {
      return { valid: false, message: 'After hearing, select suspension, demotion, termination, or case dismissed.', warnings };
    }
    return { valid: true, warnings };
  }

  if (nextExpected && proposedType !== nextExpected) {
    return {
      valid: false,
      message: `${nextExpected.replaceAll('_', ' ')} should be issued before ${proposedType.replaceAll('_', ' ')}.`,
      warnings,
    };
  }

  return { valid: true, warnings };
}

export function toCaseNumber(year: number, sequence: number): string {
  return `DC-${year}-${String(sequence).padStart(3, '0')}`;
}

export function toGrievanceNumber(year: number, sequence: number): string {
  return `GR-${year}-${String(sequence).padStart(3, '0')}`;
}
