export type CheckpointTask = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  isRequired: boolean;
  dueDate: Date | null;
  order: number;
};

const OFFBOARDING_CHECKPOINTS = {
  clearance: ['clearance'],
  assetRecovery: ['collect', 'asset', 'equipment', 'badge', 'uniform', 'keys'],
  accessRevocation: ['revoke', 'access', 'credential', 'login', 'biometric'],
  finalSettlement: ['final pay', 'settle', 'loan', 'advance', 'settlement'],
  evidenceArchive: ['archive', 'records', 'certificate', 'signed', 'document'],
} as const;

export type OffboardingCheckpointKey = keyof typeof OFFBOARDING_CHECKPOINTS;
export type OffboardingCheckpointState = Record<OffboardingCheckpointKey, { present: boolean; satisfied: boolean }>;

function normalizeTaskText(task: Pick<CheckpointTask, 'title' | 'category'>): string {
  return `${task.title} ${task.category ?? ''}`.toLowerCase();
}

function taskMatchesKeywords(task: Pick<CheckpointTask, 'title' | 'category'>, keywords: readonly string[]): boolean {
  const text = normalizeTaskText(task);
  return keywords.some((keyword) => text.includes(keyword));
}

export function deriveOffboardingCheckpointState(tasks: CheckpointTask[]): OffboardingCheckpointState {
  const state: OffboardingCheckpointState = {
    clearance: { present: false, satisfied: false },
    assetRecovery: { present: false, satisfied: false },
    accessRevocation: { present: false, satisfied: false },
    finalSettlement: { present: false, satisfied: false },
    evidenceArchive: { present: false, satisfied: false },
  };

  for (const checkpoint of Object.keys(OFFBOARDING_CHECKPOINTS) as OffboardingCheckpointKey[]) {
    const matchingTasks = tasks.filter((task) => taskMatchesKeywords(task, OFFBOARDING_CHECKPOINTS[checkpoint]));
    if (matchingTasks.length === 0) continue;
    state[checkpoint].present = true;
    state[checkpoint].satisfied = matchingTasks.some((task) => task.status === 'COMPLETED');
  }
  return state;
}

export function getUnsatisfiedOffboardingCheckpoints(tasks: CheckpointTask[]): OffboardingCheckpointKey[] {
  const state = deriveOffboardingCheckpointState(tasks);
  return (Object.keys(state) as OffboardingCheckpointKey[]).filter((checkpoint) => {
    const item = state[checkpoint];
    return item.present && !item.satisfied;
  });
}
