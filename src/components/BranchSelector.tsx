
import React, { useState, useMemo } from 'react';
import { Users, ChevronDown, ChevronRight, CheckCircle, Building2 } from 'lucide-react';

interface BranchSelectorProps {
  selectedBranch: string | null;
  onBranchChange: (branch: string | null) => void;
  availableBranches?: string[];
  data?: any[][];
  headers?: string[];
  label?: string;
}


export const BranchSelector: React.FC<BranchSelectorProps> = ({
  selectedBranch,
  onBranchChange,
  availableBranches,
  data,
  headers,
  label = "Filter by Branch"
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract available branches from data if not provided
  const extractedBranches = useMemo(() => {
    if (availableBranches && availableBranches.length > 0) {
      return availableBranches;
    }
    
    if (!data || !headers || data.length === 0) {
      return [];
    }
    
    // Find branch-related columns
    const branchHeaderCandidates = [
      'branch', 'dept', 'department', 'discipline', 'program', 'course'
    ];
    
    const branchIndices = headers.map((header, index) => {
      if (!header) return -1;
      const normalizedHeader = header.toString().toLowerCase().trim();
      const matches = branchHeaderCandidates.some(candidate => 
        normalizedHeader.includes(candidate) || normalizedHeader === candidate
      );
      return matches ? index : -1;
    }).filter(index => index !== -1);
    
    if (branchIndices.length === 0) {
      return [];
    }
    
    // Extract unique branch values from all branch columns
    const branches = new Set<string>();
    data.forEach(row => {
      branchIndices.forEach(colIndex => {
        const value = row[colIndex];
        if (value && typeof value === 'string' && value.trim()) {
          branches.add(value.trim());
        } else if (value && typeof value !== 'string') {
          branches.add(String(value).trim());
        }
      });
    });
    
    return Array.from(branches).sort();
  }, [availableBranches, data, headers]);


  const branchOptions = [
    { value: '', label: 'All Branches', description: 'Show all branches', icon: '🌐' },
    ...extractedBranches.map((branch, index) => ({
      value: branch,
      label: branch,
      description: `Filter for ${branch}`,
      icon: index % 4 === 0 ? '🏛️' : index % 4 === 1 ? '💻' : index % 4 === 2 ? '⚙️' : '🔬'
    }))
  ];

  const selectedOption = branchOptions.find(option => option.value === selectedBranch);


  // Don't render if no branches are available
  if (extractedBranches.length === 0 && !availableBranches) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-gray-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-600">{label}</h3>
              <p className="text-sm text-gray-500">No branch information found in the data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      {/* Collapsible Header */}
      <div 
        className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100 cursor-pointer hover:from-purple-100 hover:to-indigo-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{label}</h3>
              {selectedBranch && (
                <p className="text-sm text-primary font-medium">
                  Filtering for {selectedBranch} - Students Only
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {selectedBranch && (
              <div className="flex items-center space-x-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                <span>Branch Filter Active</span>
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
          {/* Branch Filter Notice */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <h4 className="font-semibold text-blue-800 mb-2">🎯 Branch Filtering Active</h4>
                <div className="text-blue-700 space-y-1">
                  <p>When you select a specific branch, only students from that branch will be shown.</p>
                  <p><strong>Criteria:</strong> Student must belong to the selected branch to be included in results.</p>
                  <div className="mt-2 p-2 bg-blue-100 rounded text-xs">
                    <strong>Examples:</strong><br />
                    • Computer Science: Shows only CS students<br />
                    • Mechanical Engineering: Shows only ME students<br />
                    • All Branches: Shows students from all branches
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Branch Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {branchOptions.map((option) => {
              const isSelected = selectedBranch === option.value;
              return (
                <button
                  key={option.value || 'all'}
                  onClick={() => onBranchChange(option.value || null)}
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
          {selectedBranch && (
            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-sm text-purple-800">
                  <h4 className="font-semibold mb-2">🔍 Active Branch Filter</h4>
                  <div className="space-y-1">
                    <p><strong>Selected:</strong> {selectedOption?.label} ({selectedOption?.description})</p>
                    <p><strong>Scope:</strong> Students who belong to the selected branch</p>
                    <p><strong>Effect:</strong> Data table and all analysis panels will show only students from this branch</p>
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

