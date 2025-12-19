import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface StudentDetailsProps {
  studentData: any[];
  headers: string[];
  onBack: () => void;
}

export const StudentDetails: React.FC<StudentDetailsProps> = ({
  studentData,
  headers,
  onBack
}) => {
  const getFieldDisplayName = (header: string): string => {
    const normalized = header.toLowerCase().replace(/[._-]+/g, ' ').trim();
    
    // Handle common field name variations
    const fieldMap: Record<string, string> = {
      'name': 'Student Name',
      'student name': 'Student Name',
      'mapno': 'MAP Number',
      'map number': 'MAP Number',
      'map_number': 'MAP Number',
      'map num': 'MAP Number',
      'map no': 'MAP Number',
      'br_name': 'Branch',
      'branch': 'Branch',
      'branch name': 'Branch',
      'br name': 'Branch',
      'sem': 'Semester',
      'semester': 'Semester',
      'sem no': 'Semester',
      'semester no': 'Semester',
      'sem number': 'Semester',
      'semester number': 'Semester',
      'spi': 'SPI',
      'cpi': 'CPI',
      'cgpa': 'CGPA',
      'result': 'Result',
      'result status': 'Result Status',
      'curr bck': 'Current Backlog',
      'curr_bck': 'Current Backlog',
      'current bck': 'Current Backlog',
      'current backlog': 'Current Backlog',
      'backlog': 'Current Backlog',
      'backlogs': 'Current Backlog',
      'no of backlogs': 'Current Backlog',
      'no backlogs': 'Current Backlog',
      'bck': 'Current Backlog',
      'bck curr': 'Current Backlog',
      'current_bck': 'Current Backlog',
      'backlog current': 'Current Backlog'
    };

    return fieldMap[normalized] || header.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const getFieldValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    
    // Format numbers with appropriate decimal places
    if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) {
      const numValue = parseFloat(value);
      return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(2);
    }
    
    return String(value).trim() || 'N/A';
  };

  // Group data by student for better display
  const studentGroups: Record<string, any[]> = {};
  studentData.forEach(row => {
    const studentName = String(row[headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'student name')] || '').trim();
    if (studentName) {
      if (!studentGroups[studentName]) {
        studentGroups[studentName] = [];
      }
      studentGroups[studentName].push(row);
    }
  });

  const getPrimaryStudentInfo = () => {
    if (Object.keys(studentGroups).length === 0 && studentData.length > 0) {
      // If no grouping by name, use first row as primary info
      return studentData[0];
    }
    
    // Get the first student group
    const firstStudent = Object.keys(studentGroups)[0];
    return studentGroups[firstStudent]?.[0] || studentData[0];
  };

  const primaryInfo = getPrimaryStudentInfo();
  const studentName = getFieldValue(primaryInfo[headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'student name')]);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            title="Back to Data Table"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Student Details</h2>
            <p className="text-sm text-gray-600">{studentName}</p>
          </div>
        </div>
      </div>

      {/* Student Information */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {headers.map((header, index) => {
            const value = getFieldValue(primaryInfo[index]);
            const displayName = getFieldDisplayName(header);
            
            return (
              <div key={header} className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">{displayName}</h3>
                <p className="text-lg font-semibold text-gray-900 break-words">{value}</p>
              </div>
            );
          })}
        </div>

        {/* Academic Records (if multiple records per student) */}
        {Object.keys(studentGroups).length > 1 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Records</h3>
            <div className="space-y-4">
              {Object.entries(studentGroups).map(([name, records]) => (
                <div key={name} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3">{name}</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {headers.map((header) => (
                            <th
                              key={header}
                              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {getFieldDisplayName(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {records.map((record, recordIndex) => (
                          <tr key={recordIndex}>
                            {headers.map((header, colIndex) => (
                              <td key={header} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {getFieldValue(record[colIndex])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetails;
