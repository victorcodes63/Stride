import { OnboardingTaskStatus, WorkflowType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  getTaskDependencyBlocker,
  getUnsatisfiedOffboardingCheckpoints,
} from '@/lib/onboarding-workflows';

function makeTask(partial: Partial<{
  id: string;
  title: string;
  category: string | null;
  assignedRole: string;
  status: OnboardingTaskStatus;
  isRequired: boolean;
  dueDate: Date | null;
  order: number;
}> = {}) {
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? 'Task',
    category: partial.category ?? 'Process',
    assignedRole: partial.assignedRole ?? 'hr',
    status: partial.status ?? OnboardingTaskStatus.PENDING,
    isRequired: partial.isRequired ?? true,
    dueDate: partial.dueDate ?? null,
    order: partial.order ?? 1,
  };
}

describe('onboarding dependencies', () => {
  it('blocks orientation completion until required setup tasks are done', () => {
    const tasks = [
      makeTask({ title: 'Collect signed employment contract', category: 'Documents', status: OnboardingTaskStatus.PENDING }),
      makeTask({ title: 'Create system login credentials', category: 'Access', status: OnboardingTaskStatus.PENDING }),
      makeTask({ title: 'Department orientation and tour', category: 'Orientation', status: OnboardingTaskStatus.PENDING }),
    ];
    const blocker = getTaskDependencyBlocker({
      workflowType: WorkflowType.ONBOARDING,
      targetTask: tasks[2],
      tasks,
    });
    expect(blocker).toContain('Complete required document/access/compliance tasks');
  });
});

describe('offboarding checkpoint safety', () => {
  it('flags unsatisfied access and asset checkpoints to avoid orphaned resources', () => {
    const tasks = [
      makeTask({ title: 'Revoke system access', category: 'Access', status: OnboardingTaskStatus.PENDING }),
      makeTask({ title: 'Collect keys, equipment, uniform', category: 'Equipment', status: OnboardingTaskStatus.PENDING }),
      makeTask({ title: 'Archive employee records', category: 'Process', status: OnboardingTaskStatus.PENDING }),
    ];
    const unsatisfied = getUnsatisfiedOffboardingCheckpoints(tasks);
    expect(unsatisfied).toContain('accessRevocation');
    expect(unsatisfied).toContain('assetRecovery');
  });

  it('allows evidence archive only after required leaver checkpoints are complete', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Revoke system access', category: 'Access', status: OnboardingTaskStatus.COMPLETED }),
      makeTask({ id: 'b', title: 'Collect keys, equipment, uniform', category: 'Equipment', status: OnboardingTaskStatus.COMPLETED }),
      makeTask({ id: 'c', title: 'Run final settlement', category: 'Finance', status: OnboardingTaskStatus.COMPLETED }),
      makeTask({ id: 'd', title: 'Return signed clearance form', category: 'Documents', status: OnboardingTaskStatus.COMPLETED }),
      makeTask({ id: 'e', title: 'Archive employee records', category: 'Process', status: OnboardingTaskStatus.PENDING }),
    ];
    const blocker = getTaskDependencyBlocker({
      workflowType: WorkflowType.OFFBOARDING,
      targetTask: tasks[4],
      tasks,
    });
    expect(blocker).toBeNull();
  });
});
