'use client';

import type { DashStatusTone } from '@/lib/dashboard-status-chips';
import { toneAccent } from './score-tone';

type Band = 'low' | 'mid' | 'high';

export type NineBoxCellData = {
  resultsBand: Band;
  competencyBand: Band;
  count: number;
  employees: string[];
};

export type NineBoxSelection = { resultsBand: Band; competencyBand: Band };

const BAND_INDEX: Record<Band, number> = { low: 0, mid: 1, high: 2 };

const CELL_LABEL: Record<string, string> = {
  'high-high': 'Star',
  'mid-high': 'High potential',
  'low-high': 'Potential gem',
  'high-mid': 'High performer',
  'mid-mid': 'Core player',
  'low-mid': 'Inconsistent',
  'high-low': 'Trusted professional',
  'mid-low': 'Effective',
  'low-low': 'Underperformer',
};

function cellTone(results: Band, competency: Band): DashStatusTone {
  const sum = BAND_INDEX[results] + BAND_INDEX[competency];
  if (sum >= 4) return 'success';
  if (sum === 3) return 'info';
  if (sum === 2) return 'primary';
  if (sum === 1) return 'warning';
  return 'danger';
}

const RESULTS_LABEL: Record<Band, string> = { low: 'Low', mid: 'Medium', high: 'High' };
const COMPETENCY_LABEL: Record<Band, string> = { low: 'Low', mid: 'Medium', high: 'High' };

/**
 * Interactive 9-box talent matrix. Results on the x-axis, competencies on the y-axis.
 * Clicking a cell calls `onSelect` (toggles); the active cell is highlighted.
 */
export function NineBoxMatrix({
  cells,
  selected,
  onSelect,
}: {
  cells: NineBoxCellData[];
  selected?: NineBoxSelection | null;
  onSelect?: (selection: NineBoxSelection | null) => void;
}) {
  const get = (results: Band, competency: Band) =>
    cells.find((c) => c.resultsBand === results && c.competencyBand === competency) ?? {
      resultsBand: results,
      competencyBand: competency,
      count: 0,
      employees: [],
    };

  // Rows top→bottom = high→low competency; columns left→right = low→high results.
  const rows: Band[] = ['high', 'mid', 'low'];
  const cols: Band[] = ['low', 'mid', 'high'];

  return (
    <div>
      <div className="flex gap-2">
        {/* Y-axis caption */}
        <div className="flex w-4 items-center justify-center">
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)] [writing-mode:vertical-rl] rotate-180">
            Competencies
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'auto repeat(3, minmax(0, 1fr))' }}>
            {rows.map((rowBand) => (
              <RowCells
                key={rowBand}
                rowBand={rowBand}
                cols={cols}
                get={get}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
            {/* X-axis tick labels */}
            <span aria-hidden />
            {cols.map((c) => (
              <span key={c} className="pt-1 text-center text-[10px] font-medium text-[var(--dash-text-muted)]">
                {RESULTS_LABEL[c]}
              </span>
            ))}
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
            Results →
          </p>
        </div>
      </div>
    </div>
  );
}

function RowCells({
  rowBand,
  cols,
  get,
  selected,
  onSelect,
}: {
  rowBand: Band;
  cols: Band[];
  get: (results: Band, competency: Band) => NineBoxCellData;
  selected?: NineBoxSelection | null;
  onSelect?: (selection: NineBoxSelection | null) => void;
}) {
  return (
    <>
      <span className="flex w-6 items-center justify-end pr-1 text-[10px] font-medium text-[var(--dash-text-muted)]">
        {COMPETENCY_LABEL[rowBand]}
      </span>
      {cols.map((colBand) => {
        const cell = get(colBand, rowBand);
        const tone = cellTone(colBand, rowBand);
        const accent = toneAccent(tone);
        const isSelected = selected?.resultsBand === colBand && selected?.competencyBand === rowBand;
        const label = CELL_LABEL[`${colBand}-${rowBand}`] ?? '';
        const hasCount = cell.count > 0;
        const clickable = Boolean(onSelect) && hasCount;
        const tooltip = cell.employees.length
          ? `${label} — ${cell.employees.join(', ')}`
          : `${label} — no employees`;

        return (
          <button
            key={colBand}
            type="button"
            disabled={!clickable}
            aria-pressed={isSelected}
            title={tooltip}
            onClick={() => {
              if (!onSelect) return;
              onSelect(isSelected ? null : { resultsBand: colBand, competencyBand: rowBand });
            }}
            className={`relative flex aspect-[4/3] flex-col items-center justify-center rounded-lg border p-1 text-center transition-all ${
              clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : 'cursor-default'
            }`}
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} ${hasCount ? 16 : 7}%, var(--dash-surface-solid))`,
              borderColor: isSelected ? accent : 'var(--dash-border)',
              boxShadow: isSelected ? `0 0 0 2px ${accent}` : undefined,
              opacity: hasCount ? 1 : 0.7,
            }}
          >
            <span
              className="text-lg font-bold tabular-nums leading-none"
              style={{ color: hasCount ? accent : 'var(--dash-text-muted)' }}
            >
              {cell.count}
            </span>
            <span className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-[var(--dash-text-muted)]">
              {label}
            </span>
          </button>
        );
      })}
    </>
  );
}
