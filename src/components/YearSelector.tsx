import React, { useState } from 'react';
import { Calendar, Users, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';

interface YearSelectorProps {
  selectedYear: 'all' | '1' | '2' | '3' | '4';
  onYearChange: (year: 'all' | '1' | '2' | '3' | '4') => void;
  label?: string;
}

export const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  onYearChange,
  label = "Filter by Academic Year"
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const yearOptions = [
    { value: 'all', label: 'All Years', description: 'Show all semesters', icon: '🌐' },
    { value: '1', label: '1st Year', description: 'Semesters 1 & 2', icon: '1️⃣' },
    { value: '2', label: '2nd Year', description: 'Semesters 3 & 4', icon: '2️⃣' },
    { value: '3', label: '3rd Year', description: 'Semesters 5 & 6', icon: '3️⃣' },
    { value: '4', label: '4th Year', description: 'Semesters 7 & 8', icon: '4️⃣' }
  ];

  const selectedOption = yearOptions.find(y => y.value === selectedYear);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      {/* Collapsible Header */}
      <div 
        className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{label}</h3>
              {selectedYear !== 'all' && (
                <p className="text-sm text-primary font-medium">
                  Filtering for {selectedOption?.label} - Passed Students Only
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {selectedYear !== 'all' && (
              <div className="flex items-center space-x-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                <span>Pass Filter Active</span>
              </div>
            )}
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-6">
          {/* Pass/Fail Filter Notice */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <h4 className="font-semibold text-amber-800 mb-2">🎯 Pass/Fail Filtering Active</h4>
                <div className="text-amber-700 space-y-1">
                  <p>When you select a specific year, only students who have not failed in that year's semesters will be shown.</p>
                  <p><strong>Criteria:</strong> Student must have passed (result = 'Pass') with 0 backlogs in at least one semester of the selected year.</p>
                  <div className="mt-2 p-2 bg-amber-100 rounded text-xs">
                    <strong>Examples:</strong><br />
                    • 1st Year: Shows students who passed sem 1 OR sem 2 with 0 backlogs<br />
                    • 2nd Year: Shows students who passed sem 3 OR sem 4 with 0 backlogs
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Year Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {yearOptions.map((option) => {
              const isSelected = selectedYear === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onYearChange(option.value as 'all' | '1' | '2' | '3' | '4')}
                  className={`px-4 py-4 rounded-lg border-2 transition-all duration-200 text-left relative ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-lg transform scale-105'
                      : 'border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-700 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg mb-1">{option.icon}</div>
                      <div className="font-semibold text-sm">{option.label}</div>
                      <div className={`text-xs mt-1 ${isSelected ? 'text-primary-100' : 'text-gray-500'}`}>
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Filter Summary */}
          {selectedYear !== 'all' && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-sm text-blue-800">
                  <h4 className="font-semibold mb-2">🔍 Active Year Filter</h4>
                  <div className="space-y-1">
                    <p><strong>Selected:</strong> {selectedOption?.label} ({selectedOption?.description})</p>
                    <p><strong>Scope:</strong> Students who have passed with 0 backlogs in at least one semester of this year</p>
                    <p><strong>Effect:</strong> Data table and all analysis panels will show only qualifying students</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

