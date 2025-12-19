import React, { useState, useMemo } from 'react';
import { SimplifiedAnalysisPanel } from './SimplifiedAnalysisPanel';

interface AnalysisDashboardProps {
  data: any[][];
  processedData: any[][];
  headers: string[];
  selectedBranch: string | null;
  onSelectedBranchChange: (branch: string | null) => void;
  query: any;
  selectedSubject: string;
  onSelectedSubjectChange: (subject: string) => void;
  includedSources?: string[];
  currentView: string;
  onViewChange: (view: string) => void;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  data,
  processedData,
  headers,
  selectedBranch,
  onSelectedBranchChange,
  query,
  selectedSubject,
  onSelectedSubjectChange,
  includedSources,
  currentView,
  onViewChange,
}) => {
  const [analysisView, setAnalysisView] = useState<string>('summary');

  const handleViewChange = (view: string) => {
    setAnalysisView(view);
    onViewChange(view);
  };

  // Calculate basic statistics for the dashboard
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalStudents: 0,
        passedStudents: 0,
        failedStudents: 0,
        passPercentage: 0,
      };
    }

    const totalStudents = data.length;
    let passedStudents = 0;
    let failedStudents = 0;

    // Look for result column
    const resultIndex = headers.findIndex(h => 
      h.toLowerCase().includes('result') || 
      h.toLowerCase().includes('status')
    );

    if (resultIndex !== -1) {
      data.forEach(row => {
        const result = String(row[resultIndex] || '').toLowerCase();
        if (result.includes('pass') || result === 'p' || result.includes('success')) {
          passedStudents++;
        } else if (result.includes('fail') || result === 'f' || result.includes('failed')) {
          failedStudents++;
        }
      });
    }

    const passPercentage = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;

    return {
      totalStudents,
      passedStudents,
      failedStudents,
      passPercentage,
    };
  }, [data, headers]);

  return (
    <div className="space-y-6">
      {/* Dashboard Header with Stats */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Analysis</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">Total Students</h3>
            <p className="text-2xl font-bold text-blue-900">{stats.totalStudents}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800">Passed</h3>
            <p className="text-2xl font-bold text-green-900">
              {stats.passedStudents} <span className="text-sm">({stats.passPercentage}%)</span>
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-semibold text-red-800">Failed</h3>
            <p className="text-2xl font-bold text-red-900">
              {stats.failedStudents} <span className="text-sm">({100 - stats.passPercentage}%)</span>
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800">Current View</h3>
            <p className="text-lg font-bold text-purple-900 capitalize">
              {currentView.replace('-', ' ')}
            </p>
          </div>
        </div>
      </div>


      {/* Analysis Panel with Navigation */}
      <SimplifiedAnalysisPanel
        title="Analysis Dashboard"
        data={data}
        processedData={processedData}
        headers={headers}
        selectedBranch={selectedBranch}
        currentView={currentView}
        onViewChange={handleViewChange}
      />
    </div>
  );
};

export default AnalysisDashboard;
