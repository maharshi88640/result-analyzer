import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { exportToExcel } from '../utils/excelExporter';
import * as XLSX from 'xlsx';


interface AnalysisData {
  metric: string;
  average: number;
  min: number;
  max: number;
  median: number;
  count: number;
}

interface SubjectStats {
  subjectCode: string;
  subjectName: string;
  appeared: number;
  passRatio: number;
  averageCPI: number;
}



interface SimplifiedAnalysisPanelProps {
  data: any[][];
  processedData?: any[][];
  headers: string[];
  title?: string;
  selectedBranch?: string | null;
  selectedYear?: 'all' | '1' | '2' | '3' | '4';
  currentView?: string;
  onViewChange?: (view: string) => void;
  // onBranchSelect?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  branches?: string[];
}


export const SimplifiedAnalysisPanel: React.FC<SimplifiedAnalysisPanelProps> = ({
  data,
  processedData,
  headers,
  title = 'Performance Analysis',
  selectedBranch: propSelectedBranch = null,
  selectedYear,
  currentView,
  onViewChange,
  // onBranchSelect,
  // onColumnToggle,
  // selectedColumns,

}) => {

  const getColumnIndex = (name: string) => {
    return headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  };


  // Helper function to filter data based on year selection
  const filterDataByYear = useMemo(() => {
    if (!selectedYear || selectedYear === 'all') {
      return processedData || data;
    }

    const norm = (v: any) => (v === null || v === undefined ? '' : String(v))
      .toLowerCase()
      .trim()
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ');

    // Resolve critical indices
    const semIdx = (() => {
      return headers.findIndex(h => {
        const n = norm(h);
        const candidates = [
          'sem','semester','sem no','semester no','sem number','semester number','semno','semesterno',
          'exam','exam name','exam title'
        ];
        return candidates.includes(n) || n.startsWith('sem');
      });
    })();
    const mapIdx = (() => {
      const candidates = ['mapno', 'map number', 'map_number', 'map num', 'map no'];
      return headers.findIndex(h => candidates.includes(norm(h)));
    })();
    const resultIdx = (() => {
      return headers.findIndex(h => {
        const n = norm(h);
        return n === 'result' || n === 'result status' || n === 'status' || n.includes('result');
      });
    })();
    const backlogIdx = (() => {
      const candidates = ['curr bck','curr_bck','current bck','current backlog','backlog','backlogs','no of backlogs','no backlogs','bck','bck curr','current_bck','backlog current'];
      return headers.findIndex(h => candidates.includes(norm(h)));
    })();

    if (semIdx === -1 || mapIdx === -1 || resultIdx === -1) {
      return processedData || data;
    }

    // Determine the semester set for the selected year (pairs per academic year)
    let targetSems: number[] = [];
    if (selectedYear === '1') targetSems = [1, 2];
    else if (selectedYear === '2') targetSems = [3, 4];
    else if (selectedYear === '3') targetSems = [5, 6];
    else if (selectedYear === '4') targetSems = [7, 8];
    const requiredSems = new Set<number>(targetSems);

    // Group by student
    const byStudent: Record<string, Array<any[]>> = {};
    const dataToFilter = processedData || data;
    for (const row of dataToFilter) {
      const key = String(row[mapIdx] ?? '').trim();
      if (!key) continue;
      (byStudent[key] ||= []).push(row);
    }

    const qualifies = new Set<string>();

    const parseSem = (v: any): number | null => {
      const s = String(v ?? '').toLowerCase();
      const m = s.match(/\d+/);
      if (!m) return null;
      const n = parseInt(m[0], 10);
      if (n >= 1 && n <= 8) return n;
      return null;
    };

    const isPass = (v: any): boolean => {
      const s = String(v ?? '').toLowerCase().trim();
      return s === 'pass' || s === 'p' || s === '1';
    };

    const backlogVal = (v: any): number => {
      if (v === null || v === undefined || String(v).trim() === '') return 0;
      const n = parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };

    for (const [stud, rows] of Object.entries(byStudent)) {
      const present: Record<number, boolean> = {};
      const ok: Record<number, boolean> = {};
      for (const row of rows) {
        const semNum = parseSem(row[semIdx]);
        if (!semNum || !requiredSems.has(semNum)) continue;
        present[semNum] = true;
        const pass = isPass(row[resultIdx]);
        const b = backlogIdx !== -1 ? backlogVal(row[backlogIdx]) : 0;
        const rowOk = pass && b === 0;
        if (ok[semNum] === undefined) ok[semNum] = true;
        // Any failing row for the sem disqualifies that sem
        if (!rowOk) ok[semNum] = false;
      }
      // Qualification rules per year (relax):
      // Ated for all years least one target semester present AND all present target semesters are clean (pass, 0 backlogs)
      let allGood = true;
      const anyPresent = targetSems.some(s => !!present[s]);
      const noneBad = targetSems.every(s => ok[s] !== false);
      allGood = anyPresent && noneBad;
      if (allGood) qualifies.add(stud);
    }

    // Filter data to qualifying students and target semesters only
    const filtered = dataToFilter.filter(row => {
      const key = String(row[mapIdx] ?? '').trim();
      if (!qualifies.has(key)) return false;
      const semNum = parseSem(row[semIdx]);
      return !!semNum && requiredSems.has(semNum);
    });

    return filtered;
  }, [data, processedData, headers, selectedYear]);

  // Calculate statistics for a column
  const getStatistics = (columnIndex: number, columnName: string): AnalysisData | null => {
    if (columnIndex === -1) return null;

    // Use filtered data if year is selected, otherwise use processedData or data
    const dataToUse = selectedYear && selectedYear !== 'all' ? filterDataByYear : (processedData || data);

    const values = dataToUse
      .map(row => parseFloat(row[columnIndex]))
      .filter(val => !isNaN(val));
      
    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Sort for median calculation
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;

    return { 
      metric: columnName,
      average: Number(avg.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      median: Number(median.toFixed(2)),
      count: values.length
    };
  };

  // Calculate student pass/fail statistics
  const getPassFailStats = () => {
    const resultIndex = getColumnIndex('result');
    if (resultIndex === -1) return null;

    let passed = 0;
    let failed = 0;

    // Use processedData if available, otherwise use data
    const dataToUse = processedData || data;

    dataToUse.forEach(row => {
      const result = String(row[resultIndex] || '').toLowerCase();
      if (result.includes('pass') || result === 'p' || result === '1') {
        passed++;
      } else if (result.includes('fail') || result === 'f' || result === '0') {
        failed++;
      }
    });

    const total = passed + failed;
    const passPercentage = total > 0 ? (passed / total) * 100 : 0;

    return {
      passed,
      failed,
      total,
      passPercentage: Number(passPercentage.toFixed(2))
    };
  };

  // Get subject statistics with CPI
  const getSubjectStats = useMemo(() => {
    interface SubjectData {
      subjectCode: string;
      subjectName: string;
      appeared: number;
      grades: number[];
    }

    const subjectData: Record<string, SubjectData> = {};
    const cpiIndex = getColumnIndex('cpi');
    
    // Find subject columns (assuming they follow a pattern like 'subject_code', 'subject_name')
    const subjectColumns = headers.filter(h => 
      (h.toLowerCase().includes('subject') || 
       h.toLowerCase().includes('sub_code') ||
       h.toLowerCase().includes('sub_name')) &&
      !h.toLowerCase().includes('grade') // Exclude grade columns
    );

    // Process each row of data
    // Use processedData if available, otherwise use data
    const dataToUse = processedData || data;

    dataToUse.forEach(row => {
      const cpi = parseFloat(row[cpiIndex]) || 0;
      
      // Process each subject column
      subjectColumns.forEach(col => {
        const subjectCode = row[getColumnIndex(col)];
        if (!subjectCode) return;
        
        // Initialize subject if not exists
        if (!subjectData[subjectCode]) {
          subjectData[subjectCode] = {
            subjectCode,
            subjectName: headers[getColumnIndex(col)].replace('_code', '').replace('_name', '').replace('_', ' '),
            appeared: 0,
            grades: []
          };
        }
        
        // Count appearance and collect CPI
        subjectData[subjectCode].appeared++;
        subjectData[subjectCode].grades.push(cpi);
      });
    });
    
    // Convert to final format with calculations
    const subjectStats: SubjectStats[] = Object.values(subjectData).map(subject => {
      let averageCPI = 0;
      let passRatio = 0;
      
      if (subject.grades.length > 0) {
        const sum = subject.grades.reduce((a, b) => a + b, 0);
        averageCPI = parseFloat((sum / subject.grades.length).toFixed(2));
        
        // Calculate pass ratio (assuming CPI >= 5.0 is passing)
        const passed = subject.grades.filter(cpi => cpi >= 5.0).length;
        passRatio = parseFloat((passed / subject.grades.length * 100).toFixed(2));
      }
      
      return {
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        appeared: subject.appeared,
        passRatio,
        averageCPI
      };
    });
    
    return subjectStats;
  }, [data, processedData, headers, getColumnIndex]);

  // Get statistics for each metric
  const analysisData = useMemo(() => {
    const stats = [
      getStatistics(getColumnIndex('spi'), 'SPI'),
      getStatistics(getColumnIndex('cpi'), 'CPI'),
      getStatistics(getColumnIndex('cgpa'), 'CGPA')
    ].filter(Boolean) as AnalysisData[];

    const passFailStats = getPassFailStats();

    return {
      metrics: stats,
      passFail: passFailStats
    };
  }, [data, processedData, headers]);

  // Export analysis to Excel
  const exportAnalysisToExcel = () => {
    // Prepare data for export
    const exportData = [
      ['Metric', 'Average', 'Min', 'Max', 'Median', 'Count'],
      ...analysisData.metrics.map(stat => [
        stat.metric,
        stat.average,
        stat.min,
        stat.max,
        stat.median,
        stat.count
      ]),
      [], // Empty row
      ['Pass/Fail Statistics', '', '', '', '', ''],
      ['Total Students', analysisData.passFail?.total || 0, '', '', '', ''],
      ['Passed', analysisData.passFail?.passed || 0, '', '', '', ''],
      ['Failed', analysisData.passFail?.failed || 0, '', '', '', ''],
      ['Pass Percentage', analysisData.passFail?.passPercentage || 0, '', '', '', ''],

    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Set column widths
    const wscols = [
      { wch: 20 }, // Metric
      { wch: 12 }, // Average
      { wch: 10 }, // Min
      { wch: 10 }, // Max
      { wch: 12 }, // Median
      { wch: 10 }  // Count
    ];
    ws['!cols'] = wscols;

    // Create workbook and add the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analysis');

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, 'performance_analysis.xlsx');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <div className="flex items-center">
          <button
            onClick={exportAnalysisToExcel}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-full shadow-sm bg-[#16A34A] text-white hover:bg-green-700 transition-colors"
            title="Export to Excel"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </button>
        </div>
      </div>
      
      {/* Metrics Table */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-700 mb-2">Performance Metrics</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Median</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analysisData.metrics.map((stat) => (
                <tr key={stat.metric}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.metric}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.average}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.min}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.max}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.median}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pass/Fail Statistics */}
      {analysisData.passFail && (
        <div>
          <h3 className="text-md font-medium text-gray-700 mb-2">Pass/Fail Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Total Students</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{analysisData.passFail.total}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Passed</p>
              <p className="mt-1 text-3xl font-bold text-green-600">{analysisData.passFail.passed}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Failed</p>
              <p className="mt-1 text-3xl font-bold text-red-600">{analysisData.passFail.failed}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Pass Percentage</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{analysisData.passFail.passPercentage}%</p>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default SimplifiedAnalysisPanel;
