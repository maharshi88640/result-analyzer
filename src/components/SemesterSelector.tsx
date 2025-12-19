
import React, { useMemo, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';


interface SemesterSelectorProps {
  data: any[][];
  headers: string[];
  selectedSemesters: string[];
  onSemestersChange: (semesters: string[]) => void;
  selectedYear?: 'all' | '1' | '2' | '3' | '4';
  label?: string;
}


export const SemesterSelector: React.FC<SemesterSelectorProps> = ({
  data,
  headers,
  selectedSemesters,
  onSemestersChange,
  selectedYear,
  label = "Filter by Semester"
}) => {
  // Find semester column index with comprehensive matching
  const findSemesterColumnIndex = (headers: string[]): number => {
    const semesterHeaderCandidates = [
      'sem', 'semester', 'sem no', 'semester no', 'sem number', 'semester number', 
      'semno', 'semesterno', 'semester_number'
    ];
    
    return headers.findIndex(header => {
      if (!header) return false;
      const normalizedHeader = header.toString().toLowerCase().trim();
      return semesterHeaderCandidates.includes(normalizedHeader) || 
             normalizedHeader.startsWith('sem') ||
             normalizedHeader.includes('semester');
    });
  };


  // Extract and normalize semester values
  const uniqueSemesters = useMemo(() => {
    if (!data || !headers || data.length === 0) return [];
    
    const semIndex = findSemesterColumnIndex(headers);
    if (semIndex === -1) return [];

    const semesterSet = new Set<string>();
    
    data.forEach(row => {
      if (row && row[semIndex] !== null && row[semIndex] !== undefined) {
        const semValue = row[semIndex].toString().trim();
        if (semValue) {
          // Extract numeric part and normalize semester format
          const numericMatch = semValue.match(/\d+/);
          if (numericMatch) {
            const semesterNum = parseInt(numericMatch[0], 10);
            semesterSet.add(`Semester ${semesterNum}`);
          } else {
            // Keep non-numeric values as is
            semesterSet.add(semValue);
          }
        }
      }
    });

    // Filter semesters based on selected year
    let semesters = Array.from(semesterSet);
    
    if (selectedYear && selectedYear !== 'all') {
      // Define target semesters for each year
      const yearToSemesters: Record<string, number[]> = {
        '1': [1, 2],
        '2': [3, 4],
        '3': [5, 6],
        '4': [7, 8]
      };
      
      const targetSems = yearToSemesters[selectedYear] || [];
      semesters = semesters.filter(sem => {
        const numMatch = sem.match(/\d+/);
        if (numMatch) {
          const semNum = parseInt(numMatch[0], 10);
          return targetSems.includes(semNum);
        }
        return false;
      });
    }

    // Sort semesters numerically when possible
    return semesters.sort((a, b) => {
      const aNum = a.match(/\d+/);
      const bNum = b.match(/\d+/);
      if (aNum && bNum) {
        return parseInt(aNum[0], 10) - parseInt(bNum[0], 10);
      }
      return a.localeCompare(b);
    });

  }, [data, headers, selectedYear]);

  // Clear selected semesters when year changes (if year is not 'all')
  useEffect(() => {
    if (selectedYear && selectedYear !== 'all') {
      onSemestersChange([]);
    }
  }, [selectedYear, onSemestersChange]);

  const handleSemesterToggle = (semester: string) => {
    const isSelected = selectedSemesters.includes(semester);
    if (isSelected) {
      onSemestersChange(selectedSemesters.filter(s => s !== semester));
    } else {
      onSemestersChange([...selectedSemesters, semester]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSemesters.length === uniqueSemesters.length) {
      onSemestersChange([]);
    } else {
      onSemestersChange([...uniqueSemesters]);
    }
  };

  if (uniqueSemesters.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-500">{label}</h3>
        </div>
        <p className="text-xs text-gray-400">No semester data found in the current dataset</p>
      </div>
    );
  }


  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-slate-700">{label}</h3>
          {selectedYear && selectedYear !== 'all' && (
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Filtered: {selectedYear} Year (Sem {selectedYear === '1' ? '1-2' : selectedYear === '2' ? '3-4' : selectedYear === '3' ? '5-6' : '7-8'})
            </span>
          )}
        </div>
        {uniqueSemesters.length > 1 && (
          <button
            onClick={handleSelectAll}
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            {selectedSemesters.length === uniqueSemesters.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {uniqueSemesters.map((semester) => {
          const isSelected = selectedSemesters.includes(semester);
          return (
            <button
              key={semester}
              onClick={() => handleSemesterToggle(semester)}
              className={`px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                isSelected
                  ? 'border-primary bg-primary text-white shadow-md'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{semester}</span>
                {isSelected && (
                  <div className="ml-2 w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>


      {uniqueSemesters.length === 0 && selectedYear && selectedYear !== 'all' && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-yellow-600" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">
                No semesters available for {selectedYear} Year
              </h4>
              <p className="text-xs text-yellow-700 mt-1">
                The current dataset doesn't contain data for semesters {selectedYear === '1' ? '1-2' : selectedYear === '2' ? '3-4' : selectedYear === '3' ? '5-6' : '7-8'}.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedSemesters.length > 0 && (
        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
          <h4 className="text-xs font-medium text-gray-700 mb-2">
            Active Filters ({selectedSemesters.length} selected)
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedSemesters.map((semester) => (
              <span
                key={semester}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white border border-primary/20"
              >
                {semester}
                <button
                  onClick={() => handleSemesterToggle(semester)}
                  className="ml-2 hover:text-primary/80 text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
