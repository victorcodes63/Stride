import type {
  GovernanceActionItem,
  GovernanceMeeting,
  GovernanceResolution,
  User,
} from '@prisma/client';

type UserPick = Pick<User, 'id' | 'name' | 'email'>;

export function serializeMeeting(
  row: GovernanceMeeting & {
    createdBy?: UserPick | null;
    _count?: { resolutions: number; actions: number };
  },
) {
  return {
    id: row.id,
    meetingCode: row.meetingCode,
    title: row.title,
    meetingDate: row.meetingDate.toISOString().slice(0, 10),
    location: row.location,
    minutesSummary: row.minutesSummary,
    status: row.status,
    resolutionCount: row._count?.resolutions ?? undefined,
    actionCount: row._count?.actions ?? undefined,
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeResolution(
  row: GovernanceResolution & {
    meeting?: Pick<GovernanceMeeting, 'id' | 'meetingCode' | 'title'> | null;
    _count?: { actions: number };
  },
) {
  return {
    id: row.id,
    resolutionCode: row.resolutionCode,
    meetingId: row.meetingId,
    title: row.title,
    description: row.description,
    status: row.status,
    adoptedAt: row.adoptedAt?.toISOString().slice(0, 10) ?? null,
    effectiveDate: row.effectiveDate?.toISOString().slice(0, 10) ?? null,
    actionCount: row._count?.actions ?? undefined,
    meeting: row.meeting
      ? { id: row.meeting.id, meetingCode: row.meeting.meetingCode, title: row.meeting.title }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeAction(
  row: GovernanceActionItem & {
    meeting?: Pick<GovernanceMeeting, 'id' | 'meetingCode' | 'title'> | null;
    resolution?: Pick<GovernanceResolution, 'id' | 'resolutionCode' | 'title'> | null;
    assignee?: UserPick | null;
  },
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    meetingId: row.meetingId,
    resolutionId: row.resolutionId,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    meeting: row.meeting
      ? { id: row.meeting.id, meetingCode: row.meeting.meetingCode, title: row.meeting.title }
      : null,
    resolution: row.resolution
      ? {
          id: row.resolution.id,
          resolutionCode: row.resolution.resolutionCode,
          title: row.resolution.title,
        }
      : null,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
