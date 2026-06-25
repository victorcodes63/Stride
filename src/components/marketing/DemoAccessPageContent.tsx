import Link from 'next/link';

import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { getDemoAccessRows } from '@/lib/demo-access';
import {
  getMarketingLoginUrl,
  MARKETING_ROUTES,
  MARKETING_SALES_EMAIL,
} from '@/lib/marketing-config';

export function DemoAccessPageContent() {
  const rows = getDemoAccessRows();
  const staffLoginUrl = getMarketingLoginUrl();

  return (
    <StudioCraftContainer className="mx-auto max-w-2xl py-14 sm:py-20">
      <div className="pub-legal-wrap">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pub-primary">
          Demo sandbox
        </p>
        <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.25rem)] font-normal tracking-tight text-pub-ink">
          Try Stride locally
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-pub-muted">
          Use these seeded accounts on a demo or development instance. The shared demo password is
          provided in your sandbox invite or briefing — it is not published on this site.
        </p>

        <p className="mt-6 text-sm text-pub-muted">
          Staff dashboard:{' '}
          <Link href={staffLoginUrl} className="font-mono text-pub-ink underline-offset-2 hover:underline">
            {staffLoginUrl}
          </Link>
        </p>

        <div className="marketing-compare-table-wrap mt-8 overflow-x-auto rounded-xl border border-pub-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-pub-border bg-pub-surface-muted">
                <th className="px-4 py-3 font-semibold text-pub-ink">Role</th>
                <th className="px-4 py-3 font-semibold text-pub-ink">Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.role} className="border-b border-pub-border last:border-b-0">
                  <td className="px-4 py-3 align-top font-medium text-pub-ink">{row.role}</td>
                  <td className="px-4 py-3 align-top text-pub-muted">
                    <code className="rounded bg-pub-surface-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-pub-ink">
                      {row.email}
                    </code>
                    {row.note ? (
                      <p className="mt-1.5 text-xs text-pub-muted">{row.note}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-lg border border-pub-border bg-pub-surface-muted p-5">
          <p className="text-sm font-medium text-pub-ink">Need the password?</p>
          <p className="mt-2 text-sm leading-relaxed text-pub-muted">
            Email{' '}
            <a
              href={`mailto:${MARKETING_SALES_EMAIL}?subject=Stride%20demo%20sandbox%20access`}
              className="text-pub-primary underline-offset-2 hover:underline"
            >
              {MARKETING_SALES_EMAIL}
            </a>{' '}
            or use the credentials from your demo walkthrough pack.
          </p>
        </div>

        <p className="mt-8 text-xs text-pub-muted">
          <Link href={MARKETING_ROUTES.home} className="underline-offset-2 hover:underline">
            ← Back to Stride
          </Link>
        </p>
      </div>
    </StudioCraftContainer>
  );
}
