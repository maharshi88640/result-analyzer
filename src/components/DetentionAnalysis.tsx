import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Users, 
  TrendingUp, 
  FileText, 
  Filter,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { 
  analyzeDetentionData, 
  getDetainedStudentsList, 
  getAtRiskStudents,
  generateDetentionReport 
} from '../utils/detentionAnalyzer';
import { DetentionRecord, DetentionFilter } from '../types/detention';
import { GTU_DETENTION_RULES } from '../utils/detentionRules';

interface DetentionAnalysisProps {
  data: any[][];
  headers: string[];
  selectedBranch?: string | null;
  onDetentionStatusChange?: (status: string) => void;
}

interface TabData {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export const DetentionAnalysis: React.FC<DetentionAnalysisProps> = ({
  data,
  headers,
  selectedBranch,
  onDetentionStatusChange
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<DetentionFilter>({
    branch: selectedBranch || undefined
  });
  const [showFilters, setShowFilters] = useState(false);

  // Generate detention analysis
  const analysis = useMemo(() => {
    return analyzeDetentionData(data, headers, filters);
  }, [data, headers, filters]);

  // Get detained students list
  const detainedStudents = useMemo(() => {
    return getDetainedStudentsList(data, headers, filters);
  }, [data, headers, filters]);

  // Get at-risk students
  const atRiskStudents = useMemo(() => {
    return getAtRiskStudents(data, headers, filters);
  }, [data, headers, filters]);

  // Generate report
  const report = useMemo(() => {
    return generateDetentionReport(data, headers, filters);
  }, [data, headers, filters]);

  const handleFilterChange = (newFilters: Partial<DetentionFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExportReport = () => {
    const reportData = {
      title: report.title,
      generatedAt: report.generatedAt,
      summary: report.summary,
      filters: report.filters,
      totalDetained: detainedStudents.length,
      totalAtRisk: atRiskStudents.length
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detention-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDetentionStatusIcon = (status: string) => {
    switch (status) {
      case 'detained': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'at-risk': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'clear': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const tabs: TabData[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <TrendingUp className="h-4 w-4" />
    },
    {
      id: 'detained',
      label: 'Detained Students',
      icon: <AlertTriangle className="h-4 w-4" />,
      count: detainedStudents.length
    },
    {
      id: 'at-risk',
      label: 'At Risk Students',
      icon: <Clock className="h-4 w-4" />,
      count: atRiskStudents.length
    },
    {
      id: 'rules',
      label: 'GTU Rules',
      icon: <FileText className="h-4 w-4" />
    }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{analysis.totalStudents}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Detained Students</p>
              <p className="text-2xl font-bold text-red-600">{analysis.detainedStudents}</p>
              <p className="text-xs text-gray-500">{analysis.detentionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">At Risk Students</p>
              <p className="text-2xl font-bold text-yellow-600">{analysis.atRiskStudents}</p>
              <p className="text-xs text-gray-500">{analysis.riskRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Clear Students</p>
              <p className="text-2xl font-bold text-green-600">{analysis.clearStudents}</p>
              <p className="text-xs text-gray-500">
                {((analysis.clearStudents / analysis.totalStudents) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch-wise Detention */}
      {Object.keys(analysis.branchWiseDetention).length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Branch-wise Detention Analysis</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detained
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detention Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(analysis.branchWiseDetention).map(([branch, stats]) => (
                  <tr key={branch}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {branch}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stats.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {stats.detained}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-red-600 h-2 rounded-full" 
                            style={{ width: `${stats.rate}%` }}
                          ></div>
                        </div>
                        {stats.rate.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Semester-wise Detention */}
      {Object.keys(analysis.semesterWiseDetention).length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Semester-wise Detention Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(analysis.semesterWiseDetention).map(([semester, stats]) => (
              <div key={semester} className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Semester {semester}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Students:</span>
                    <span className="font-medium">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Detained:</span>
                    <span className="font-medium text-red-600">{stats.detained}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate:</span>
                    <span className="font-medium">{stats.rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDetainedStudents = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Detained Students ({detainedStudents.length})
        </h3>
        <button
          onClick={handleExportReport}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </button>
      </div>
      
      {detainedStudents.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">No detained students found with current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Semester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Backlog Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detention Reasons
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {detainedStudents.map((student, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.studentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.branch}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Semester {student.currentSemester}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {student.backlogCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="max-w-xs">
                      {student.detentionReasons.map((reason, idx) => (
                        <div key={idx} className="mb-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderAtRiskStudents = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        At Risk Students ({atRiskStudents.length})
      </h3>
      
      {atRiskStudents.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">No at-risk students found with current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Backlog Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Semester
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {atRiskStudents.map((student, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.studentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.branch}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(student.riskLevel)}`}>
                      {student.riskLevel.toUpperCase()} RISK
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                    {student.backlogCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Semester {student.currentSemester}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderGTURules = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">GTU Detention Rules (AY 2018-19 onwards)</h3>
        <p className="text-blue-800 text-sm">
          <strong>Key Principle:</strong> Detention happens when mandatory earlier-semester subjects are not cleared before entering the next semester, regardless of attendance.
        </p>
      </div>

      <div className="grid gap-4">
        {Object.values(GTU_DETENTION_RULES).map((rule) => (
          <div key={rule.targetSemester} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Semester {rule.targetSemester - 1} → Semester {rule.targetSemester}
                </h4>
                <p className="text-gray-700 mb-2">{rule.description}</p>
                <p className="text-sm text-gray-600">
                  <strong>Detention Rule:</strong> {rule.isDetainedIf}
                </p>
              </div>
              <div className="ml-4">
                {rule.requiredSemesters.length === 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    No Detention
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Detention Rule
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFilters = () => (
    <div className="bg-white p-4 rounded-lg shadow border">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
          <select
            value={filters.branch || ''}
            onChange={(e) => handleFilterChange({ branch: e.target.value || undefined })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Branches</option>
            {Object.keys(analysis.branchWiseDetention).map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level</label>
          <select
            value={filters.riskLevel || ''}
            onChange={(e) => handleFilterChange({ riskLevel: e.target.value as any || undefined })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Detention Status</label>
          <select
            value={filters.detentionStatus || ''}
            onChange={(e) => handleFilterChange({ detentionStatus: e.target.value as any || undefined })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="detained">Detained</option>
            <option value="at-risk">At Risk</option>
            <option value="clear">Clear</option>
          </select>
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setFilters({ branch: selectedBranch || undefined })}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Detention Analysis</h2>
          <p className="text-gray-600 mt-1">GTU-based detention analysis and student risk assessment</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-2 border rounded-md text-sm ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && renderFilters()}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-600 bg-blue-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'detained' && renderDetainedStudents()}
        {activeTab === 'at-risk' && renderAtRiskStudents()}
        {activeTab === 'rules' && renderGTURules()}
      </div>
    </div>
  );
};

export default DetentionAnalysis;
