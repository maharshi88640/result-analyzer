import React from 'react';
import { BranchSummaryTable } from './BranchSummaryTable';

interface AnalysisPanelProps {
  data: any[][];
  headers: string[];
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, headers }) => {
  // Calculate student statistics
  const totalStudents = data.length;
  const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');
  
  let passedStudents = 0;
  let failedStudents = 0;
  
  if (resultIndex !== -1) {
    data.forEach(row => {
      const result = String(row[resultIndex] || '').toLowerCase();
      if (result.includes('pass') || result === 'p') {
        passedStudents++;
      } else if (result.includes('fail') || result === 'f') {
        failedStudents++;
      }
    });
  }

  const passPercentage = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;
  const failPercentage = totalStudents > 0 ? 100 - passPercentage : 0;

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold mb-4">Analysis Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800">Total Students</h3>
          <p className="text-2xl font-bold">{totalStudents}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800">Passed</h3>
          <p className="text-2xl font-bold">
            {passedStudents} <span className="text-sm">({passPercentage}%)</span>
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="font-semibold text-red-800">Failed</h3>
          <p className="text-2xl font-bold">
            {failedStudents} <span className="text-sm">({failPercentage}%)</span>
          </p>
        </div>
      </div>

      {/* Branch-wise Analysis */}
      <div className="mb-6">
        <BranchSummaryTable data={data} headers={headers} />
      </div>
    </div>
  );
};

export default AnalysisPanel;
