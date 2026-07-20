'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  UserRound,
} from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssOnboardingHero } from '@/components/ess/EssOnboardingHero';
import {
  EssOnboardingJourney,
  taskHref,
  type EssOnboardingTask,
} from '@/components/ess/EssOnboardingJourney';
import {
  EssCard,
  EssEmptyState,
  EssLoadingState,
  EssMetricCard,
  EssSectionTitle,
} from '@/components/ess/EssUi';

type Summary = {
  totalOpen: number;
  due: number;
  overdue: number;
  noDue: number;
  completed: number;
  total: number;
};

type WelcomePayload = {
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    dateOfJoining: string | null;
    departmentName: string | null;
    manager: { firstName: string; lastName: string; jobTitle: string | null } | null;
  } | null;
  organization: { name: string } | null;
  progress: {
    total: number;
    completed: number;
    percent: number;
    countdownDays: number | null;
    workflowStatus: string | null;
    templateName: string | null;
  };
};

const EMPTY_PROGRESS: WelcomePayload['progress'] = {
  total: 0,
  completed: 0,
  percent: 0,
  countdownDays: null,
  workflowStatus: null,
  templateName: null,
};

function isOpen(task: EssOnboardingTask) {
  return task.status !== 'COMPLETED' && task.status !== 'SKIPPED';
}

export default function EssOnboardingPage() {
  const [welcome, setWelcome] = useState<WelcomePayload | null>(null);
  const [tasks, setTasks] = useState<EssOnboardingTask[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [welcomeRes, tasksRes] = await Promise.all([
      fetch('/api/ess/onboarding/welcome'),
      fetch('/api/ess/onboarding/tasks'),
    ]);

    const welcomeData = await welcomeRes.json().catch(() => null);
    const tasksData = await tasksRes.json().catch(() => ({}));

    if (!tasksRes.ok) {
      setError(tasksData?.error || 'Could not load onboarding tasks.');
      setTasks([]);
      setSummary(null);
    } else {
      setTasks(Array.isArray(tasksData.items) ? tasksData.items : []);
      setSummary(tasksData.summary ?? null);
      setTemplateName(tasksData.templateName ?? null);
    }

    setWelcome(welcomeRes.ok && welcomeData ? (welcomeData as WelcomePayload) : null);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const progress = welcome?.progress ?? EMPTY_PROGRESS;
  const employee = welcome?.employee ?? null;
  const manager = employee?.manager ?? null;

  const nextTasks = useMemo(
    () => tasks.filter(isOpen).slice(0, 3),
    [tasks],
  );

  const hasOnboarding = tasks.length > 0 || progress.total > 0;

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader
        title="Welcome hub"
        subtitle={templateName ?? progress.templateName ?? 'Your onboarding journey'}
        backHref="/ess/work"
      />

      {loading ? <EssLoadingState label="Loading your welcome hub…" /> : null}

      {!loading && error ? (
        <EssCard className="mb-4 border border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </EssCard>
      ) : null}

      {!loading && !error && !hasOnboarding ? (
        <EssEmptyState
          title="No active onboarding"
          message="Your personalized welcome hub and checklist will appear here once HR assigns your onboarding."
          icon={<ClipboardList className="h-6 w-6" />}
        />
      ) : null}

      {!loading && hasOnboarding ? (
        <div className="space-y-6">
          <EssOnboardingHero
            firstName={employee?.firstName ?? null}
            jobTitle={employee?.jobTitle ?? null}
            departmentName={employee?.departmentName ?? null}
            organizationName={welcome?.organization?.name ?? null}
            dateOfJoining={employee?.dateOfJoining ?? null}
            countdownDays={progress.countdownDays}
            percent={progress.percent}
            completed={progress.completed}
            total={progress.total}
          />

          {summary ? (
            <div className="grid grid-cols-3 gap-3">
              <EssMetricCard
                label="Open"
                value={summary.totalOpen}
                tone="primary"
                icon={<ClipboardList className="h-5 w-5" />}
              />
              <EssMetricCard
                label="Overdue"
                value={summary.overdue}
                tone={summary.overdue > 0 ? 'warning' : 'default'}
                icon={<FileWarning className="h-5 w-5" />}
              />
              <EssMetricCard
                label="Completed"
                value={summary.completed}
                tone="success"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
            </div>
          ) : null}

          {nextTasks.length ? (
            <section>
              <EssSectionTitle
                eyebrow="Quick actions"
                title="What happens next"
                subtitle="Pick up where you left off."
              />
              <div className="space-y-2">
                {nextTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={taskHref(task)}
                    className="flex min-h-[60px] items-center justify-between gap-3 rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-4 py-3 transition-transform active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--ess-text)]">{task.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--ess-subtle)]">
                        {task.dueDate
                          ? `Due ${new Date(task.dueDate).toLocaleDateString()}`
                          : task.isRequired
                            ? 'Required'
                            : 'When you can'}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[var(--ess-primary)]" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {manager ? (
            <section>
              <EssSectionTitle eyebrow="Your people" title="Here to help" />
              <EssCard className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-black uppercase tracking-wide text-[var(--ess-subtle)]">
                    Your manager
                  </p>
                  <p className="font-bold text-[var(--ess-text)]">
                    {`${manager.firstName} ${manager.lastName}`.trim()}
                  </p>
                  {manager.jobTitle ? (
                    <p className="text-sm text-[var(--ess-muted)]">{manager.jobTitle}</p>
                  ) : null}
                </div>
              </EssCard>
            </section>
          ) : null}

          <section>
            <EssSectionTitle
              eyebrow="Your journey"
              title="Onboarding steps"
              subtitle="Grouped by phase — tap any step to continue."
            />
            {tasks.length ? (
              <EssOnboardingJourney tasks={tasks} />
            ) : (
              <EssEmptyState
                title="No steps assigned to you yet"
                message="Your HR checklist items will show up here as they are assigned."
                icon={<ClipboardList className="h-6 w-6" />}
              />
            )}
          </section>
        </div>
      ) : null}
    </EssPullRefresh>
  );
}
