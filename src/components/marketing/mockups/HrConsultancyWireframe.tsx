'use client';

const PIPELINE = [
  { name: 'Faith W.', role: 'HR Analyst', stage: 'Assessment', score: '82%' },
  { name: 'Brian O.', role: 'Recruiter', stage: 'Interview', score: '—' },
  { name: 'Lucy A.', role: 'Payroll Lead', stage: 'Applied', score: 'Pending' },
  { name: 'James M.', role: 'Ops Manager', stage: 'Offer', score: '91%' },
] as const;

const STAGE_STYLE: Record<string, string> = {
  Applied: 'border-white/15 bg-white/10 text-white/55',
  Assessment: 'border-[var(--sc-coral)]/35 bg-[var(--sc-coral)]/15 text-[#FF8A6E]',
  Interview: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  Offer: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

export function HrConsultancyWireframe({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full min-h-[200px] flex-col gap-2 ${className}`.trim()}>
      <div className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5">
        <p className="text-[8px] font-semibold uppercase tracking-wide text-white/50">
          Recruitment pipeline
        </p>
        <span className="rounded-full bg-[var(--sc-coral)]/20 px-2 py-0.5 text-[7px] font-semibold text-[#FF8A6E]">
          AssessIQ live
        </span>
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {PIPELINE.map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[9px] font-semibold text-white">{row.name}</p>
              <p className="truncate text-[8px] text-white/50">{row.role}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-wide ${
                  STAGE_STYLE[row.stage] ?? STAGE_STYLE.Applied
                }`}
              >
                {row.stage}
              </span>
              <span className="text-[7px] text-white/45">{row.score}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
