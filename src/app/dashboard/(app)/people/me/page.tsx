'use client';

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, Loader2, Save, UserRound, Wallet } from 'lucide-react';
import { DashboardPage, DashboardPageHeader } from '@/components/dashboard/DashboardPage';
import { toast } from '@/components/ui/toast';

type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffUserType: string;
  staffUserTypeLabel: string;
  department: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  monthlySalary: number | null;
  leaveApprover: { id: string; name: string; email: string } | null;
  isActive: boolean;
};

type ProfileForm = {
  name: string;
  department: string;
  costCenterCode: string;
  costCenterName: string;
};

const PROFILE_HEADER = {
  eyebrow: 'Plan my work',
  title: 'My profile',
  icon: UserRound,
} as const;

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
          {icon}
          {title}
        </div>
        {description ? (
          <p className="mt-1 text-xs text-[var(--dash-text-muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-[var(--dash-text-body)]">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-[var(--dash-text-muted)]">{hint}</span> : null}
    </label>
  );
}

function formatSalary(value: number | null) {
  if (value == null) return 'Not set';
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'viewer') return 'Viewer';
  return 'Staff';
}

export default function MyProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyProfile = useCallback((data: ProfileResponse) => {
    setProfile(data);
    setForm({
      name: data.name ?? '',
      department: data.department ?? '',
      costCenterCode: data.costCenterCode ?? '',
      costCenterName: data.costCenterName ?? '',
    });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/people/me');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to load profile.');
      }
      applyProfile(data as ProfileResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      toast.error('Name is required.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/people/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          department: form.department,
          costCenterCode: form.costCenterCode,
          costCenterName: form.costCenterName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not update your profile.');
      }
      applyProfile(data as ProfileResponse);
      toast.success('Your profile has been updated.');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardPage>
        <DashboardPageHeader
          {...PROFILE_HEADER}
          description="Your staff details for leave reporting and workplace records."
        />
        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your profile…
        </div>
      </DashboardPage>
    );
  }

  if (error && !profile) {
    return (
      <DashboardPage>
        <DashboardPageHeader
          {...PROFILE_HEADER}
          description="Your staff details for leave reporting and workplace records."
        />
        <p className="rounded-lg border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] p-4 text-sm text-[var(--dash-danger-fg)]">
          {error}
        </p>
      </DashboardPage>
    );
  }

  if (!profile || !form) return null;

  return (
    <DashboardPage>
      <DashboardPageHeader
        {...PROFILE_HEADER}
        description="Update your name, department, and cost centre. Role, leave approver, and salary are managed by admins."
      />

      <div className="space-y-5">
        <form onSubmit={(e) => void saveProfile(e)} className="space-y-5">
          <SectionCard
            icon={<UserRound className="h-4 w-4" />}
            title="Personal details"
            description="How your name appears across Stride."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="dash-setup-input mt-1"
                />
              </Field>
              <Field label="Work email" hint="Email cannot be changed here.">
                <input
                  value={profile.email}
                  disabled
                  className="dash-setup-input mt-1"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            title="Department & cost centre"
            description="Used to group and roll up leave reports."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department">
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="dash-setup-input mt-1"
                  placeholder="e.g. Operations, Finance"
                />
              </Field>
              <div className="hidden sm:block" />
              <Field label="Cost centre name">
                <input
                  value={form.costCenterName}
                  onChange={(e) => setForm({ ...form, costCenterName: e.target.value })}
                  className="dash-setup-input mt-1"
                  placeholder="e.g. Head Office"
                />
              </Field>
              <Field label="Cost centre code">
                <input
                  value={form.costCenterCode}
                  onChange={(e) => setForm({ ...form, costCenterCode: e.target.value })}
                  className="dash-setup-input mt-1"
                  placeholder="e.g. CC-001"
                />
              </Field>
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        <SectionCard
          icon={<Wallet className="h-4 w-4" />}
          title="Work profile"
          description="Managed by People / admins — contact them if something looks wrong."
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--dash-text-muted)]">Role</dt>
              <dd className="font-medium text-[var(--dash-text-strong)]">{roleLabel(profile.role)}</dd>
            </div>
            <div>
              <dt className="text-[var(--dash-text-muted)]">Job function</dt>
              <dd className="font-medium text-[var(--dash-text-strong)]">{profile.staffUserTypeLabel}</dd>
            </div>
            <div>
              <dt className="text-[var(--dash-text-muted)]">Leave approver</dt>
              <dd className="font-medium text-[var(--dash-text-strong)]">
                {profile.leaveApprover?.name ?? 'Not assigned'}
                {profile.leaveApprover?.email ? (
                  <span className="mt-0.5 block text-xs font-normal text-[var(--dash-text-muted)]">
                    {profile.leaveApprover.email}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--dash-text-muted)]">Monthly salary</dt>
              <dd className="font-medium text-[var(--dash-text-strong)]">
                {formatSalary(profile.monthlySalary)}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </DashboardPage>
  );
}
