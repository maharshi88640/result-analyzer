import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { QueryConfig } from '../types/excel';

interface GradeDistributionAnalysisProps {
  data: any[][];
  processedData?: any[][];
  headers: string[];
  selectedBranch?: string | null;
  query?: QueryConfig;
  includedSources?: string[];
}

interface SubjectInfo {
  name: string;
  code: string;
}

interface SubjectStats {
  total: number;
  passed: number;
  failed: number;
  grades: Record<string, number>;
  passPercentage: number;
  averageGrade: string;
  totalStudents: number;
  passRate: number;
  gradeDistribution: Record<string, number>;
}

interface GradeData {
  grade: string;
  count: number;
  percentage: number;
}

const GRADE_COLORS: Record<string, string> = {
  'AA': '#22C55E', // Green
  'AB': '#84CC16', // Lime
  'BB': '#EAB308', // Yellow
  'BC': '#F97316', // Orange
  'CC': '#EF4444', // Red
  'CD': '#DC2626', // Dark Red
  'DD': '#991B1B', // Darker Red
  'FF': '#7F1D1D', // Very Dark Red
  'I': '#6B7280',  // Gray
  'X': '#374151'   // Dark Gray
};

function GradeDistributionAnalysis({ 
  data, 
  processedData, 
  headers, 
  selectedBranch, 
  query,
  includedSources 
}: GradeDistributionAnalysisProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Process subject data
  const processSubjectData = useCallback((data: any[][], headers: string[]) => {
    if (!data || !headers || !Array.isArray(data) || data.length === 0) {
      return { studentRecords: [], subjects: [] };
    }

    const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'student name');
    const studentIdIndex = headers.findIndex(h => h === 'St_id') !== -1
      ? headers.findIndex(h => h === 'St_id')
      : headers.findIndex(h =>
        ['st_id', 'st_Id', 'std_id', 'studentid', 'student_id', 'student id', 'id', 'enrollment', 'enrollmentno', 'enrollment no']
          .includes(h.toLowerCase().trim())
      );

    // Find subjects
    const subjectMap = new Map<string, { code: string, name: string }>();
    const subjectPatterns = [
      { gradePattern: /^(SUB\d+)GR$/i, nameSuffix: 'NA' },
      { gradePattern: /^Subject\s*Grade$/i, namePattern: /^Subject\s*Name$/i },
      { gradePattern: /^Sub\s*\d+\s*Grade$/i, namePattern: /^Sub\s*\d+\s*Name$/i },
      { gradePattern: /^(\w+)\s*Grade$/i, namePattern: /^(\w+)\s*Name$/i }
    ];

    for (const pattern of subjectPatterns) {
      headers.forEach((header) => {
        const gradeMatch = header.match(pattern.gradePattern);
        if (gradeMatch) {
          const subjectCode = gradeMatch[1].toUpperCase();
          let subjectName = '';
          
          if (pattern.nameSuffix) {
            const naHeader = `${subjectCode}${pattern.nameSuffix}`;
            const naIndex = headers.indexOf(naHeader);
            if (naIndex !== -1) {
              for (const row of data) {
                if (row && row[naIndex] && String(row[naIndex]).trim()) {
                  subjectName = String(row[naIndex]).trim();
                  break;
                }
              }
            }
          }

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
          
          if (!subjectName) {
            subjectName = header.replace(pattern.gradePattern, '$1').replace(/[_\s]/g, ' ').trim();
          }
          
          if (subjectName && !Array.from(subjectMap.values()).some(subj => subj.name === subjectName)) {
            subjectMap.set(subjectCode, {
              code: subjectCode,
              name: subjectName
            });
          }
        }
      });
    }

    // Convert map values to subjects array
    const subjects = Array.from(subjectMap.values());
    const subjectCodes = new Set(subjects.map(subj => subj.code));

    // Process student records
    const studentRecords: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const name = String(row[nameIndex] || '').trim();
      if (!name) continue;

      // Map through subjects and find corresponding grade for each
      const studentSubjects = subjects.map(subject => {
        const grIndex = headers.findIndex(h => h === `${subject.code}GR`);
        const grade = grIndex !== -1 ? String(row[grIndex] || '').trim().toUpperCase() : '';

        return {
          name: subject.name,
          code: subject.code,
          grade: grade
        };
      });

      const studentRecord = {
        name: name,
        subjects: studentSubjects
      };

      studentRecords.push(studentRecord);
    }

    return {
      studentRecords,
      subjects
    };
  }, []);

  // Filter data by selected branch and query
  const filteredData = useMemo(() => {
    let dataToUse = processedData || data;

    // Apply query filters if provided and not already applied
    if (query && query.filters && query.filters.length > 0 && !processedData) {
      dataToUse = dataToUse.filter(row => {
        return query.filters.every(filter => {
          const colIndex = headers.indexOf(filter.column);
          if (colIndex === -1) return true;

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

    // Apply included sources filter
    if (includedSources && includedSources.length > 0) {
      const fileNameIndex = headers.findIndex(h => h.toLowerCase() === 'filename' || h.toLowerCase() === 'file_name');
      if (fileNameIndex !== -1) {
        dataToUse = dataToUse.filter(row => {
          const fileName = String(row[fileNameIndex] || '').trim();
          return includedSources.includes(fileName);
        });
      }
    }

    // Filter by selected branch
    if (selectedBranch) {
      const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
      if (brNameIndex !== -1) {
        dataToUse = dataToUse.filter(row =>
          String(row[brNameIndex] || '').toLowerCase() === selectedBranch.toLowerCase()
        );
      }
    }

    return dataToUse;
  }, [data, processedData, headers, selectedBranch, query, includedSources]);

  // Process the filtered data
  const { studentRecords, subjects } = useMemo(() => {
    return processSubjectData(filteredData, headers);
  }, [filteredData, headers, processSubjectData]);

  // Calculate grade statistics
  const calculateSubjectStats = useCallback((students: any[], subjectCode?: string): SubjectStats => {
    const stats: SubjectStats = {
      total: 0,
      passed: 0,
      failed: 0,
      grades: {},
      passPercentage: 0,
      averageGrade: '',
      totalStudents: students.length,
      passRate: 0,
      gradeDistribution: {}
    };

    const gradePoints: Record<string, number> = {
      'AA': 10, 'AB': 9, 'BB': 8, 'BC': 7, 'CC': 6, 'CD': 5, 'DD': 4,
      'FF': 0, 'I': 0, 'X': 0
    };

    const isFailGrade = (grade: string): boolean => {
      return ['FF'].includes(grade.toUpperCase());
    };

    let totalGradePoints = 0;
    let gradeCount = 0;

    students.forEach(student => {
      student.subjects.forEach((subject: any) => {
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

  // Get overall grade distribution
  const overallGradeDistribution = useMemo(() => {
    const gradeCounts: Record<string, number> = {};
    let totalGrades = 0;

    studentRecords.forEach(student => {
      student.subjects.forEach((subject: any) => {
        const grade = subject.grade?.trim().toUpperCase();
        if (grade && grade !== '') {
          gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
          totalGrades++;
        }
      });
    });

    return Object.entries(gradeCounts)
      .map(([grade, count]) => ({
        grade,
        count,
        percentage: totalGrades > 0 ? (count / totalGrades) * 100 : 0
      }))
      .sort((a, b) => {
        const gradeOrder = ['AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'FF', 'I', 'X'];
        return gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
      });
  }, [studentRecords]);

  // Get subject-specific grade distribution
  const subjectGradeDistribution = useMemo(() => {
    if (!selectedSubject) return [];

    const stats = calculateSubjectStats(studentRecords, selectedSubject);
    const total = Object.values(stats.grades).reduce((sum, count) => sum + count, 0);

    return Object.entries(stats.grades)
      .map(([grade, count]) => ({
        grade,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => {
        const gradeOrder = ['AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'FF', 'I', 'X'];
        return gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
      });
  }, [studentRecords, selectedSubject, calculateSubjectStats]);

  // Subject options for dropdown
  const subjectOptions = useMemo(() => [
    { value: '', label: 'Overall Distribution' },
    ...subjects.map(subject => ({
      value: subject.code,
      label: subject.name
    }))
  ], [subjects]);

  // Chart data
  const chartData = useMemo(() => {
    const distribution = selectedSubject ? subjectGradeDistribution : overallGradeDistribution;
    return distribution.map(item => ({
      grade: item.grade,
      count: item.count,
      percentage: item.percentage,
      fill: GRADE_COLORS[item.grade] || '#6B7280'
    }));
  }, [selectedSubject, subjectGradeDistribution, overallGradeDistribution]);

  // Handle Excel export
  const handleExportExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();

      // Overall grade distribution data
      const overallData = [
        ['GRADE DISTRIBUTION ANALYSIS', ''],
        ['Generated on', new Date().toLocaleString()],
        ['Branch', selectedBranch || 'All Branches'],
        ['Total Students', studentRecords.length],
        ['', ''],
        ['Overall Grade Distribution', ''],
        ['Grade', 'Count', 'Percentage'],
        ...overallGradeDistribution.map(item => [
          item.grade,
          item.count,
          `${item.percentage.toFixed(1)}%`
        ])
      ];

      // Subject-wise grade distribution if no specific subject selected
      if (!selectedSubject && subjects.length > 0) {
        overallData.push(
          ['', ''],
          ['Subject-wise Grade Distribution', ''],
          ['Subject', 'Grade Distribution']
        );

        subjects.forEach(subject => {
          const stats = calculateSubjectStats(studentRecords, subject.code);
          const total = Object.values(stats.grades).reduce((sum, count) => sum + count, 0);
          
          if (total > 0) {
            overallData.push([subject.name, '']);
            Object.entries(stats.grades)
              .sort(([a], [b]) => {
                const gradeOrder = ['AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'FF', 'I', 'X'];
                return gradeOrder.indexOf(a) - gradeOrder.indexOf(b);
              })
              .forEach(([grade, count]) => {
                overallData.push([`  ${grade}`, `${count} (${((count / total) * 100).toFixed(1)}%)`]);
              });
          }
        });
      }

      // Subject-specific distribution
      if (selectedSubject) {
        const subjectName = subjects.find(s => s.code === selectedSubject)?.name || selectedSubject;
        const selectedData = [
          ['SUBJECT-SPECIFIC GRADE DISTRIBUTION', ''],
          ['Generated on', new Date().toLocaleString()],
          ['Branch', selectedBranch || 'All Branches'],
          ['Subject', subjectName],
          ['', ''],
          ['Grade Distribution', ''],
          ['Grade', 'Count', 'Percentage'],
          ...subjectGradeDistribution.map(item => [
            item.grade,
            item.count,
            `${item.percentage.toFixed(1)}%`
          ])
        ];

        const wsSelected = XLSX.utils.aoa_to_sheet(selectedData);
        XLSX.utils.book_append_sheet(wb, wsSelected, 'Subject Distribution');
      }

      const wsOverall = XLSX.utils.aoa_to_sheet(overallData);
      XLSX.utils.book_append_sheet(wb, wsOverall, 'Grade Distribution');

      const filename = selectedSubject 
        ? `grade_distribution_${selectedSubject}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `grade_distribution_overall_${selectedBranch || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  }, [selectedSubject, subjectGradeDistribution, overallGradeDistribution, subjects, selectedBranch, studentRecords, calculateSubjectStats]);

  // Handle PDF export
  const handleExportPDF = useCallback(() => {
    try {
      setIsExporting(true);
      const doc = new jsPDF("l", "pt");

      let startY = 20;
      const subjectName = selectedSubject 
        ? subjects.find(s => s.code === selectedSubject)?.name || selectedSubject
        : 'Overall';

      doc.setFontSize(16);
      doc.text(`Grade Distribution Analysis - ${selectedBranch || 'All Branches'}`, 14, startY);
      doc.setFontSize(12);
      doc.text(`Subject: ${subjectName}`, 14, startY + 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, startY + 30);

      startY += 50;

      // Grade distribution table
      const distribution = selectedSubject ? subjectGradeDistribution : overallGradeDistribution;
      const tableData = distribution.map(item => [
        item.grade,
        item.count.toString(),
        `${item.percentage.toFixed(1)}%`
      ]);

      autoTable(doc, {
        startY,
        head: [['Grade', 'Count', 'Percentage']],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60 },
          2: { cellWidth: 80 }
        }
      });

      const filename = `grade_distribution_${subjectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      setIsExporting(false);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Error exporting to PDF. Please try again.');
      setIsExporting(false);
    }
  }, [selectedSubject, subjectGradeDistribution, overallGradeDistribution, subjects, selectedBranch]);

  if (studentRecords.length === 0) {
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
              Grade distribution analysis is available when subject grade data is present.
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
              Grade Distribution Analysis: {selectedBranch || 'All Branches'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Shows grade counts and distribution without individual student details
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-0">
            <div className="w-full sm:w-64">
              <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 mb-1">
                View Distribution:
              </label>
              <select
                id="subject-select"
                value={selectedSubject}
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
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isExporting ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
          <p className="text-2xl font-bold">{studentRecords.length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800">
            {selectedSubject ? 'Subject Grades' : 'Overall Grades'}
          </h3>
          <p className="text-2xl font-bold text-blue-700">
            {selectedSubject 
              ? Object.values(calculateSubjectStats(studentRecords, selectedSubject).grades).reduce((sum, count) => sum + count, 0)
              : overallGradeDistribution.reduce((sum, item) => sum + item.count, 0)
            }
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800">Pass Rate</h3>
          <p className="text-2xl font-bold text-green-700">
            {selectedSubject 
              ? `${calculateSubjectStats(studentRecords, selectedSubject).passPercentage.toFixed(1)}%`
              : 'N/A'
            }
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 className="text-sm font-medium text-purple-800">
            {selectedSubject ? 'Avg Grade' : 'Subjects'}
          </h3>
          <p className="text-2xl font-bold text-purple-700">
            {selectedSubject 
              ? calculateSubjectStats(studentRecords, selectedSubject).averageGrade
              : subjects.length
            }
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">
          Grade Distribution {selectedSubject ? `- ${subjects.find(s => s.code === selectedSubject)?.name}` : '(Overall)'}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bar Chart */}
          <div>
            <h3 className="text-lg font-medium mb-4">Grade Counts</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: number) => [value, 'Count']} />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div>
            <h3 className="text-lg font-medium mb-4">Grade Distribution</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ grade, percentage }) => `${grade}: ${percentage.toFixed(1)}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Grade Distribution Table */}
      <div className="px-6 pb-6">
        <h3 className="text-lg font-medium mb-4">Detailed Grade Distribution</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Percentage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visual
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(selectedSubject ? subjectGradeDistribution : overallGradeDistribution).map((item) => (
                <tr key={item.grade}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: GRADE_COLORS[item.grade] || '#6B7280' }}
                    >
                      {item.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.percentage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ 
                          width: `${item.percentage}%`,
                          backgroundColor: GRADE_COLORS[item.grade] || '#6B7280'
                        }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default GradeDistributionAnalysis;
