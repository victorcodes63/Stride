/** Performance Management (BSC) module — public exports for cross-module integration. */

export type { JobDescriptionInput, JobDescriptionDto } from '@/lib/performance/jd/types';
export {
  createJobDescriptionManual,
  importStabexReferencePack,
  publishJobDescription,
} from '@/lib/performance/jd/service';
export { generateScorecardFromJobDescription } from '@/lib/performance/scorecard/service';
export type { JdParserProvider, JdParseResult } from '@/lib/performance/parsing/jd-parser-provider';
export { parseJobDescriptionDraft, listJdParserProviders } from '@/lib/performance/parsing/registry';
export type {
  KpiSourceProvider,
  KpiMeasurement,
  KpiMeasurementContext,
} from '@/lib/performance/kpi/kpi-source-provider';
export {
  registerKpiSourceProvider,
  getKpiSourceProvider,
  listKpiSourceProviders,
  measureAutoKpi,
} from '@/lib/performance/kpi/kpi-source-provider';
export {
  activatePerformanceCycle,
  closePerformanceCycle,
  completeReviewCalibration,
} from '@/lib/performance/service';
