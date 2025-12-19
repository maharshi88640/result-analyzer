import { 
  DetentionRecord, 
  DetentionAnalysisResult, 
  DetentionFilter, 
  DetentionReport,
  StudentAcademicHistory 
} from '../types/detention';
import { 
  shouldStudentBeDetained, 
  assessDetentionRisk,
  GTU_DETENTION_RULES 
} from './detentionRules';

/**
 * Process raw student data to create detention analysis
 */
export function analyzeDetentionData(
  rawData: any[][],
  headers: string[],
  filters?: DetentionFilter
): DetentionAnalysisResult {
  
  // Process raw data to extract student information
  const studentRecords = processStudentData(rawData, headers);
  
  // Apply filters if provided
  const filteredRecords = applyFilters(studentRecords, filters);
  
  // Calculate analysis results
  return calculateDetentionAnalysis(filteredRecords);
}


/**
 * Process raw Excel data into structured student records
 */
function processStudentData(rawData: any[][], headers: string[]): DetentionRecord[] {
  const studentMap = new Map<string, DetentionRecord>();
  
  // First pass: identify all available semesters for each student
  const studentSemesters = new Map<string, Set<number>>();
  
  rawData.forEach((row, index) => {
    if (!row || row.length === 0) return;
    
    const studentId = getStudentId(row, findColumnIndices(headers));
    if (!studentId) return;
    
    const semester = getSemester(row, findColumnIndices(headers));
    if (!semester) return;
    
    // Track available semesters for each student
    if (!studentSemesters.has(studentId)) {
      studentSemesters.set(studentId, new Set());
    }
    studentSemesters.get(studentId)!.add(semester);
  });
  
  // Second pass: process student records
  rawData.forEach((row, index) => {
    if (!row || row.length === 0) return;
    
    const studentId = getStudentId(row, findColumnIndices(headers));
    if (!studentId) return;
    
    const studentName = getStudentName(row, findColumnIndices(headers));
    const branch = getBranch(row, findColumnIndices(headers));
    const semester = getSemester(row, findColumnIndices(headers));
    const academicYear = getAcademicYear(row, findColumnIndices(headers));
    
    if (!branch || !semester) return;
    
    // Get or create student record
    let studentRecord = studentMap.get(studentId);
    if (!studentRecord) {
      studentRecord = {
        studentId,
        studentName: studentName || 'Unknown',
        branch,
        currentSemester: semester,
        detentionStatus: 'clear',
        detentionReasons: [],
        failedSubjects: [],
        clearedSemesters: [],
        riskLevel: 'low',
        backlogCount: 0,
        academicYear,
        spiHistory: [],
        cpiHistory: []
      };
      studentMap.set(studentId, studentRecord);
    }
    
    // Store available semesters for this student
    studentRecord.availableSemesters = Array.from(studentSemesters.get(studentId) || []);

    // Update student information
    updateStudentRecord(studentRecord, row, findColumnIndices(headers), headers);
  });
  
  // Final pass: apply missing semester logic (treat missing as passed)
  const records = Array.from(studentMap.values());
  records.forEach(record => {
    applyMissingSemesterLogic(record);
  });
  
  return records;
}

/**
 * Find column indices for relevant data fields
 */
function findColumnIndices(headers: string[]): Record<string, number> {
  const columnMap: Record<string, number> = {};
  
  // Common column name patterns
  const patterns = {
    studentId: ['student id', 'id', 'enrollment', 'enrollment no', 'enroll no', 'map no', 'map number'],
    studentName: ['student name', 'name', 'student', 'full name'],
    branch: ['branch', 'dept', 'department', 'program'],
    semester: ['sem', 'semester', 'sem no', 'semester no', 'sem number'],
    academicYear: ['academic year', 'year', 'yr', 'ay'],
    spi: ['spi'],
    cpi: ['cpi'],
    cgpa: ['cgpa'],
    result: ['result', 'status'],
    subjectCode: ['subject code', 'sub code', 'code'],
    subjectName: ['subject name', 'sub name', 'subject'],
    grade: ['grade', 'marks', 'score']
  };
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.toString().toLowerCase().trim();
    
    Object.entries(patterns).forEach(([key, patternList]) => {
      if (patternList.some(pattern => normalizedHeader.includes(pattern))) {
        if (!columnMap[key]) {
          columnMap[key] = index;
        }
      }
    });
  });
  
  return columnMap;
}

/**
 * Extract student ID from row data
 */
function getStudentId(row: any[], columnMap: Record<string, number>): string | null {
  const idField = columnMap.studentId || columnMap.mapNumber || 0;
  const id = row[idField]?.toString().trim();
  return id || null;
}

/**
 * Extract student name from row data
 */
function getStudentName(row: any[], columnMap: Record<string, number>): string {
  const nameField = columnMap.studentName || 1;
  return row[nameField]?.toString().trim() || 'Unknown';
}

/**
 * Extract branch from row data
 */
function getBranch(row: any[], columnMap: Record<string, number>): string {
  const branchField = columnMap.branch || 2;
  return row[branchField]?.toString().trim() || '';
}

/**
 * Extract semester from row data
 */
function getSemester(row: any[], columnMap: Record<string, number>): number {
  const semField = columnMap.semester || 3;
  const semValue = row[semField]?.toString().trim();
  
  if (!semValue) return 0;
  
  // Extract numeric part from semester value
  const match = semValue.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Extract academic year from row data
 */
function getAcademicYear(row: any[], columnMap: Record<string, number>): string {
  const yearField = columnMap.academicYear || 4;
  return row[yearField]?.toString().trim() || '';
}



/**
 * Apply logic to treat missing semesters as passed
 * If a student's result for a particular semester is not uploaded/not available,
 * they should be considered as "pass" for detention analysis purposes
 */
function applyMissingSemesterLogic(student: DetentionRecord): void {
  if (!student.availableSemesters || student.availableSemesters.length === 0) {
    return; // No semester data available
  }
  
  // Sort available semesters
  const sortedAvailableSemesters = [...student.availableSemesters].sort((a, b) => a - b);
  
  // Find the highest semester the student has results for
  const maxAvailableSemester = Math.max(...sortedAvailableSemesters);
  
  // Consider the student has results for all semesters from 1 to max available semester
  // Missing semesters are treated as "passed" (no detention)
  
  // Update cleared semesters to include all semesters up to the maximum available
  for (let sem = 1; sem <= maxAvailableSemester; sem++) {
    if (!student.clearedSemesters.includes(sem)) {
      // If semester is not in cleared list but student has data for higher semesters,
      // treat it as cleared (passed) since missing result = passed
      student.clearedSemesters.push(sem);
    }
  }
  
  // Re-assess detention status after treating missing semesters as passed
  const detentionCheck = shouldStudentBeDetained(student.currentSemester, student.clearedSemesters);
  
  if (detentionCheck.isDetained) {
    student.detentionStatus = 'detained';
    student.detentionReasons.push(detentionCheck.reason);
  } else {
    // Only set to clear if not detained (don't override other risk assessments)
    if (student.detentionStatus === 'detained' && detentionCheck.reason.includes('required semesters')) {
      student.detentionStatus = 'clear';
      // Remove detention reasons related to missing semesters
      student.detentionReasons = student.detentionReasons.filter(reason => 
        !reason.toLowerCase().includes('required semesters') || 
        !reason.toLowerCase().includes('not cleared')
      );
    }
  }
  
  // Re-assess risk level after treating missing semesters as passed
  student.riskLevel = assessDetentionRisk(
    student.currentSemester, 
    student.clearedSemesters, 
    student.backlogCount,
    student.failedSubjects
  );
}


/**
 * Update student record with row data
 */
function updateStudentRecord(
  student: DetentionRecord, 
  row: any[], 
  columnMap: Record<string, number>,
  headers: string[]
): void {
  
  const rowSemester = getSemester(row, columnMap);
  
  // Update SPI/CPI history if available
  if (columnMap.spi !== undefined) {
    const spi = parseFloat(row[columnMap.spi]);
    if (!isNaN(spi)) {
      student.spiHistory = student.spiHistory || [];
      student.spiHistory.push(spi);
    }
  }
  
  if (columnMap.cpi !== undefined) {
    const cpi = parseFloat(row[columnMap.cpi]);
    if (!isNaN(cpi)) {
      student.cpiHistory = student.cpiHistory || [];
      student.cpiHistory.push(cpi);
    }
  }
  
  // Count backlogs and failed subjects
  let failedSubjects = 0;
  const failedSubjectNames: string[] = [];
  
  // Look for grade columns (typically F grade indicates failure)
  if (headers) {
    headers.forEach((header, index) => {
      const grade = row[index]?.toString().trim().toUpperCase();
      if (grade === 'F' || grade === 'FAIL' || grade === '0') {
        failedSubjects++;
        const subjectName = header.toString();
        if (!failedSubjectNames.includes(subjectName)) {
          failedSubjectNames.push(subjectName);
        }
      }
    });
  }
  
  student.backlogCount = failedSubjects;
  student.failedSubjects = failedSubjectNames;
  
  // Determine if student passed this semester
  // If no failed subjects and no explicit fail result, consider as passed
  const hasExplicitResult = columnMap.result !== undefined;
  const result = row[columnMap.result]?.toString().toLowerCase().trim();
  const isExplicitFail = result === 'fail' || result === ' detained' || result === 'detained';
  const hasFailedSubjects = failedSubjects > 0;
  
  // Consider semester as cleared if:
  // 1. No explicit fail result AND
  // 2. No failed subjects (or very few failed subjects)
  // 3. This logic will be refined by the missing semester logic later
  if (!isExplicitFail && !hasFailedSubjects) {
    if (!student.clearedSemesters.includes(rowSemester)) {
      student.clearedSemesters.push(rowSemester);
    }
  }
  
  // Update result status for current semester
  if (hasExplicitResult) {
    if (isExplicitFail) {
      student.detentionStatus = 'detained';
      student.detentionReasons.push(`Failed in semester ${rowSemester}`);
    } else if (!hasFailedSubjects) {
      // Passed this semester
      if (!student.clearedSemesters.includes(rowSemester)) {
        student.clearedSemesters.push(rowSemester);
      }
    }
  }
  
  // Update current semester if this row represents a higher semester
  if (rowSemester > student.currentSemester) {
    student.currentSemester = rowSemester;
  }
}

/**
 * Apply filters to student records
 */
function applyFilters(records: DetentionRecord[], filters?: DetentionFilter): DetentionRecord[] {
  if (!filters) return records;
  
  return records.filter(record => {
    if (filters.branch && record.branch !== filters.branch) return false;
    if (filters.semester && record.currentSemester !== filters.semester) return false;
    if (filters.academicYear && record.academicYear !== filters.academicYear) return false;
    if (filters.riskLevel && record.riskLevel !== filters.riskLevel) return false;
    if (filters.detentionStatus && record.detentionStatus !== filters.detentionStatus) return false;
    
    return true;
  });
}

/**
 * Calculate detention analysis results
 */
function calculateDetentionAnalysis(records: DetentionRecord[]): DetentionAnalysisResult {
  const totalStudents = records.length;
  
  // Count by status
  const detainedStudents = records.filter(r => r.detentionStatus === 'detained').length;
  const atRiskStudents = records.filter(r => r.riskLevel === 'high' || r.riskLevel === 'medium').length;
  const clearStudents = records.filter(r => r.detentionStatus === 'clear' && r.riskLevel === 'low').length;
  
  // Calculate rates
  const detentionRate = totalStudents > 0 ? (detainedStudents / totalStudents) * 100 : 0;
  const riskRate = totalStudents > 0 ? (atRiskStudents / totalStudents) * 100 : 0;
  
  // Branch-wise analysis
  const branchWiseDetention = calculateBranchWiseDetention(records);
  
  // Semester-wise analysis
  const semesterWiseDetention = calculateSemesterWiseDetention(records);
  
  // Subject-wise analysis
  const subjectWiseDetention = calculateSubjectWiseDetention(records);
  
  // Detention trends (if academic year data available)
  const detentionTrends = calculateDetentionTrends(records);
  
  return {
    totalStudents,
    detainedStudents,
    atRiskStudents,
    clearStudents,
    detentionRate,
    riskRate,
    branchWiseDetention,
    semesterWiseDetention,
    subjectWiseDetention,
    detentionTrends
  };
}

/**
 * Calculate branch-wise detention statistics
 */
function calculateBranchWiseDetention(records: DetentionRecord[]) {
  const branchStats: Record<string, { total: number; detained: number; rate: number }> = {};
  
  records.forEach(record => {
    if (!branchStats[record.branch]) {
      branchStats[record.branch] = { total: 0, detained: 0, rate: 0 };
    }
    
    branchStats[record.branch].total++;
    if (record.detentionStatus === 'detained') {
      branchStats[record.branch].detained++;
    }
  });
  
  // Calculate rates
  Object.keys(branchStats).forEach(branch => {
    const stats = branchStats[branch];
    stats.rate = stats.total > 0 ? (stats.detained / stats.total) * 100 : 0;
  });
  
  return branchStats;
}

/**
 * Calculate semester-wise detention statistics
 */
function calculateSemesterWiseDetention(records: DetentionRecord[]) {
  const semesterStats: Record<number, { total: number; detained: number; rate: number }> = {};
  
  records.forEach(record => {
    if (!semesterStats[record.currentSemester]) {
      semesterStats[record.currentSemester] = { total: 0, detained: 0, rate: 0 };
    }
    
    semesterStats[record.currentSemester].total++;
    if (record.detentionStatus === 'detained') {
      semesterStats[record.currentSemester].detained++;
    }
  });
  
  // Calculate rates
  Object.keys(semesterStats).forEach(semester => {
    const semNum = parseInt(semester);
    const stats = semesterStats[semNum];
    stats.rate = stats.total > 0 ? (stats.detained / stats.total) * 100 : 0;
  });
  
  return semesterStats;
}

/**
 * Calculate subject-wise detention statistics
 */
function calculateSubjectWiseDetention(records: DetentionRecord[]) {
  const subjectStats: Record<string, { total: number; detained: number; rate: number }> = {};
  
  records.forEach(record => {
    record.failedSubjects.forEach(subject => {
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, detained: 0, rate: 0 };
      }
      
      subjectStats[subject].total++;
      if (record.detentionStatus === 'detained') {
        subjectStats[subject].detained++;
      }
    });
  });
  
  // Calculate rates
  Object.keys(subjectStats).forEach(subject => {
    const stats = subjectStats[subject];
    stats.rate = stats.total > 0 ? (stats.detained / stats.total) * 100 : 0;
  });
  
  return subjectStats;
}

/**
 * Calculate detention trends over time
 */
function calculateDetentionTrends(records: DetentionRecord[]) {
  const yearStats: Record<string, { total: number; detained: number }> = {};
  
  records.forEach(record => {
    if (record.academicYear) {
      if (!yearStats[record.academicYear]) {
        yearStats[record.academicYear] = { total: 0, detained: 0 };
      }
      
      yearStats[record.academicYear].total++;
      if (record.detentionStatus === 'detained') {
        yearStats[record.academicYear].detained++;
      }
    }
  });
  
  return Object.entries(yearStats).map(([year, stats]) => ({
    academicYear: year,
    detentionRate: stats.total > 0 ? (stats.detained / stats.total) * 100 : 0,
    totalStudents: stats.total
  })).sort((a, b) => a.academicYear.localeCompare(b.academicYear));
}

/**
 * Generate detailed detention report
 */
export function generateDetentionReport(
  rawData: any[][],
  headers: string[],
  filters?: DetentionFilter,
  title?: string
): DetentionReport {
  
  const analysis = analyzeDetentionData(rawData, headers, filters);
  const studentRecords = processStudentData(rawData, headers);
  const filteredRecords = applyFilters(studentRecords, filters);
  
  return {
    title: title || 'Detention Analysis Report',
    generatedAt: new Date(),
    filters: filters || {},
    summary: analysis,
    detailedRecords: filteredRecords
  };
}

/**
 * Get detained students list with detailed information
 */
export function getDetainedStudentsList(
  rawData: any[][],
  headers: string[],
  filters?: DetentionFilter
): DetentionRecord[] {
  
  const studentRecords = processStudentData(rawData, headers);
  const filteredRecords = applyFilters(studentRecords, filters);
  
  return filteredRecords
    .filter(record => record.detentionStatus === 'detained')
    .sort((a, b) => {
      // Sort by branch, then semester, then student name
      if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
      if (a.currentSemester !== b.currentSemester) return a.currentSemester - b.currentSemester;
      return a.studentName.localeCompare(b.studentName);
    });
}

/**
 * Get students at risk of detention
 */
export function getAtRiskStudents(
  rawData: any[][],
  headers: string[],
  filters?: DetentionFilter
): DetentionRecord[] {
  
  const studentRecords = processStudentData(rawData, headers);
  const filteredRecords = applyFilters(studentRecords, filters);
  
  return filteredRecords
    .filter(record => record.riskLevel === 'high' || record.riskLevel === 'medium')
    .sort((a, b) => {
      // Sort by risk level (high first), then by backlog count
      const riskOrder = { high: 3, medium: 2, low: 1 };
      const riskDiff = riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return b.backlogCount - a.backlogCount;
    });
}
