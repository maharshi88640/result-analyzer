
export interface DetentionRecord {
  studentId: string;
  studentName: string;
  branch: string;
  currentSemester: number;
  detentionStatus: 'detained' | 'clear' | 'at-risk';
  detentionReasons: string[];
  failedSubjects: string[];
  clearedSemesters: number[];
  availableSemesters?: number[];
  riskLevel: 'high' | 'medium' | 'low';
  backlogCount: number;
  academicYear: string;
  spiHistory?: number[];
  cpiHistory?: number[];
  predictedDetention?: boolean;
}

export interface DetentionAnalysisResult {
  totalStudents: number;
  detainedStudents: number;
  atRiskStudents: number;
  clearStudents: number;
  detentionRate: number;
  riskRate: number;
  branchWiseDetention: Record<string, {
    total: number;
    detained: number;
    rate: number;
  }>;
  semesterWiseDetention: Record<number, {
    total: number;
    detained: number;
    rate: number;
  }>;
  subjectWiseDetention: Record<string, {
    total: number;
    detained: number;
    rate: number;
  }>;
  detentionTrends: Array<{
    academicYear: string;
    detentionRate: number;
    totalStudents: number;
  }>;
}

export interface GTURule {
  targetSemester: number;
  requiredSemesters: number[];
  description: string;
  isDetainedIf: string;
}

export interface DetentionFilter {
  branch?: string;
  semester?: number;
  academicYear?: string;
  riskLevel?: 'high' | 'medium' | 'low';
  detentionStatus?: 'detained' | 'at-risk' | 'clear';
}

export interface DetentionReport {
  title: string;
  generatedAt: Date;
  filters: DetentionFilter;
  summary: DetentionAnalysisResult;
  detailedRecords: DetentionRecord[];
}

export interface StudentAcademicHistory {
  studentId: string;
  studentName: string;
  branch: string;
  semesterRecords: Array<{
    semester: number;
    academicYear: string;
    subjects: Array<{
      code: string;
      name: string;
      grade: string;
      passed: boolean;
      credits?: number;
    }>;
    spi: number;
    cpi: number;
    result: 'PASS' | 'FAIL' | 'DETAINED';
  }>;
}
