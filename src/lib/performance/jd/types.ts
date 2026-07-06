import type { BscPerspective, JdStatus } from '@prisma/client';

export type JdKpiInput = {
  name: string;
  description?: string;
  targetValue?: string;
  unit?: string;
  weightPercent?: number;
  sortOrder?: number;
};

export type JdKraInput = {
  title: string;
  description?: string;
  bscPerspective?: BscPerspective;
  weightPercent?: number;
  sortOrder?: number;
  kpis?: JdKpiInput[];
};

export type JdCompetencyInput = {
  name: string;
  description?: string;
  requiredLevel: number;
  sortOrder?: number;
};

export type JobDescriptionInput = {
  divisionId?: string | null;
  title: string;
  grade?: string | null;
  jobPurpose?: string | null;
  keyActivities?: string | null;
  authorityScope?: string | null;
  workingConditions?: string | null;
  qualifications?: string | null;
  relationships?: string | null;
  kras?: JdKraInput[];
  competencies?: JdCompetencyInput[];
  isReferencePack?: boolean;
};

export type JobDescriptionDto = {
  id: string;
  divisionId: string | null;
  divisionName: string | null;
  title: string;
  grade: string | null;
  version: number;
  status: JdStatus;
  jobPurpose: string | null;
  keyActivities: string | null;
  authorityScope: string | null;
  workingConditions: string | null;
  qualifications: string | null;
  relationships: string | null;
  rootJobDescriptionId: string | null;
  previousVersionId: string | null;
  publishedAt: string | null;
  isReferencePack: boolean;
  kraCount: number;
  competencyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type JobDescriptionDetailDto = JobDescriptionDto & {
  kras: Array<{
    id: string;
    title: string;
    description: string | null;
    bscPerspective: BscPerspective | null;
    weightPercent: number;
    sortOrder: number;
    kpis: Array<{
      id: string;
      name: string;
      description: string | null;
      targetValue: string | null;
      unit: string | null;
      weightPercent: number;
      sortOrder: number;
    }>;
  }>;
  competencies: Array<{
    id: string;
    name: string;
    description: string | null;
    requiredLevel: number;
    sortOrder: number;
  }>;
};
