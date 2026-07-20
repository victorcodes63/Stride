import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPROVER_ROLE,
  resolveApprovalSteps,
  type ApprovalPolicyInput,
} from '@/lib/procurement/approvals';

const policies: ApprovalPolicyInput[] = [
  { stepOrder: 1, minAmount: 0, maxAmount: 100000, approverRole: 'line_manager', approverUserId: null, active: true },
  { stepOrder: 2, minAmount: 50000, maxAmount: null, approverRole: 'finance_director', approverUserId: null, active: true },
  { stepOrder: 3, minAmount: 0, maxAmount: 100000, approverRole: 'inactive', approverUserId: null, active: false },
];

describe('procurement approvals resolver', () => {
  it('falls back to a single manager step when no policy is configured', () => {
    const steps = resolveApprovalSteps([], 25000);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ stepOrder: 1, approverRole: DEFAULT_APPROVER_ROLE, status: 'pending' });
  });

  it('selects policies whose amount band contains the amount and renumbers sequentially', () => {
    const steps = resolveApprovalSteps(policies, 75000);
    expect(steps.map((s) => s.approverRole)).toEqual(['line_manager', 'finance_director']);
    expect(steps.map((s) => s.stepOrder)).toEqual([1, 2]);
  });

  it('ignores inactive policies and respects the upper bound', () => {
    const steps = resolveApprovalSteps(policies, 20000);
    expect(steps.map((s) => s.approverRole)).toEqual(['line_manager']);
  });

  it('applies unbounded (null maxAmount) upper policies for large amounts', () => {
    const steps = resolveApprovalSteps(policies, 500000);
    expect(steps.map((s) => s.approverRole)).toEqual(['finance_director']);
  });
});
