/**
 * Frontend-facing TypeScript types for the Projects module.
 *
 * These are derived directly from the serializer return shapes in
 * `src/lib/projects/serialize.ts` so they never drift from the API payloads.
 * All imports are type-only and therefore erased at build time.
 */
import type {
  serializeActivity,
  serializeAttachment,
  serializeComment,
  serializeDependency,
  serializeLabel,
  serializeMember,
  serializeMilestone,
  serializeProject,
  serializeTask,
  serializeTemplate,
} from '@/lib/projects/serialize';
import type {
  ProjectActivityType,
  ProjectHealth,
  ProjectMilestoneStatus,
  ProjectStatus,
  ProjectTaskPriority,
  ProjectTaskStatus,
} from '@prisma/client';

export type {
  ProjectActivityType,
  ProjectHealth,
  ProjectMilestoneStatus,
  ProjectStatus,
  ProjectTaskPriority,
  ProjectTaskStatus,
};

export type SerializedProject = ReturnType<typeof serializeProject>;
export type SerializedMilestone = ReturnType<typeof serializeMilestone>;
export type SerializedTask = ReturnType<typeof serializeTask>;
export type SerializedMember = ReturnType<typeof serializeMember>;
export type SerializedLabel = ReturnType<typeof serializeLabel>;
export type SerializedComment = ReturnType<typeof serializeComment>;
export type SerializedAttachment = ReturnType<typeof serializeAttachment>;
export type SerializedActivity = ReturnType<typeof serializeActivity>;
export type SerializedDependency = ReturnType<typeof serializeDependency>;
export type SerializedTemplate = ReturnType<typeof serializeTemplate>;

// Convenient aliases matching the entity names used across the frontend.
export type ProjectDTO = SerializedProject;
export type MilestoneDTO = SerializedMilestone;
export type TaskDTO = SerializedTask;
export type MemberDTO = SerializedMember;
export type LabelDTO = SerializedLabel;
export type CommentDTO = SerializedComment;
export type AttachmentDTO = SerializedAttachment;
export type ActivityDTO = SerializedActivity;
export type DependencyDTO = SerializedDependency;
export type TemplateDTO = SerializedTemplate;

export type ProjectMemberRole = 'owner' | 'lead' | 'member' | 'viewer';
