'use client';

import { FileText, ExternalLink } from 'lucide-react';
import type { ApplicationFormData } from '@/types/dashboard';
import { sortEmploymentByRecency, yearsBetweenEmploymentDates } from '@/lib/employment-sort';

function formatDateRange(start: string, end: string) {
  if (!start?.trim()) return '—';
  const endStr = (end ?? '').trim().toLowerCase();
  const endLabel = !endStr || endStr === 'present' || endStr === 'current' ? 'Present' : end;
  return `${start} – ${endLabel}`;
}

export function WorkExperienceTab({ formData }: { formData: ApplicationFormData | null }) {
  const raw = formData?.employmentHistory?.filter(
    (e) => e.jobTitle?.trim() || e.companyName?.trim()
  ) ?? [];
  const entries = sortEmploymentByRecency(raw);
  const totalYears = entries.reduce(
    (sum, e) => {
      const end = e.isCurrentJob ? 'Present' : (e.endDate ?? '');
      return sum + yearsBetweenEmploymentDates(e.startDate ?? '', end);
    },
    0
  );
  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <div className="rounded-lg bg-primary-50/50 border border-primary-100 px-3 py-2">
          <p className="text-sm font-medium text-primary-900">
            Total relevant experience: <span className="tabular-nums">{totalYears}</span> years
          </p>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No work experience provided.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e, i) => (
            <li key={i} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
              <p className="font-medium text-primary-900">{e.jobTitle || '—'}</p>
              <p className="text-sm text-neutral-600">{e.companyName || '—'}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                <span>{e.industry || '—'}</span>
                <span>{e.employmentType}</span>
                <span className="tabular-nums">
                  {formatDateRange(e.startDate, e.isCurrentJob ? 'Present' : (e.endDate || ''))}
                  {' · '}
                  {yearsBetweenEmploymentDates(e.startDate ?? '', e.isCurrentJob ? 'Present' : (e.endDate ?? ''))} yrs
                </span>
                {e.isCurrentJob && <span className="text-primary-600">Current job</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EducationTab({ formData }: { formData: ApplicationFormData | null }) {
  const entries = formData?.education?.filter(
    (e) => e.institution?.trim() || e.grade?.trim() || (e.discipline ?? '').trim() || e.level
  ) ?? [];
  const levelLabel = (level: string) =>
    level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No education details provided.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e, i) => (
            <li key={i} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
              <p className="font-medium text-primary-900">{levelLabel(e.level)}</p>
              <p className="text-sm text-neutral-600">{e.institution || '—'}</p>
              {e.grade && (
                <p className="text-sm text-neutral-600 mt-0.5">Grade: {e.grade}</p>
              )}
              {(e.discipline ?? '').trim() && (
                <p className="text-sm text-neutral-600 mt-0.5">Discipline: {e.discipline}</p>
              )}
              {e.certificatePath && (
                <div className="mt-2">
                  <a
                    href={e.certificatePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-800"
                  >
                    <FileText className="w-4 h-4" />
                    View certificate
                  </a>
                  <div className="mt-2 rounded border border-neutral-200 bg-white overflow-hidden min-h-[200px] max-h-[320px]">
                    <iframe
                      title={`Certificate ${e.level}`}
                      src={e.certificatePath}
                      className="w-full h-[280px] border-0"
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CertificationsTab({ formData }: { formData: ApplicationFormData | null }) {
  const list = formData?.professionalCertificationsList ?? [];
  const memberships = formData?.professionalMemberships ?? [];
  const hasList = list.length > 0;
  const hasMemberships = memberships.length > 0;
  const hasAny = hasList || hasMemberships;
  return (
    <div className="space-y-4">
      {!hasAny ? (
        <p className="text-sm text-neutral-500">No professional certifications or memberships provided.</p>
      ) : (
        <>
          {list.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Professional certifications</h3>
              <ul className="space-y-3">
                {list.map((c, i) => (
                  <li key={i} className="rounded-lg bg-neutral-50 p-4 border border-neutral-200">
                    <p className="font-medium text-neutral-800">{c.name}</p>
                    {c.certificatePath && (
                      <a
                        href={c.certificatePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline mt-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View certificate
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {memberships.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Professional memberships</h3>
              <ul className="space-y-3">
                {memberships.map((m, i) => (
                  <li key={i} className="rounded-lg bg-neutral-50 p-4 border border-neutral-200">
                    <p className="font-medium text-neutral-800">{m.name || '—'}</p>
                    <p className="text-sm text-neutral-600">Membership no.: {m.membershipNo || '—'}</p>
                    {m.certificatePath && (
                      <a
                        href={m.certificatePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline mt-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View certificate
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
