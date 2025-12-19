import React, { useState } from 'react';
import { Filter, Search, Badge } from 'lucide-react';
import { FilterConfig, QueryConfig } from '../types/excel';

interface QueryBuilderProps {
  headers: string[];
  data: any[][];
  onQueryChange: (query: QueryConfig) => void;
  query: QueryConfig;
  selectedBranch?: string | null;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  headers,
  data,
  onQueryChange,
  query,
}) => {

  const searchFields = [
    { key: 'name', label: 'Student Name', placeholder: 'Search by student name...' },
    { key: 'map_number', label: 'Map Number', placeholder: 'Search by map number...' },
  ];


  // State for search field suggestions
  const [searchFieldValues, setSearchFieldValues] = useState<{ [key: string]: string }>({});
  const [searchFieldSuggestions, setSearchFieldSuggestions] = useState<{ [key: string]: string[] }>({});
  const [showSearchFieldSuggestions, setShowSearchFieldSuggestions] = useState<{ [key: string]: boolean }>({});

  const [skipFilterSet, setSkipFilterSet] = useState(false);



  // Get unique values for a search field from data
  const getUniqueValuesForSearchField = (fieldKey: string): string[] => {
    let colIndex: number;
    
    if (fieldKey === 'name') {

      // Look for name column with various possible names
      const nameCandidates = [
        'name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'
      ];
      colIndex = headers.findIndex(h =>
        nameCandidates.includes(h.toLowerCase().trim())
      );
    } else if (fieldKey === 'map_number') {
      // Look for MAP number column with various possible names
      const mapCandidates = [
        'mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'
      ];
      colIndex = headers.findIndex(h =>
        mapCandidates.includes(h.toLowerCase().trim())
      );
    } else {
      colIndex = headers.indexOf(fieldKey);
    }
    
    if (colIndex === -1) {
      console.log(`Column not found for field: ${fieldKey}, available headers:`, headers);
      return [];
    }

    const valuesSet = new Set<string>();
    data.forEach(row => {
      const value = row[colIndex];
      if (value !== null && value !== undefined && String(value).trim()) {
        valuesSet.add(String(value).trim());
      }
    });

    return Array.from(valuesSet).sort();
  };


  const handleSearchFieldChange = (fieldKey: string, value: string) => {
    if (skipFilterSet) {
      setSkipFilterSet(false);
      return;
    }

    setSearchFieldValues(prev => ({ ...prev, [fieldKey]: value }));

    if (value.trim() === '') {
      setSearchFieldSuggestions(prev => ({ ...prev, [fieldKey]: [] }));
      setShowSearchFieldSuggestions(prev => ({ ...prev, [fieldKey]: false }));


      // Remove the filter for this field
      const updatedFilters = query.filters.filter(filter => {
        if (fieldKey === 'name') {
          const nameAliases = ['name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'];
          return !nameAliases.includes(filter.column.toLowerCase());
        } else if (fieldKey === 'map_number') {
          const mapAliases = ['mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'];
          return !mapAliases.includes(filter.column.toLowerCase());
        } else {
          return filter.column !== fieldKey;
        }
      });
      onQueryChange({ ...query, filters: updatedFilters });
    } else {
      const allValues = getUniqueValuesForSearchField(fieldKey);
      const filteredSuggestions = allValues.filter(val =>
        val.toLowerCase().includes(value.toLowerCase())
      );
      setSearchFieldSuggestions(prev => ({ ...prev, [fieldKey]: filteredSuggestions }));
      setShowSearchFieldSuggestions(prev => ({ ...prev, [fieldKey]: true }));



      // Find the actual column name
      let columnName = fieldKey;
      if (fieldKey === 'name') {
        const nameCandidates = [
          'name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'
        ];
        const colIndex = headers.findIndex(h =>
          nameCandidates.includes(h.toLowerCase().trim())
        );
        if (colIndex !== -1) {
          columnName = headers[colIndex];
        }
      } else if (fieldKey === 'map_number') {
        const mapCandidates = [
          'mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'
        ];
        const colIndex = headers.findIndex(h =>
          mapCandidates.includes(h.toLowerCase().trim())
        );
        if (colIndex !== -1) {
          columnName = headers[colIndex];
        }
      }

      // Remove all other filters and add only this one
      const newFilter: FilterConfig = { column: columnName, operator: 'contains', value: value.trim() };
      onQueryChange({ ...query, filters: [newFilter] });
    }
  };


  const handleSearchFieldSuggestionClick = (fieldKey: string, value: string) => {
    setSkipFilterSet(true);
    setSearchFieldValues(prev => ({ ...prev, [fieldKey]: value }));
    setShowSearchFieldSuggestions(prev => ({ ...prev, [fieldKey]: false }));


    // Find the actual column name
    let columnName = fieldKey;
    if (fieldKey === 'name') {
      const nameCandidates = [
        'name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'
      ];
      const colIndex = headers.findIndex(h =>
        nameCandidates.includes(h.toLowerCase().trim())
      );
      if (colIndex !== -1) {
        columnName = headers[colIndex];
      }
    } else if (fieldKey === 'map_number') {
      const mapCandidates = [
        'mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'
      ];
      const colIndex = headers.findIndex(h =>
        mapCandidates.includes(h.toLowerCase().trim())
      );
      if (colIndex !== -1) {
        columnName = headers[colIndex];
      }
    }

    // Update filter, clearing all others
    const newFilter: FilterConfig = { column: columnName, operator: 'contains', value };
    onQueryChange({ ...query, filters: [newFilter] });
  };

  const handleSearchFieldBlur = (fieldKey: string) => {
    setTimeout(() => {
      setShowSearchFieldSuggestions(prev => ({ ...prev, [fieldKey]: false }));
    }, 150);
  };

  return (
    <div className="bg-gray-50 rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-slate-700">Search</h2>
        </div>
      </div>

      {/* Search Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {searchFields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-xs uppercase tracking-wide text-gray-500">
              {field.label}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                {field.key === 'map_number' ? (
                  <Badge className="h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </span>
              <input
                type="text"
                value={searchFieldValues[field.key] || ''}
                placeholder={field.placeholder}
                className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                onChange={(e) => handleSearchFieldChange(field.key, e.target.value)}
                onBlur={() => handleSearchFieldBlur(field.key)}
                onFocus={() => {
                  const allValues = getUniqueValuesForSearchField(field.key);
                  const currentValue = searchFieldValues[field.key] || '';
                  const filteredSuggestions = currentValue.trim()
                    ? allValues.filter(val => val.toLowerCase().includes(currentValue.toLowerCase()))
                    : allValues; // Show all suggestions when field is focused and empty
                  setSearchFieldSuggestions(prev => ({ ...prev, [field.key]: filteredSuggestions }));
                  setShowSearchFieldSuggestions(prev => ({ ...prev, [field.key]: true }));
                }}
              />
              {showSearchFieldSuggestions[field.key] && searchFieldSuggestions[field.key] && searchFieldSuggestions[field.key].length > 0 && (
                <ul className="absolute z-20 w-full max-h-40 overflow-auto bg-white border border-gray-200 rounded-lg mt-1 shadow-lg">
                  {searchFieldSuggestions[field.key].slice(0, 10).map((suggestion) => (
                    <li
                      key={suggestion}
                      onMouseDown={() => handleSearchFieldSuggestionClick(field.key, suggestion)}
                      className="px-3 py-2 cursor-pointer hover:bg-primary/10 text-sm"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active Filters Summary */}
      {query.filters.length > 0 && (
        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
          <h4 className="text-xs font-medium text-text mb-2">Active Filters</h4>
          <div className="flex flex-wrap gap-2">
            {query.filters.map((filter, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
              >
                {filter.column} {filter.operator} "{String(filter.value)}"
                <button
                  onClick={() => {
                    const updated = query.filters.filter(f => f.column !== filter.column);
                    onQueryChange({ ...query, filters: updated });


                    const nameAliases = ['name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'];
                    if (nameAliases.includes(filter.column.toLowerCase())) {
                      setSearchFieldValues(prev => ({ ...prev, name: '' }));
                    }

                    const mapAliases = ['mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'];
                    if (mapAliases.includes(filter.column.toLowerCase())) {
                      setSearchFieldValues(prev => ({ ...prev, map_number: '' }));
                    }
                  }}
                  className="ml-2 hover:text-primary/80"
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
