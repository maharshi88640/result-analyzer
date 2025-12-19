
import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import html2canvas from 'html2canvas';

import { QueryConfig } from '../types/excel';
// Types
type Grade = 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F' | 'Ab' | 'I';

interface SubjectInfo {
  name: string;
  code: string;
  grade: string;
  passed?: boolean;
  credits?: number;
  result?: string;
}

interface StudentRecord {
  mapNumber: string;
  studentId: string;
  name: string;
  cpi: string;
  spi: string;
  cgpa: string;
  result: string;
  semester: string;
  backlog?: string;
  grades: Record<string, string>;
  subjects: SubjectInfo[];
}

interface Subject {
  code: string;
  name: string;
}

interface SubjectStats {
  total: number;
  passed: number;
  failed: number;
  grades: Record<string, number>;
  passPercentage: number;
  averageGrade: string;
  totalStudents: number;
  totalStudentsIncludingEmpty: number;
  passRate: number;
  gradeDistribution: Record<string, number>;
  // Add any additional properties that might be used
  [key: string]: any;
}


interface SubjectAnalysisProps {
  data: any[][];
  processedData?: any[][];
  headers: string[];
  selectedBranch?: string | null;
  query?: QueryConfig;
  selectedSubject?: string;
  onSelectedSubjectChange?: (subject: string) => void;
  includedSources?: string[];
}

interface SubjectAnalysisResult {
  studentRecords: StudentRecord[];
  subjectCodes: string[];
  semesterBacklogs: string[];
  subjects: Subject[];
}

// Extend jsPDF types
declare module 'jspdf' {
  interface AutoTableOptions {
    head?: any[][];
    body?: any[][];
    startY?: number;
    margin?: { top: number; right: number; bottom: number; left: number };
    theme?: 'striped' | 'grid' | 'plain' | 'css';
    styles?: any;
    headStyles?: any;
    bodyStyles?: any;
    alternateRowStyles?: any;
    columnStyles?: Record<number, any>;
    didDrawPage?: (data: any) => void;
    willDrawPage?: (data: any) => void;
    didParseCell?: (data: any) => void;
    willDrawCell?: (data: any) => void;
  }

  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
    lastAutoTable: any;
    previousAutoTableFinalY: number;
  }
}

// Helper function to parse grade to points
const parseGradeToPoints = (grade: string): number => {
  const gradeMap: Record<string, number> = {
    'AA': 10,
    'AB': 9,
    'BB': 8,
    'BC': 7,
    'CC': 6,
    'CD': 5,
    'DD': 4,
    'DF': 0,
    'FF': 0,

  };
  return gradeMap[grade.toUpperCase()] || 0;
};

// Helper function to determine if a grade is a fail
const isFailGrade = (grade: string): boolean => {
  const failGrades = ['FF'];
  return failGrades.includes(grade.toUpperCase());
};

// Helper function to calculate branch statistics
const calculateBranchStats = (data: any[][], headers: string[]) => {
  const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
  const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');

  if (brNameIndex === -1 || resultIndex === -1) return [];

  const branchMap = new Map<string, { total: number; passed: number; failed: number }>();

  data.forEach(row => {
    const branch = String(row[brNameIndex] || '').trim();
    if (!branch) return;

    const result = String(row[resultIndex] || '').toLowerCase();
    const isPass = result.includes('pass') || result === 'p';
    const isFail = result.includes('fail') || result === 'f';

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { total: 0, passed: 0, failed: 0 });
    }

    const stats = branchMap.get(branch)!;
    stats.total++;
    if (isPass) stats.passed++;
    if (isFail) stats.failed++;
  });

  return Array.from(branchMap.entries())
    .map(([branch, stats]) => ({
      branch,
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      passPercentage: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0
    }))
    .sort((a, b) => a.branch.localeCompare(b.branch));
};




function SubjectAnalysis({ data, processedData, headers, selectedBranch: propSelectedBranch, query, selectedSubject: controlledSelectedSubject, onSelectedSubjectChange, includedSources }: SubjectAnalysisProps) {
  // All hooks must be declared at the top, before any early returns
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [gradeFilteredData, setGradeFilteredData] = useState<any[][]>([]);
  const [internalSelectedBranch, setInternalSelectedBranch] = useState<string | null>(null);
  const [isExportingGraph, setIsExportingGraph] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle grade filter changes
  const handleGradeFilterChange = useCallback((filteredData: any[][]) => {
    setGradeFilteredData(filteredData);
  }, []);

  // Process subject data into a consistent format - moved to top as useCallback
  const processSubjectData = useCallback((data: any[][], headers: string[]): SubjectAnalysisResult => {
    if (!data || !headers || !Array.isArray(data) || data.length === 0) {
      return {
        studentRecords: [],
        subjectCodes: [],
        semesterBacklogs: [],
        subjects: []
      };
    }

    // Find required column indices
    const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'student name');
    const studentIdIndex = headers.findIndex(h => h === 'St_id') !== -1
      ? headers.findIndex(h => h === 'St_id')
      : headers.findIndex(h =>
        ['st_id', 'st_Id', 'std_id', 'studentid', 'student_id', 'student id', 'id', 'enrollment', 'enrollmentno', 'enrollment no']
          .includes(h.toLowerCase().trim())
      );
    const cpiIndex = headers.findIndex(h => h.toLowerCase() === 'cpi');
    const spiIndex = headers.findIndex(h => h.toLowerCase() === 'spi');
    const cgpaIndex = headers.findIndex(h => h.toLowerCase() === 'cgpa');
    const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');
    const semesterIndex = headers.findIndex(h => h.toLowerCase() === 'sem' || h.toLowerCase() === 'semester');

    // Get semester number from the first row that has it, default to 4 if not found
    let semesterNumber = 4;
    if (semesterIndex !== -1) {
      const semesterRow = data.find(row => row && row[semesterIndex]);
      if (semesterRow && semesterRow[semesterIndex]) {
        const semMatch = String(semesterRow[semesterIndex]).match(/\d+/);
        if (semMatch) {
          semesterNumber = parseInt(semMatch[0], 10);
        }
      }
    }

    // Find the appropriate backlog column based on semester
    const backlogColumn = `bck${semesterNumber}`.toLowerCase();
    const backlogIndex = headers.findIndex(h => h.toLowerCase() === backlogColumn);

    // Initialize subjects array and subject codes set with proper typing
    const subjectMap = new Map<string, { code: string, name: string }>();

    // Enhanced subject detection logic - multiple patterns
    const subjectPatterns = [
      { gradePattern: /^(SUB\d+)GR$/i, nameSuffix: 'NA' },
      { gradePattern: /^Subject\s*Grade$/i, namePattern: /^Subject\s*Name$/i },
      { gradePattern: /^Sub\s*\d+\s*Grade$/i, namePattern: /^Sub\s*\d+\s*Name$/i },
      { gradePattern: /^(\w+)\s*Grade$/i, namePattern: /^(\w+)\s*Name$/i }
    ];

    // Try different detection strategies
    for (const pattern of subjectPatterns) {
      headers.forEach((header) => {
        const gradeMatch = header.match(pattern.gradePattern);
        if (gradeMatch) {
          const subjectCode = gradeMatch[1].toUpperCase();
          
          let subjectName = '';
          let naIndex = -1;
          
          // Strategy 1: Look for corresponding NA column
          if (pattern.nameSuffix) {
            const naHeader = `${subjectCode}${pattern.nameSuffix}`;
            naIndex = headers.indexOf(naHeader);
            if (naIndex !== -1) {
              for (const row of data) {
                if (row && row[naIndex] && String(row[naIndex]).trim()) {
                  subjectName = String(row[naIndex]).trim();
                  break;
                }
              }
            }
          }

          // Strategy 2: Look for corresponding name column
          if (!subjectName && pattern.namePattern) {
            const baseName = gradeMatch[1];
            const namePattern = new RegExp(`^${baseName}\\s*Name$`, 'i');
            const nameIndex = headers.findIndex(h => namePattern.test(h));
            if (nameIndex !== -1) {
              const firstRow = data.find(row => row && row[nameIndex] && String(row[nameIndex]).trim());
              if (firstRow) {
                subjectName = String(firstRow[nameIndex]).trim();
              }
            }
          }
          
          // Strategy 3: Use header name directly as subject name
          if (!subjectName) {
            subjectName = header.replace(pattern.gradePattern, '$1').replace(/[_\s]/g, ' ').trim();
          }
          
          if (subjectName) {
            if (!Array.from(subjectMap.values()).some(subj => subj.name === subjectName)) {
              subjectMap.set(subjectCode, {
                code: subjectCode,
                name: subjectName
              });
            }
          }
        }
      });
    }
    
    // Additional fallback: Look for any columns that might contain subject information
    if (subjectMap.size === 0) {
      console.log('No subjects found with standard patterns, trying fallback detection');
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('subject') || lowerHeader.includes('sub ')) {
          const sampleValues = data.slice(0, 5).map(row => row?.[index]).filter(val => val != null && String(val).trim() !== '');
          const hasGradeLikeValues = sampleValues.some(val => {
            const strVal = String(val).toUpperCase().trim();
            return ['AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'FF', 'P', 'F'].includes(strVal);
          });
          
          if (hasGradeLikeValues) {
            const subjectCode = header.replace(/\s+/g, '').toUpperCase().substring(0, 8);
            const subjectName = header;
            subjectMap.set(subjectCode, {
              code: subjectCode,
              name: subjectName
            });
            console.log(`Added fallback subject: ${subjectCode} - ${subjectName}`);
          }
        }
      });
    }

    // Convert map values to subjects array
    const subjects = Array.from(subjectMap.values());
    const subjectCodes = new Set(subjects.map(subj => subj.code));

    // Process student records
    const studentRecords: StudentRecord[] = [];

    // If no valid subjects found, create a basic structure with available data
    if (subjects.length === 0) {
      console.log('No subject grade data found, creating basic student records from available data');
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        const name = String(row[nameIndex] || '').trim();
        let studentId = '';
        let mapNumber = '';

        // First try to get student ID
        if (studentIdIndex !== -1) {
          studentId = String(row[studentIdIndex] || '').trim();
        }

        // If no student ID, try to get map number
        const mapNumberIndex = headers.findIndex(h =>
          h.toLowerCase() === 'map_number' ||
          h.toLowerCase() === 'map no' ||
          h.toLowerCase() === 'mapno'
        );

        if (mapNumberIndex !== -1) {
          const rawValue = row[mapNumberIndex];
          if (rawValue != null) {
            const strValue = String(rawValue).trim();
            try {
              const bigIntValue = BigInt(strValue);
              mapNumber = bigIntValue.toString();
            } catch {
              const numValue = Number(strValue);
              mapNumber = isNaN(numValue) ? strValue : numValue.toString();
            }
          } else {
            mapNumber = '';
          }
        }

        // If we have student ID but no map number, use student ID as map number
        if (studentId && !mapNumber) {
          mapNumber = studentId;
        }
        const backlog = backlogIndex !== -1 ? String(row[backlogIndex] || '0').trim() : '0';

        if (!name && !mapNumber) continue;  // Skip rows without name or map number

        const studentName = row[nameIndex]?.toString().trim();
        if (studentName) {
          const studentRecord: StudentRecord = {
            name: studentName,
            mapNumber: mapNumber,
            studentId: studentId,
            cpi: String(row[cpiIndex] || '').trim(),
            spi: String(row[spiIndex] || '').trim(),
            cgpa: String(row[cgpaIndex] || '').trim(),
            result: String(row[resultIndex] || '').trim(),
            semester: semesterNumber.toString(),
            backlog: backlog,
            grades: {},
            subjects: []
          };

          studentRecords.push(studentRecord);
        }
      }

      return {
        studentRecords,
        subjectCodes: [],
        semesterBacklogs: [],
        subjects: []
      };
    }

    // Process each student row with subject data (original logic for when subjects are found)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const name = String(row[nameIndex] || '').trim();
      let studentId = '';
      let mapNumber = '';

      // First try to get student ID
      if (studentIdIndex !== -1) {
        studentId = String(row[studentIdIndex] || '').trim();
      }

      // If no student ID, try to get map number
      const mapNumberIndex = headers.findIndex(h =>
        h.toLowerCase() === 'map_number' ||
        h.toLowerCase() === 'map no' ||
        h.toLowerCase() === 'mapno' ||
        h.toLowerCase() === 'map number' ||
        h.toLowerCase() === 'map num' ||
        h.toLowerCase() === 'mapnumber'
      );

      if (mapNumberIndex !== -1) {
        const rawValue = row[mapNumberIndex];
        if (rawValue != null) {
          const strValue = String(rawValue).trim();
          try {
            const bigIntValue = BigInt(strValue);
            mapNumber = bigIntValue.toString();
          } catch {
            const numValue = Number(strValue);
            mapNumber = isNaN(numValue) ? strValue : numValue.toString();
          }
        } else {
          mapNumber = '';
        }
      }

      // If we have student ID but no map number, use student ID as map number
      if (studentId && !mapNumber) {
        mapNumber = studentId;
      }
      const backlog = backlogIndex !== -1 ? String(row[backlogIndex] || '0').trim() : '0';

      if (!name && !mapNumber) continue;  // Skip rows without name or map number

      const studentName = row[nameIndex]?.toString().trim();
      if (studentName && subjects.length > 0) {
        // Map through subjects and find corresponding grade for each
        const studentSubjects = subjects.map(subject => {
          const grIndex = headers.findIndex(h => h === `${subject.code}GR`);
          const grade = grIndex !== -1 ? String(row[grIndex] || '').trim().toUpperCase() : '';

          // Determine if passed based on grade
          const passed = (() => {
            if (!grade) return undefined; // Not considered if empty
            return !isFailGrade(grade);
          })();

          return {
            name: subject.name,
            code: subject.code,
            grade: grade,
            passed: passed, // Can be true, false, or undefined
            credits: 0,
            result: passed === undefined ? 'N/A' : (passed ? 'PASS' : 'FAIL')
          };
        });

        const studentRecord: StudentRecord = {
          name: studentName,
          mapNumber: mapNumber,
          studentId: studentId,
          cpi: String(row[cpiIndex] || '').trim(),
          spi: String(row[spiIndex] || '').trim(),
          cgpa: String(row[cgpaIndex] || '').trim(),
          result: (() => {
            const rawResult = String(row[resultIndex] || '').trim();
            // Normalize result: handle formats like "PASS_mod", "FAIL_mod", "PASS", "FAIL", etc.
            if (!rawResult) return '';
            const upperResult = rawResult.toUpperCase();
            if (upperResult.includes('PASS')) return 'PASS';
            if (upperResult.includes('FAIL')) return 'FAIL';
            return rawResult;
          })(),
          semester: semesterNumber.toString(),
          backlog: backlog,
          grades: studentSubjects.reduce((acc, subj) => {
            acc[subj.code] = subj.grade;
            return acc;
          }, {} as Record<string, string>),
          subjects: studentSubjects
        };

        studentRecords.push(studentRecord);
      }
    }


    // Deduplicate students by mapNumber (for combined view where same student appears in multiple files)
    // Keep separate records instead of merging to avoid data corruption
    const studentMap = new Map<string, StudentRecord>();
    
    // Group students by their key (mapNumber, studentId, or name)
    studentRecords.forEach(record => {
      const key = record.mapNumber || record.studentId || record.name;
      if (!key) return;

      const existing = studentMap.get(key);
      if (!existing) {
        // First occurrence of this student - keep the record as-is
        studentMap.set(key, { ...record });
      } else {
        // For combined data, keep both records separate but mark them
        // This prevents data corruption that leads to the 's is not defined' error
        // Create a unique key for the second occurrence
        const uniqueKey = `${key}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        studentMap.set(uniqueKey, { ...record });
      }
    });

    const deduplicatedRecords = Array.from(studentMap.values());

    return {
      studentRecords: deduplicatedRecords,
      subjectCodes: Array.from(subjectCodes),
      semesterBacklogs: [],
      subjects
    };
  }, []);



  // Early return for no data - must happen after all hooks
  if (!data || !headers || data.length === 0) {
    return <div>No data available</div>;
  }

  // Use prop selectedBranch if provided, otherwise use internal state
  const selectedBranch = propSelectedBranch !== undefined ? propSelectedBranch : internalSelectedBranch;

  // Reset selected subject when branch changes only if not controlled by parent
  React.useEffect(() => {
    if (selectedBranch !== undefined && controlledSelectedSubject === undefined) {
      setSelectedSubject('');
    }
  }, [selectedBranch, controlledSelectedSubject]);

  // Sync internal selectedSubject from controlled prop when provided
  React.useEffect(() => {
    if (controlledSelectedSubject !== undefined && controlledSelectedSubject !== selectedSubject) {
      setSelectedSubject(controlledSelectedSubject || '');
    }
  }, [controlledSelectedSubject]);

  // Emit selection changes upward only in uncontrolled mode to avoid loops and lag
  React.useEffect(() => {
    if (onSelectedSubjectChange && controlledSelectedSubject === undefined) {
      onSelectedSubjectChange(selectedSubject);
    }
  }, [selectedSubject, controlledSelectedSubject, onSelectedSubjectChange]);

  // Calculate available branches
  const branches = useMemo(() => {
    const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
    if (brNameIndex === -1) return [];

    const uniqueBranches = new Set<string>();
    data.forEach(row => {
      if (row[brNameIndex]) {
        uniqueBranches.add(String(row[brNameIndex]));
      }
    });
    return Array.from(uniqueBranches).sort();
  }, [data, headers]);


  // Filter data by selected branch, query, and included sources
  const filteredData = useMemo(() => {
    // Start with processedData (which already includes query filters) if available, otherwise use data
    let dataToUse = processedData || data;

    // Apply query filters if provided and not already applied (processedData might not have them)
    if (query && query.filters && query.filters.length > 0 && !processedData) {
      dataToUse = dataToUse.filter(row => {
        return query.filters.every(filter => {
          const colIndex = headers.indexOf(filter.column);
          if (colIndex === -1) return true; // Skip if column not found

          const cellValue = String(row[colIndex] || '').toLowerCase();
          const filterValue = String(filter.value).toLowerCase();

          switch (filter.operator) {
            case 'equals':
              return cellValue === filterValue;
            case 'contains':
              return cellValue.includes(filterValue);
            case 'greater':
              const numVal = parseFloat(cellValue);
              const filterNum = parseFloat(filterValue);
              return !isNaN(numVal) && !isNaN(filterNum) && numVal > filterNum;
            case 'less':
              const numVal2 = parseFloat(cellValue);
              const filterNum2 = parseFloat(filterValue);
              return !isNaN(numVal2) && !isNaN(filterNum2) && numVal2 < filterNum2;
            case 'not_equals':
              return cellValue !== filterValue;
            default:
              return true;
          }
        });
      });
    }

    // Apply included sources filter (for Combined view)
    if (includedSources && includedSources.length > 0) {
      const fileNameIndex = headers.findIndex(h => h.toLowerCase() === 'filename' || h.toLowerCase() === 'file_name');
      if (fileNameIndex !== -1) {
        dataToUse = dataToUse.filter(row => {
          const fileName = String(row[fileNameIndex] || '').trim();
          return includedSources.includes(fileName);
        });
      }
    }

    // If no branch selection, return filtered data
    if (!selectedBranch) return dataToUse;

    // Filter data by selected branch
    const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
    if (brNameIndex === -1) return dataToUse;

    return dataToUse.filter(row =>
      String(row[brNameIndex] || '').toLowerCase() === selectedBranch.toLowerCase()
    );
  }, [data, processedData, headers, selectedBranch, query, includedSources]);





  // Helper function to calculate subject statistics
  const calculateSubjectStats = useCallback((students: StudentRecord[], subjectCode?: string): SubjectStats => {
    const stats: SubjectStats = {
      total: 0,
      passed: 0,
      failed: 0,
      grades: {},
      passPercentage: 0,
      averageGrade: '',
      totalStudents: students.length,
      totalStudentsIncludingEmpty: students.length,
      passRate: 0,
      gradeDistribution: {}
    };

    const gradePoints: Record<string, number> = {
      'AA': 10, 'AB': 9, 'BB': 8, 'BC': 7, 'CC': 6, 'CD': 5, 'DD': 4,
      'FF': 0, 'I': 0, 'X': 0
    };

    let totalGradePoints = 0;
    let gradeCount = 0;

    students.forEach(student => {
      student.subjects.forEach(subject => {
        if (subjectCode && subject.code !== subjectCode) return;

        stats.total++;
        const grade = subject.grade?.trim().toUpperCase();

        if (grade) {
          // Count grades
          stats.grades[grade] = (stats.grades[grade] || 0) + 1;

          // Calculate pass/fail
          if (isFailGrade(grade)) {
            stats.failed++;
          } else {
            stats.passed++;
          }

          // Calculate average grade
          if (grade in gradePoints) {
            totalGradePoints += gradePoints[grade];
            gradeCount++;
          }
        }
      });
    });

    if (gradeCount > 0) {
      const avgPoints = totalGradePoints / gradeCount;
      // Convert back to letter grade (simplified)
      const gradeRanges = [
        { min: 9.5, grade: 'AA' },
        { min: 8.5, grade: 'AB' },
        { min: 7.5, grade: 'BB' },
        { min: 6.5, grade: 'BC' },
        { min: 5.5, grade: 'CC' },
        { min: 4.5, grade: 'CD' },
        { min: 4, grade: 'DD' },
        { min: 0, grade: 'FF' }
      ];

      const matchedGrade = gradeRanges.find(range => avgPoints >= range.min);
      stats.averageGrade = matchedGrade ? matchedGrade.grade : 'N/A';
    }

    stats.passPercentage = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
    stats.passRate = stats.passPercentage;
    stats.gradeDistribution = stats.grades;

    return stats;
  }, []);

  // Process data with useMemo to avoid unnecessary recalculations
  // Calculate student records first, then filter subjects based on actual data
  const studentRecords = useMemo(() => {
    try {
      // Use gradeFilteredData if available, otherwise use filteredData
      const dataToUse = gradeFilteredData.length > 0 ? gradeFilteredData : filteredData;
      const result = processSubjectData(dataToUse, headers);
      return result.studentRecords;
    } catch (error) {
      console.error('Error processing subject data:', error);
      return [];
    }
  }, [filteredData, gradeFilteredData, headers]);

  // Calculate subjects from filtered data, but only include subjects with actual grade data
  const subjects = useMemo(() => {
    try {
      const result = processSubjectData(filteredData, headers);
      // Filter out subjects that have no actual grade data in student records
      const subjectsWithData = result.subjects.filter(subject => {
        // Check if any student has a non-empty grade for this subject
        const hasData = studentRecords.some(student => {
          const subjectData = student.subjects.find(s => s.code === subject.code);
          return subjectData && subjectData.grade && subjectData.grade.trim() !== '';
        });
        return hasData;
      });
      return subjectsWithData;
    } catch (error) {
      console.error('Error processing subject data:', error);
      return [];
    }
  }, [filteredData, headers, studentRecords]);

  // Normalize selectedSubject to a subject code for select binding (accepts either name or code from saved state)
  const normalizedSelectedSubject = useMemo(() => {
    if (!selectedSubject) return '';
    const match = subjects.find(s => s.code === selectedSubject || s.name === selectedSubject);
    return match ? match.code : selectedSubject;
  }, [selectedSubject, subjects]);

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter students based on selected subject and exclude blank grades
  const filteredStudents = useMemo(() => {
    let students = selectedSubject
      ? studentRecords.filter(student => {
          const subject = student.subjects.find(s =>
            (s.name === selectedSubject || s.code === selectedSubject) &&
            s.grade && s.grade.trim() !== ''
          );
          return subject !== undefined;
        })
      : studentRecords;

    // Apply sorting
    if (sortColumn) {
      students = [...students].sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortColumn) {
          case 'mapNumber':
            aValue = parseFloat(a.mapNumber) || 0;
            bValue = parseFloat(b.mapNumber) || 0;
            break;
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'spi':
            aValue = parseFloat(a.spi) || 0;
            bValue = parseFloat(b.spi) || 0;
            break;
          case 'cpi':
            aValue = parseFloat(a.cpi) || 0;
            bValue = parseFloat(b.cpi) || 0;
            break;
          case 'cgpa':
            aValue = parseFloat(a.cgpa) || 0;
            bValue = parseFloat(b.cgpa) || 0;
            break;
          case 'result':
            aValue = a.result.toLowerCase();
            bValue = b.result.toLowerCase();
            break;
          case 'backlog':
            aValue = parseInt(a.backlog || '0') || 0;
            bValue = parseInt(b.backlog || '0') || 0;
            break;
          default:
            // Handle subject columns
            if (selectedSubject) {
              const aSubject = a.subjects.find(s => s.code === selectedSubject);
              const bSubject = b.subjects.find(s => s.code === selectedSubject);
              aValue = aSubject?.grade || '';
              bValue = bSubject?.grade || '';
            } else {
              const subjectIndex = subjects.findIndex(s => s.code === sortColumn);
              if (subjectIndex !== -1) {
                aValue = a.subjects[subjectIndex]?.grade || '';
                bValue = b.subjects[subjectIndex]?.grade || '';
              } else {
                aValue = '';
                bValue = '';
              }
            }
            break;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc'
            ? (aValue > bValue ? 1 : aValue < bValue ? -1 : 0)
            : (aValue < bValue ? 1 : aValue > bValue ? -1 : 0);
        }
      });
    }

    return students;
  }, [studentRecords, selectedSubject, sortColumn, sortDirection, subjects]);

  // Calculate subject statistics
  const subjectStats = useMemo(() => {
    if (!selectedSubject || filteredStudents.length === 0) return null;

    const stats: SubjectStats = {
      total: 0,
      passed: 0,
      failed: 0,
      grades: {},
      passPercentage: 0,
      averageGrade: '',
      totalStudents: 0,
      totalStudentsIncludingEmpty: filteredStudents.length,
      passRate: 0,
      gradeDistribution: {}
    };

    filteredStudents.forEach(student => {
      const subject = student.subjects.find(s =>
        s.name === selectedSubject || s.code === selectedSubject
      );

      if (subject && subject.grade) {
        stats.total++;
        if (subject.passed) {
          stats.passed++;
        } else {
          stats.failed++;
        }
        stats.grades[subject.grade] = (stats.grades[subject.grade] || 0) + 1;
      }
    });

    if (stats.total > 0) {
      stats.totalStudents = stats.total;
      stats.passPercentage = Math.round((stats.passed / stats.total) * 100);
      stats.passRate = stats.passPercentage;
      stats.gradeDistribution = { ...stats.grades };

      // Calculate average grade (simple average for demonstration)
      const gradePoints: Record<string, number> = {
        'AA': 10, 'AB': 9, 'BB': 8, 'BC': 7, 'CC': 6, 'CD': 5, 'DD': 4, 'FF': 0, 'I': 0, 'X': 0
      };

      let totalPoints = 0;
      let gradeCount = 0;

      Object.entries(stats.grades).forEach(([grade, count]) => {
        if (grade in gradePoints) {
          totalPoints += gradePoints[grade] * count;
          gradeCount += count;
        }
      });

      if (gradeCount > 0) {
        const avgPoints = totalPoints / gradeCount;
        // Convert back to letter grade (simplified)
        const gradeRanges = [
          { min: 9.5, grade: 'AA' },
          { min: 8.5, grade: 'AB' },
          { min: 7.5, grade: 'BB' },
          { min: 6.5, grade: 'BC' },
          { min: 5.5, grade: 'CC' },
          { min: 4.5, grade: 'CD' },
          { min: 4, grade: 'DD' },
          { min: 0, grade: 'FF' }
        ];

        const matchedGrade = gradeRanges.find(range => avgPoints >= range.min);
        stats.averageGrade = matchedGrade ? matchedGrade.grade : 'N/A';
      }
    }

    return stats;
  }, [filteredStudents, selectedSubject]);

  // Calculate overall statistics
  const { totalStudents, totalPassed, overallPassRate, subjectOptions } = useMemo(() => {
    const totalStudents = studentRecords.length;
    const totalPassed = studentRecords.filter(student => {
      // A student passes only if they have subjects and passed all of them
      if (student.subjects.length === 0) return false;
      return student.subjects.every(subject => subject.passed !== false);
    }).length;

    const overallPassRate = totalStudents > 0 ? (totalPassed / totalStudents) * 100 : 0;

    const subjectOptions = [
      { value: '', label: 'All Subjects' },
      ...(subjects || []).map(subject => ({
        value: subject.code,
        label: subject.name
      }))
    ];

    return {
      totalStudents,
      totalPassed,
      overallPassRate,
      subjectOptions
    };
  }, [studentRecords, subjects]);



  // Helper function to shorten subject names
  const shortenSubjectName = (name: string): string => {
    if (name.length <= 15) return name;
    // Create acronym from first letter of each word
    const words = name.split(/\s+/);
    const acronym = words.map(word => word.charAt(0).toUpperCase()).join('');
    return acronym.length > 10 ? acronym.substring(0, 10) + '...' : acronym;
  };

  // Color palette for subjects
  const colorPalette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
    '#F1948A', '#85C1E9', '#D7BDE2', '#AED6F1', '#A3E4D7'
  ];

  // Calculate graph data for selected branch or overall
  const selectedBranchGraphData = useMemo(() => {
    if (subjects.length === 0) {
      console.log('No subjects:', { subjectsLength: subjects.length });
      return [];
    }

    const data = subjects.map((subject, index) => {
      const stats = calculateSubjectStats(studentRecords, subject.code);
 

      // Filter out subjects with no students or no actual grade data
      if (stats.totalStudents === 0 || stats.total === 0) return null;

      const color = colorPalette[index % colorPalette.length];

      const chartData = {
        subject: shortenSubjectName(subject.name),
        passRate: Number(stats.passPercentage) || 0,
        failRate: 100 - (Number(stats.passPercentage) || 0),
        totalStudents: stats.totalStudents,
        color: color
      };

    
      return chartData;
    }).filter(item => item !== null);


    return data;
  }, [subjects, studentRecords]);

  // Handle graph export
  const handleExportGraph = useCallback(async () => {
    setIsExportingGraph(true);
    try {
      const graphElement = document.getElementById('selected-branch-graph');
      if (graphElement) {
        const canvas = await html2canvas(graphElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        const link = document.createElement('a');
        link.download = `subject_analysis_graph_${selectedBranch || 'all_branches'}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (error) {
      console.error('Error exporting graph:', error);
      alert('Error exporting graph. Please try again.');
    } finally {
      setIsExportingGraph(false);
    }
  }, [selectedBranch]);



  // Helper function to create simple grade analysis sheet showing only AA and AB counts
  const createGradeAnalysisSheet = useCallback((wb: any) => {
    const gradeAnalysisData: any[][] = [];

    // Header section
    gradeAnalysisData.push(
      ['GRADE WISE ANALYSIS', ''],
      ['Generated on', new Date().toLocaleString()],
      ['Branch', selectedBranch || 'All Branches'],
      ['Total Students', studentRecords.length],
      ['', '']
    );

    if (selectedSubject) {
      // Single subject analysis - show AA and AB counts for selected subject
      const subjectName = subjects.find(s => s.code === selectedSubject)?.name || selectedSubject;
      gradeAnalysisData.push([`Subject: ${subjectName}`, '']);
      gradeAnalysisData.push(['Grade', 'Number of Students']);
      
      const stats = calculateSubjectStats(studentRecords, selectedSubject);
      const aaCount = stats.gradeDistribution['AA'] || 0;
      const abCount = stats.gradeDistribution['AB'] || 0;
      
      gradeAnalysisData.push(['AA', aaCount]);
      gradeAnalysisData.push(['AB', abCount]);
      
      // Add total students who got either AA or AB
      const aaOrAbCount = aaCount + abCount;
      gradeAnalysisData.push(['', '']);
      gradeAnalysisData.push(['Total (AA + AB)', aaOrAbCount]);
    } else {
      // All subjects analysis - show AA and AB counts for each subject
      gradeAnalysisData.push(['Subject-wise AA and AB Analysis', '']);
      gradeAnalysisData.push(['Subject Name', 'AA Count', 'AB Count', 'Total (AA + AB)']);
      
      subjects.forEach(subject => {
        const stats = calculateSubjectStats(studentRecords, subject.code);
        const aaCount = stats.gradeDistribution['AA'] || 0;
        const abCount = stats.gradeDistribution['AB'] || 0;
        const total = aaCount + abCount;
        
        gradeAnalysisData.push([
          subject.name,
          aaCount,
          abCount,
          total
        ]);
      });
      
      // Add summary row
      gradeAnalysisData.push(['', '', '', '']);
      const totalAA = subjects.reduce((sum, subject) => {
        const stats = calculateSubjectStats(studentRecords, subject.code);
        return sum + (stats.gradeDistribution['AA'] || 0);
      }, 0);
      
      const totalAB = subjects.reduce((sum, subject) => {
        const stats = calculateSubjectStats(studentRecords, subject.code);
        return sum + (stats.gradeDistribution['AB'] || 0);
      }, 0);
      
      gradeAnalysisData.push(['TOTAL', totalAA, totalAB, totalAA + totalAB]);
    }

    // Create worksheet and add to workbook
    const wsGradeAnalysis = XLSX.utils.aoa_to_sheet(gradeAnalysisData);
    XLSX.utils.book_append_sheet(wb, wsGradeAnalysis, 'Grade Wise Analysis');
  }, [studentRecords, subjects, selectedSubject, selectedBranch, calculateSubjectStats]);

  // Handle Excel download
  const handleDownloadExcel = useCallback(() => {
    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Prepare student data with all columns from the table
      const studentData = [
        [
          'Map No',
          'Student Name',
          'SPI',
          'CPI',
          'CGPA',
          'Result',
          'Subject Result',
          'BCK',
          ...(selectedSubject
            ? [subjects.find(s => s.code === selectedSubject)?.name || selectedSubject]
            : subjects.map(subj => subj.name)
          )
        ],
        ...filteredStudents.map(student => {
          const subjectResult = selectedSubject
            ? (() => {
                const subject = student.subjects.find(subj => subj.code === selectedSubject);
                if (!subject || !subject.grade) return '';
                return isFailGrade(subject.grade) ? 'FAIL' : 'PASS';
              })()
            : '';

          return [
            student.mapNumber || '-',
            student.name,
            student.spi || '-',
            student.cpi || '-',
            student.cgpa || '-',
            student.result || '-',
            subjectResult,
            student.backlog || '0',
            ...(selectedSubject
              ? [
                  student.subjects.find(subj => subj.code === selectedSubject)?.grade || '-'
                ]
              : subjects.map(subj =>
                  student.subjects.find(s => s.code === subj.code)?.grade || '-'
                )
            )
          ];
        })
      ];

      // Add student data sheet
      const wsStudents = XLSX.utils.aoa_to_sheet(studentData);


      // Add student data sheet
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Data');

      // Add simplified analysis worksheet
      const analysisData = [
        ['Analysis Summary', ''],
        ['Generated on', new Date().toLocaleString()],
        ['Branch', selectedBranch || 'All Branches'],
        ['Total Students', filteredStudents.length],
        ['', '']
      ];

      if (selectedSubject && subjectStats) {
        const subjectName = subjects.find(s => s.code === selectedSubject)?.name || selectedSubject;
        analysisData.push(
          ['Subject Analysis', ''],
          ['Subject', subjectName],
          ['Total Students', subjectStats.totalStudentsIncludingEmpty],
          ['With Grades', subjectStats.totalStudents],
          ['Passed', subjectStats.passed],
          ['Failed', subjectStats.failed],
          ['Pass Rate', `${subjectStats.passRate.toFixed(2)}%`],
          ['Average Grade', subjectStats.averageGrade],
          ['', '']
        );

        // Add only AA and AB grade counts
        const aaCount = subjectStats.gradeDistribution['AA'] || 0;
        const abCount = subjectStats.gradeDistribution['AB'] || 0;
        
        analysisData.push(['Grade Distribution', 'Count']);
        analysisData.push(['AA', aaCount]);
        analysisData.push(['AB', abCount]);
        analysisData.push(['Total (AA + AB)', aaCount + abCount]);
      } else {
        analysisData.push(
          ['Overall Statistics', ''],
          ['Total Subjects', subjects.length],
          ['Overall Pass Rate', `${overallPassRate.toFixed(2)}%`],
          ['Students Passed', totalPassed],
          ['Students Failed', totalStudents - totalPassed],
          ['', ''],
          ['Subject-wise Summary', ''],
          ['Subject', 'Students', 'Pass Rate', 'Avg Grade']
        );

        // Add simplified subject-wise statistics
        subjects.forEach(subject => {
          const stats = calculateSubjectStats(studentRecords, subject.code);
          analysisData.push([
            subject.name,
            stats.total,
            `${stats.passPercentage.toFixed(1)}%`,
            stats.averageGrade
          ]);
        });
        
        // Add overall AA and AB summary
        analysisData.push(['', '']);
        analysisData.push(['Grade Distribution', 'Count']);
        
        const totalAA = subjects.reduce((sum, subject) => {
          const stats = calculateSubjectStats(studentRecords, subject.code);
          return sum + (stats.gradeDistribution['AA'] || 0);
        }, 0);
        
        const totalAB = subjects.reduce((sum, subject) => {
          const stats = calculateSubjectStats(studentRecords, subject.code);
          return sum + (stats.gradeDistribution['AB'] || 0);
        }, 0);
        
        analysisData.push(['AA', totalAA]);
        analysisData.push(['AB', totalAB]);
        analysisData.push(['Total (AA + AB)', totalAA + totalAB]);
      }

      const wsAnalysis = XLSX.utils.aoa_to_sheet(analysisData);
      XLSX.utils.book_append_sheet(wb, wsAnalysis, 'Summary');

      // Add Branch Analysis sheet
      const branchStats = calculateBranchStats(filteredData, headers);
      if (branchStats.length > 0) {
        const branchHeaders = ['Branch', 'Total Students', 'Passed', 'Failed', 'Pass Percentage'];
        const branchData = branchStats.map(stat => [
          stat.branch,
          stat.total,
          stat.passed,
          stat.failed,
          `${stat.passPercentage}%`
        ]);
        const branchWorksheetData = [branchHeaders, ...branchData];
        const branchWorksheet = XLSX.utils.aoa_to_sheet(branchWorksheetData);
        XLSX.utils.book_append_sheet(wb, branchWorksheet, 'Branch Analysis');
      }

      // Generate Excel file
      XLSX.writeFile(wb, `${selectedBranch || 'all'}_subject_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  }, [filteredStudents, selectedSubject, subjects, selectedBranch, subjectStats, studentRecords, overallPassRate, calculateSubjectStats, filteredData, headers, createGradeAnalysisSheet]);

  // Handle PDF download
  const handleDownloadPDF = useCallback(() => {
    try {
      setIsGeneratingPDF(true);

      const doc = new jsPDF("l", "pt");

      let startY = 20;

      doc.setFontSize(16);
      doc.text(`Subject Analysis - ${selectedBranch || "All Branches"}`, 14, startY);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, startY + 12);

      startY += 30;

      // Prepare table headers (same as Excel export)
      const headers = [
        'Map No',
        'Student Name',
        'SPI',
        'CPI',
        'CGPA',
        'Result',
        'Subject Result',
        'Curr BCK',
        ...(selectedSubject
          ? [subjects.find(s => s.code === selectedSubject)?.name || selectedSubject]
          : subjects.map(subj => subj.name)
        )
      ];

      // Prepare table data (same as Excel export)
      const tableData = filteredStudents.map(student => {
        const subjectResult = selectedSubject
          ? (() => {
              const subject = student.subjects.find(subj => subj.code === selectedSubject);
              if (!subject || !subject.grade) return '';
              return isFailGrade(subject.grade) ? 'FAIL' : 'PASS';
            })()
          : '';

        return [
          student.mapNumber || '-',
          student.name,
          student.spi || '-',
          student.cpi || '-',
          student.cgpa || '-',
          student.result || '-',
          subjectResult,
          student.backlog || '0',
          ...(selectedSubject
            ? [
                student.subjects.find(subj => subj.code === selectedSubject)?.grade || '-'
              ]
            : subjects.map(subj =>
                student.subjects.find(s => s.code === subj.code)?.grade || '-'
              )
            )
        ];
      });

      // Create the main data table
      autoTable(doc, {
        startY,
        head: [headers],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 60 }, // Map No
          1: { cellWidth: 65 }, // Student Name
          2: { cellWidth: 20 }, 
          3: { cellWidth: 20 }, 
          4: { cellWidth: 20 }, 
          5: { cellWidth: 35 }, // Result
          6: { cellWidth: 35 }, // Subject Result
          7: { cellWidth: 30 }, // BCK
         
          ...Array.from({ length: Math.max(0, headers.length - 8) }, (_, i) => ({
            [i + 8]: { cellWidth: 55 }
          })).reduce((acc, obj) => ({ ...acc, ...obj }), {})
        },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto', 
        horizontalPageBreak: false,         didParseCell: function(data: any) {
          // Highlight FF grades and FAIL results with red background
          const cellValue = String(data.cell.raw || '').toUpperCase();
          if (cellValue === 'FF' || cellValue === 'FAIL') {
            data.cell.styles.fillColor = [255, 102, 102];
            data.cell.styles.textColor = [139, 0, 0]; 
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // Add summary section at the bottom
      startY = (doc as any).lastAutoTable.finalY + 20;

      // Summary Table
      autoTable(doc, {
        startY,
        head: [["Metric", "Value"]],
        body: [
          ["Total Students", totalStudents],
          ["Students Passed", totalPassed],
          ["Overall Pass Rate", `${overallPassRate.toFixed(2)}%`]
        ],
        theme: "grid",
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] }
      });

      // Save the PDF with proper filename
      const filename = `${(selectedBranch || 'all').replace(/[^a-zA-Z0-9]/g, '_')}_subject_analysis_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      setIsGeneratingPDF(false);
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      alert(`Error exporting to PDF: ${err instanceof Error ? err.message : 'Please try again.'}`);
      setIsGeneratingPDF(false);
    }
  }, [
    selectedBranch,
    totalStudents,
    totalPassed,
    overallPassRate,
    subjects,
    studentRecords,
    selectedSubject,
    filteredStudents
  ]);




  if (!studentRecords || studentRecords.length === 0) {
    return (
      <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Subject-wise analysis is available when subject grade data is present. The current data shows general student information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Subject-wise Analysis: {selectedBranch || 'All Branches'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Shows pass/fail statistics for each subject
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-0">
            {propSelectedBranch === undefined && branches.length > 0 && (
              <div className="w-full sm:w-48">
                <label htmlFor="branch-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Branch:
                </label>
                <select
                  id="branch-select"
                  value={selectedBranch || ''}
                  onChange={(e) => setInternalSelectedBranch(e.target.value || null)}
                  className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch, index) => (
                    <option key={index} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDownloadExcel}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Excel
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
            <div className="w-full sm:w-64">
              <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Subject:
              </label>
              <select
                id="subject-select"
                value={normalizedSelectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {subjectOptions.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
     </div>
      {/* <GradeRangeFilter
        data={filteredData}
        headers={headers}
        onFilterChange={handleGradeFilterChange}
      /> */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
          <p className="text-2xl font-bold">{selectedSubject ? filteredStudents.length : studentRecords.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800">
            {selectedSubject ? `${subjects.find(s => s.code === selectedSubject)?.name || selectedSubject} Pass Rate` : 'Overall Pass Rate'}
          </h3>
          <p className="text-2xl font-bold text-green-700">
            {selectedSubject && subjectStats ? 
              `${subjectStats.passPercentage.toFixed(1)}%` : 
              `${overallPassRate.toFixed(1)}%`
          }</p>
          <div className="text-xs text-green-600 mt-1 space-y-0.5">
            {selectedSubject && subjectStats ? (
              <>
                <div>{subjectStats.passed} passed, {subjectStats.failed} failed</div>
                {subjectStats.totalStudentsIncludingEmpty > subjectStats.totalStudents && (
                  <div className="text-gray-500">
                    ({subjectStats.totalStudentsIncludingEmpty - subjectStats.totalStudents} without grades)
                  </div>
                )}
              </>
            ) : (
              <div>{totalPassed} passed, {totalStudents - totalPassed} failed</div>
            )}
          </div>
        </div>
        {!selectedSubject && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-sm font-medium text-blue-800">Total Subjects</h3>
            <p className="text-2xl font-bold text-blue-700">{subjects.length}</p>
          </div>
        )}
      </div>

      {/* Graph Section */}
      <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Subject Analysis: {selectedBranch || 'All Branches'}
          </h2>
          <button
            onClick={handleExportGraph}
            disabled={isExportingGraph}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {isExportingGraph ? 'Exporting...' : 'Export as Image'}
          </button>
        </div>

       <div className="mb-8">
  <h3 className="text-lg font-medium mb-4">Subject Pass/Fail Analysis</h3>
  <div className="h-80" id="selected-branch-graph">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        margin={{top:20}}
        data={selectedBranchGraphData.map(stat => ({
          subject: stat.subject,
          fullSubject: subjects.find(s => shortenSubjectName(s.name) === stat.subject)?.name || stat.subject,
          passRate: stat.passRate,
          failRate: stat.failRate
        }))}
        onMouseMove={() => {}} // prevents fade
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="subject" />
        <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />

        <Tooltip
          labelFormatter={(label, payload) => {
            const fullName = payload?.[0]?.payload?.fullSubject || label;
            return `${label} (${fullName})`;
          }}
          formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
        />

        <Legend />

        <Bar
          dataKey="passRate"
          fill="#10B981"
          name="Pass Rate"
          isAnimationActive={false}
        >
          <LabelList dataKey="passRate" position="top" offset={10} formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
        </Bar>
        <Bar
          dataKey="failRate"
          fill="#EF4444"
          name="Fail Rate"
          isAnimationActive={false}
        >
          <LabelList dataKey="failRate" position="top" offset={10} formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>
      </div>

      <div className="relative overflow-x-auto overflow-y-auto max-h-96" style={{ maxHeight: '1200px' }}>
        <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('mapNumber')}
              >
                <div className="flex items-center justify-between">
                  <span>Map No</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'mapNumber' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'mapNumber' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center justify-between">
                  <span>Student Name</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'name' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'name' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('spi')}
                style={{ minWidth: '80px' }}
              >
                <div className="flex items-center justify-center">
                  <span>SPI</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'spi' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'spi' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cpi')}
                style={{ minWidth: '80px' }}
              >
                <div className="flex items-center justify-center">
                  <span>CPI</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'cpi' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'cpi' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cgpa')}
                style={{ minWidth: '80px' }}
              >
                <div className="flex items-center justify-center">
                  <span>CGPA</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'cgpa' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'cgpa' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
              {!selectedSubject ? (
                subjects.slice(0, 15).map(({ code, name }) => (
                  <th
                    key={code}
                    className="px-2 py-2 text-center text-xs font-medium text-gray-700 tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                    title={code}
                    onClick={() => handleSort(code)}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="font-semibold text-sm">{name}</span>
                      <div className="flex flex-col mt-1">
                        <svg className={`h-3 w-3 ${sortColumn === code && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        <svg className={`h-3 w-3 -mt-1 ${sortColumn === code && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </th>
                ))
              ) : (
                <th
                  className="px-2 py-2 text-center text-xs font-medium text-gray-700 tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                  title={selectedSubject}
                  onClick={() => handleSort(selectedSubject)}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="font-semibold text-sm">
                      {subjects.find(s => s.code === selectedSubject)?.name || selectedSubject}
                    </span>
                    <div className="flex flex-col mt-1">
                      <svg className={`h-3 w-3 ${sortColumn === selectedSubject && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      <svg className={`h-3 w-3 -mt-1 ${sortColumn === selectedSubject && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </th>
              )}
              <th
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('result')}
              >
                <div className="flex items-center justify-center">
                  <span>Result</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'result' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'result' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
              {selectedSubject && (
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                  Subject Result
                </th>
              )}
              <th
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('backlog')}
              >
                <div className="flex items-center justify-center">
                  <span>Curr BCK</span>
                  <div className="flex flex-col ml-1">
                    <svg className={`h-3 w-3 ${sortColumn === 'backlog' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg className={`h-3 w-3 -mt-1 ${sortColumn === 'backlog' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStudents.map((student: StudentRecord, index: number) => (
              <tr key={student.studentId || index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200">
                  {student.mapNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-200">
                  {student.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 border border-gray-200">
                  {student.spi}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 border border-gray-200">
                  {student.cpi}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 border border-gray-200">
                  {student.cgpa}
                </td>
                {!selectedSubject ? (
                  subjects.slice(0, 15).map((subject) => {
                    const studentSubject = student.subjects.find(s => s.code === subject.code);
                    const grade = studentSubject?.grade || '';
                    return (
                      <td
                        key={subject.code}
                        className={`px-2 py-2 text-center text-sm font-medium border ${
                          grade === 'FF'
                            ? 'bg-red-50 text-red-800'
                            : 'text-gray-900'
                        }`}
                      >
                        {grade || '-'}
                      </td>
                    );
                  })
                ) : (
                  <td className="px-2 py-2 text-center text-sm font-medium border">
                    {student.subjects.find(s => s.code === selectedSubject)?.grade || '-'}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border border-gray-200">
                  {(() => {
                    const result = student.result || '';
                    if (!result) return '-';
                    const normalizedResult = result.toUpperCase().includes('PASS') ? 'PASS' : 
                                           result.toUpperCase().includes('FAIL') ? 'FAIL' : result;
                    return (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        normalizedResult === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {normalizedResult}
                      </span>
                    );
                  })()}
                </td>
                {selectedSubject && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center border border-gray-200">
                    {(() => {
                      const subject = student.subjects.find(s => s.code === selectedSubject);
                      const grade = subject?.grade || '';
                      const isPass = !isFailGrade(grade);
                      return grade ? (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isPass ? 'PASS' : 'FAIL'}
                        </span>
                      ) : '-';
                    })()}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border border-gray-200">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${parseInt(student.backlog || '0') > 0 ? 'bg-red-100 text-red-800 font-medium' : 'text-gray-500'}`}>
                    {student.backlog || '0'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubjectAnalysis;