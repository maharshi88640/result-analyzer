import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { ArrowUpDown, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excelExporter';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface SubjectStats {
  subject: string;
  passed: number;
  failed: number;
  total: number;
  passPercentage: number;
  averageMarks: number;
  minMarks: number;
  maxMarks: number;
}

interface BranchAnalysisProps {
  data: any[][];
  processedData?: any[][];
  headers: string[];
  selectedBranch?: string | null;
}

export const BranchAnalysis: React.FC<BranchAnalysisProps> = ({ data, processedData, headers, selectedBranch }) => {
  const [isExportingBranchGraph, setIsExportingBranchGraph] = useState(false);
  const [isExportingSubjectGraph, setIsExportingSubjectGraph] = useState(false);

  // Identify subject columns (columns that look like subject codes, e.g., 101, 102, etc.)
  const subjectColumns = useMemo(() => {
    return headers.filter((header, index) => {
      // Subject columns are typically numeric codes (3-4 digits)
      return /^\d{3,4}$/.test(header.trim()) && 
             // Make sure it's not a student ID or other numeric field
             !['id', 'roll', 'enroll'].some(term => 
                headers[0]?.toLowerCase().includes(term)
             );
    });
  }, [headers]);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter data by selected branch (or use all data if no branch selected)
  const filteredData = useMemo(() => {
    const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');

    // Use processedData if available, otherwise use data
    const dataToUse = processedData || data;

    // If no branch is selected (All Branches), return all data
    if (!selectedBranch) return dataToUse;

    // Filter by selected branch
    if (brNameIndex === -1) return [];
    return dataToUse.filter(row =>
      row[brNameIndex]?.toString().toLowerCase() === selectedBranch.toLowerCase()
    );
  }, [data, processedData, headers, selectedBranch]);
  // Get subject-wise statistics
  const subjectStats = useMemo(() => {
    if (!subjectColumns.length) return [];
    
    const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');
    if (resultIndex === -1) return [];

    return subjectColumns.map(subject => {
      const subjectIndex = headers.indexOf(subject);
      if (subjectIndex === -1) return null;

      let passed = 0;
      let failed = 0;
      let totalMarks = 0;
      let count = 0;
      let minMarks = 100; // Assuming max marks are 100
      let maxMarks = 0;

      filteredData.forEach(row => {
        const marks = parseFloat(row[subjectIndex]);
        if (!isNaN(marks)) {
          totalMarks += marks;
          count++;
          minMarks = Math.min(minMarks, marks);
          maxMarks = Math.max(maxMarks, marks);
          
          // Check if student passed this subject
          const result = row[resultIndex]?.toString().toUpperCase();
          if (result.includes('PASS') || result === 'P') {
            passed++;
          } else if (result.includes('FAIL') || result === 'F') {
            failed++;
          }
        }
      });

      const total = passed + failed;
      return {
        subject,
        passed,
        failed,
        total,
        passPercentage: total > 0 ? Math.round((passed / total) * 100) : 0,
        averageMarks: count > 0 ? parseFloat((totalMarks / count).toFixed(2)) : 0,
        minMarks: count > 0 ? minMarks : 0,
        maxMarks: count > 0 ? maxMarks : 0
      };
    }).filter(Boolean) as SubjectStats[];
  }, [filteredData, headers, subjectColumns]);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Calculate branch-wise statistics
  const branchStats = useMemo(() => {
    const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
    const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');

    ({
      selectedBranch,
      brNameIndex,
      resultIndex,
      headers,
      dataLength: data.length,
      processedDataLength: processedData?.length
    });

    if (brNameIndex === -1 || resultIndex === -1) {
   
      return [];
    }

    const dataToUse = processedData || data;
    const branchMap = new Map<string, { total: number; passed: number; failed: number }>();

    dataToUse.forEach((row, index) => {
      const branch = String(row[brNameIndex] || '').trim();
      const result = String(row[resultIndex] || '').toLowerCase();

      console.log(`Row ${index}: branch="${branch}", result="${result}"`);

      if (!branch) return;

      // If selectedBranch is set, only include that branch
      if (selectedBranch && branch.toLowerCase() !== selectedBranch.toLowerCase()) return;

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

    const result = Array.from(branchMap.entries())
      .map(([branch, stats]) => ({
        branch,
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        passPercentage: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0
      }))
      .sort((a, b) => a.branch.localeCompare(b.branch));

  
    return result;
  }, [data, processedData, headers, selectedBranch]);

  // Sort branch stats
  const sortedBranchStats = useMemo(() => {
    if (!sortColumn) return branchStats;

    return [...branchStats].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortColumn) {
        case 'branch':
          aVal = a.branch;
          bVal = b.branch;
          break;
        case 'total':
          aVal = a.total;
          bVal = b.total;
          break;
        case 'passed':
          aVal = a.passed;
          bVal = b.passed;
          break;
        case 'failed':
          aVal = a.failed;
          bVal = b.failed;
          break;
        case 'passPercentage':
          aVal = a.passPercentage;
          bVal = b.passPercentage;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [branchStats, sortColumn, sortDirection]);

  // Calculate overall statistics for single branch view
  const totalStudents = filteredData.length;
  const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');

  let passedStudents = 0;
  let failedStudents = 0;

  if (resultIndex !== -1) {
    filteredData.forEach(row => {
      const result = String(row[resultIndex] || '').toLowerCase();
      if (result.includes('pass') || result === 'p') {
        passedStudents++;
      } else if (result.includes('fail') || result === 'f') {
        failedStudents++;
      }
    });
  }

  const passPercentage = totalStudents > 0 ? (passedStudents / totalStudents) * 100 : 0;

  // Prepare data for the pass percentage chart
  const chartData = subjectStats.map(stat => ({
    subject: stat.subject,
    passPercentage: stat.passPercentage,
    avgMarks: stat.averageMarks
  }));

  // Helper function to shorten branch names with uniqueness
  const shortenBranchName = (name: string, allBranches: string[]): string => {
    if (name.length <= 10) return name;
    // Create acronym from first letter of each word
    const words = name.split(/\s+/);
    let acronym = words.map(word => word.charAt(0).toUpperCase()).join('');

    // Check if this acronym conflicts with others
    const conflicts = allBranches.filter(branch =>
      branch !== name && shortenBranchName(branch, []) === acronym
    );

    if (conflicts.length > 0) {
      // If conflict, use first 2 letters of first word + first letter of second word (if exists)
      if (words.length > 1) {
        acronym = words[0].substring(0, 2).toUpperCase() + words[1].charAt(0).toUpperCase();
      } else {
        // Single word - use first 3 letters
        acronym = name.substring(0, 3).toUpperCase();
      }
    }

    return acronym.length > 10 ? acronym.substring(0, 10) + '...' : acronym;
  };

  // Export branch analysis to Excel
  const exportBranchAnalysisToExcel = () => {
    const exportData = [];

    if (!selectedBranch) {
      // All Branches View
      exportData.push(['Branch-wise Summary']);
      exportData.push(['Branch', 'Total Students', 'Passed', 'Failed', 'Pass Percentage']);
      sortedBranchStats.forEach(stat => {
        exportData.push([stat.branch, stat.total, stat.passed, stat.failed, `${stat.passPercentage}%`]);
      });
      exportData.push([]); // Empty row
    } else {
      // Single Branch View
      exportData.push([`Branch Analysis: ${selectedBranch}`]);
      exportData.push(['Metric', 'Value']);
      exportData.push(['Total Students', totalStudents]);
      exportData.push(['Passed', passedStudents]);
      exportData.push(['Failed', failedStudents]);
      exportData.push(['Pass Percentage', `${passPercentage.toFixed(2)}%`]);
      exportData.push([]); // Empty row
    }

    // Subject-wise Analysis
    if (subjectStats.length > 0) {
      exportData.push(['Subject-wise Analysis']);
      exportData.push(['Subject', 'Average Marks', 'Min Marks', 'Max Marks', 'Pass %', 'Passed', 'Failed']);
      subjectStats.forEach(stat => {
        exportData.push([
          stat.subject,
          stat.averageMarks.toFixed(2),
          stat.minMarks,
          stat.maxMarks,
          `${stat.passPercentage}%`,
          stat.passed,
          stat.failed
        ]);
      });
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Set column widths
    const wscols = [
      { wch: 15 }, // Subject/Branch
      { wch: 15 }, // Values
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 }
    ];
    ws['!cols'] = wscols;

    // Create workbook and add the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Branch Analysis');

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, `branch_analysis_${selectedBranch || 'all_branches'}.xlsx`);
  };

  // Export branch graph as image
  const exportBranchGraphAsImage = async () => {
    setIsExportingBranchGraph(true);
    try {
      const graphElement = document.getElementById('branch-pass-fail-graph');
      if (graphElement) {
        const canvas = await html2canvas(graphElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        const link = document.createElement('a');
        link.download = `branch_pass_fail_analysis_${selectedBranch || 'all_branches'}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (error) {
      console.error('Error exporting branch graph:', error);
      alert('Error exporting branch graph. Please try again.');
    } finally {
      setIsExportingBranchGraph(false);
    }
  };

  // Export subject graph as image
  const exportSubjectGraphAsImage = async () => {
    setIsExportingSubjectGraph(true);
    try {
      const graphElement = document.getElementById('subject-pass-percentage-graph');
      if (graphElement) {
        const canvas = await html2canvas(graphElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        const link = document.createElement('a');
        link.download = `subject_pass_percentage_${selectedBranch || 'all_branches'}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (error) {
      console.error('Error exporting subject graph:', error);
      alert('Error exporting subject graph. Please try again.');
    } finally {
      setIsExportingSubjectGraph(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">
          Branch Analysis: {selectedBranch || 'All Branches'}
        </h2>
        <button
          onClick={exportBranchAnalysisToExcel}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          title="Export Branch Analysis to Excel"
        >
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </button>
      </div>

      {!selectedBranch ? (
        /* All Branches View */
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4">Branch-wise Summary</h3>

          {/* Branch Pass/Fail Graph */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-md font-medium">Branch Pass/Fail Analysis</h4>
              <button
                onClick={exportBranchGraphAsImage}
                disabled={isExportingBranchGraph}
                className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3 w-3 mr-1" />
                {isExportingBranchGraph ? 'Exporting...' : 'Export Image'}
              </button>
            </div>
            <div className="h-80" id="branch-pass-fail-graph">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  margin={{top:20}}
                  data={sortedBranchStats.map(stat => ({
                  branch: shortenBranchName(stat.branch, sortedBranchStats.map(s => s.branch)),
                  fullBranch: stat.branch,
                  passRate: stat.passPercentage,
                  failRate: 100 - stat.passPercentage
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branch" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      const fullName = payload?.[0]?.payload?.fullBranch || label;
                      return `${label} (${fullName})`;
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  />
                  <Legend />
                  <Bar dataKey="passRate" fill="#10B981" name="Pass Rate">
                    <LabelList dataKey="passRate" position="top" offset={10} formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
                  </Bar>
                  <Bar dataKey="failRate" fill="#EF4444" name="Fail Rate">
                    <LabelList dataKey="failRate" position="top" offset={10} formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort('branch')}
                      className="flex items-center space-x-1 hover:text-blue-600"
                    >
                      <span>Branch</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleSort('total')}
                      className="flex items-center justify-center space-x-1 hover:text-blue-600"
                    >
                      <span>Total Students</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleSort('passed')}
                      className="flex items-center justify-center space-x-1 hover:text-blue-600"
                    >
                      <span>Passed</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleSort('failed')}
                      className="flex items-center justify-center space-x-1 hover:text-blue-600"
                    >
                      <span>Failed</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleSort('passPercentage')}
                      className="flex items-center justify-center space-x-1 hover:text-blue-600"
                    >
                      <span>Pass Percentage</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedBranchStats.map((stat, index) => (
                  <tr key={stat.branch} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 border-b font-medium">{stat.branch}</td>
                    <td className="px-4 py-2 border-b text-center">{stat.total}</td>
                    <td className="px-4 py-2 border-b text-center text-green-600 font-medium">{stat.passed}</td>
                    <td className="px-4 py-2 border-b text-center text-red-600 font-medium">{stat.failed}</td>
                    <td className="px-4 py-2 border-b text-center font-bold">{stat.passPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Single Branch View */
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4">Branch Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-blue-700">{totalStudents}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Passed</p>
              <p className="text-2xl font-bold text-green-700">{passedStudents}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-700">{failedStudents}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Pass Percentage</p>
              <p className="text-2xl font-bold text-purple-700">{passPercentage.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Subject-wise Analysis */}
      {subjectStats.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4">Subject-wise Analysis</h3>
          
          {/* Pass Percentage Chart */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-md font-medium">Subject-wise Pass Percentage</h4>
              <button
                onClick={exportSubjectGraphAsImage}
                disabled={isExportingSubjectGraph}
                className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3 w-3 mr-1" />
                {isExportingSubjectGraph ? 'Exporting...' : 'Export Image'}
              </button>
            </div>
            <div className="h-80" id="subject-pass-percentage-graph">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value, name) => 
                      name === 'passPercentage' 
                        ? [`${value}%`, 'Pass %'] 
                        : [value, 'Avg. Marks']
                    }
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="passPercentage" fill="#8884d8" name="Pass %">
                    <LabelList dataKey="passPercentage" position="top" formatter={(value: any) => typeof value === 'number' ? `${value}%` : value} />
                  </Bar>
                  <Bar yAxisId="right" dataKey="avgMarks" fill="#82ca9d" name="Avg. Marks">
                    <LabelList dataKey="avgMarks" position="top" formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(1)}` : value} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Detailed Subject Statistics */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-center">Avg. Marks</th>
                  <th className="px-4 py-2 text-center">Min</th>
                  <th className="px-4 py-2 text-center">Max</th>
                  <th className="px-4 py-2 text-center">Pass %</th>
                  <th className="px-4 py-2 text-center">Passed/Failed</th>
                </tr>
              </thead>
              <tbody>
                {subjectStats.map((stat, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 border-b">{stat.subject}</td>
                    <td className="px-4 py-2 border-b text-center">{stat.averageMarks.toFixed(2)}</td>
                    <td className="px-4 py-2 border-b text-center">{stat.minMarks}</td>
                    <td className="px-4 py-2 border-b text-center">{stat.maxMarks}</td>
                    <td className="px-4 py-2 border-b text-center">{stat.passPercentage}%</td>
                    <td className="px-4 py-2 border-b text-center">
                      <span className="text-green-600">{stat.passed}</span> / 
                      <span className="text-red-600">{stat.failed}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
