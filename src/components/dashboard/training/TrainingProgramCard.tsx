'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle,
  Clock,
  Globe,
  GraduationCap,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import {
  TRAINING_STATUS_LABEL,
  trainingStatusTone,
  type TrainingProgramSummary,
} from '@/lib/training/types';
import {
  completionRate,
  formatDateRange,
  formatDelivery,
  formatDuration,
} from './training-format';

type TrainingProgramCardProps = {
  program: TrainingProgramSummary;
  index?: number;
  onEdit: (program: TrainingProgramSummary) => void;
  onDelete: (program: TrainingProgramSummary) => void;
};

export function TrainingProgramCard({ program, index = 0, onEdit, onDelete }: TrainingProgramCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const href = `/dashboard/training/${program.id}`;
  const rate = completionRate(program.enrollmentCount, program.completedCount);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="dashboard-surface group relative flex flex-col p-5 shadow-sm transition-colors hover:border-[var(--dash-border-strong,var(--dash-border))]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-2">
          <span className={dashStatusChip(trainingStatusTone(program.status))}>
            {TRAINING_STATUS_LABEL[program.status]}
          </span>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Program actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(program);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(program);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Link href={href} className="min-w-0 focus:outline-none">
        <h3 className="truncate font-bold text-[var(--dash-text-strong)] group-hover:text-primary-700">
          {program.title}
        </h3>
      </Link>
      {program.description ? (
        <p className="mb-3 mt-1 line-clamp-2 text-sm text-[var(--dash-text-muted)]">{program.description}</p>
      ) : (
        <div className="mb-3" />
      )}

      <div className="space-y-1.5 text-xs text-[var(--dash-text-muted)]">
        {program.category ? (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{program.category}</span>
          </div>
        ) : null}
        {program.provider ? (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{program.provider}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          {program.isOnline ? (
            <Globe className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <MapPin className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{formatDelivery(program)}</span>
        </div>
        {program.startDate || program.endDate ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatDateRange(program.startDate, program.endDate)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--dash-text-muted)]">
          <span>{rate}% completion</span>
          <span className="tabular-nums">
            {program.completedCount}/{program.enrollmentCount}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
          <div
            className="h-full rounded-full bg-[var(--swatch-emerald-accent,#10b981)] transition-all"
            style={{ width: `${rate}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-[var(--dash-border-subtle)] pt-3 text-xs">
          <span className="inline-flex items-center gap-1 text-[var(--dash-text-muted)]">
            <Users className="h-3.5 w-3.5" />
            {program.enrollmentCount} enrolled
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--swatch-emerald-fg,#059669)]">
            <CheckCircle className="h-3.5 w-3.5" />
            {program.completedCount}
          </span>
          {program.durationHours != null ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[var(--dash-text-muted)]">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(program.durationHours)}
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
