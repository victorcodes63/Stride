export type Assignee = { id: string; name: string; email: string; role: string };

export type StaffTask = {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high';
  dueAt: string | null;
  completedAt: string | null;
  createdById: string;
  assigneeId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string } | null;
};

export type Scope = 'assigned_to_me' | 'created_by_me' | 'all';
export type StatusFilter = 'active' | 'done' | 'all';
export type DueFilter = '' | 'today' | 'overdue' | 'upcoming' | 'no_date';

export type TaskStats = {
  open: number;
  overdue: number;
  done: number;
};
