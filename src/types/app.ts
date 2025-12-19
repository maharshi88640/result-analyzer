import type { QueryConfig } from './excel';
export interface User {
  name: string;
  email: string;
}

export interface AnalysisHistory {
  _id: string;
  name: string;
  createdAt: string;
  state: {
    selectedSheet: string;
    query: QueryConfig;
    selectedBranch?: string | null;
    selectedSubject?: string;
    gradeRanges?: { spi: { min: number; max: number }; cpi: { min: number; max: number }; cgpa: { min: number; max: number } };
  };
}
