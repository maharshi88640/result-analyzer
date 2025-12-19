export interface StudentRecord {
  mapNumber: string;
  studentId: string;
  name: string;
  cpi: string;
  spi: string;
  cgpa: string;
  result: string;
  semester: string;
  branch: string;
  passed: boolean;
  subjects: Record<string, Subject>;
}

export interface Subject {
  code: string;
  name: string;
  grade: string;
  passed: boolean;
  credits?: number;
  result?: string;
}

export interface SubjectAnalysisProps {
  data: any[][];
  headers: string[];
  selectedBranch: string;
}

export interface SubjectAnalysisResult {
  studentRecords: StudentRecord[];
  subjectCodes: string[];
  semesterBacklogs: string[];
  subjects: Subject[];
}

export interface SubjectStats {
  total: number;
  passed: number;
  failed: number;
  passPercentage: number;
  averageGrade: string;
  grades: Record<string, number>;
  totalStudentsIncludingEmpty: number;
  passRate: number;
  gradeDistribution: Record<string, number>;
}

export interface AnalysisStats {
  totalStudents: number;
  totalPassed: number;
  overallPassRate: number;
  subjectOptions: Array<{ value: string; label: string }>;
}
