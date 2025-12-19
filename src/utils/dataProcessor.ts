
import { FilterConfig, QueryConfig } from '../types/excel';

// Enhanced data type detection
const detectDataType = (value: any): 'number' | 'date' | 'boolean' | 'string' => {
  if (value === null || value === undefined || value === '') return 'string';
  
  // Check for boolean
  if (typeof value === 'boolean' || 
      (typeof value === 'string' && ['true', 'false', 'yes', 'no'].includes(value.toLowerCase()))) {
    return 'boolean';
  }
  
  // Check for number
  const numValue = Number(value);
  if (!isNaN(numValue) && isFinite(numValue)) {
    return 'number';
  }
  
  // Check for date
  const dateValue = new Date(value);
  if (!isNaN(dateValue.getTime()) && typeof value === 'string' && value.match(/\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/)) {
    return 'date';
  }
  
  return 'string';
};

// Enhanced comparison function
const compareValues = (cellValue: any, filterValue: any, operator: string): boolean => {
  const cellType = detectDataType(cellValue);
  const filterType = detectDataType(filterValue);
  
  // Handle null/undefined/empty values
  if (cellValue === null || cellValue === undefined || cellValue === '') {
    return operator === 'not_equals' ? filterValue !== '' : false;
  }
  
  switch (operator) {
    case 'equals':
      if (cellType === 'number' && filterType === 'number') {
        return Number(cellValue) === Number(filterValue);
      }
      return cellValue?.toString().toLowerCase() === filterValue.toString().toLowerCase();
      
    case 'contains':
      return cellValue?.toString().toLowerCase().includes(filterValue.toString().toLowerCase());
      
    case 'greater':
      if (cellType === 'number' && filterType === 'number') {
        return Number(cellValue) > Number(filterValue);
      }
      if (cellType === 'date' && filterType === 'date') {
        return new Date(cellValue) > new Date(filterValue);
      }
      return cellValue?.toString().localeCompare(filterValue.toString()) > 0;
      
    case 'less':
      if (cellType === 'number' && filterType === 'number') {
        return Number(cellValue) < Number(filterValue);
      }
      if (cellType === 'date' && filterType === 'date') {
        return new Date(cellValue) < new Date(filterValue);
      }
      return cellValue?.toString().localeCompare(filterValue.toString()) < 0;
      
    case 'not_equals':
      if (cellType === 'number' && filterType === 'number') {
        return Number(cellValue) !== Number(filterValue);
      }
      return cellValue?.toString().toLowerCase() !== filterValue.toString().toLowerCase();
      
    default:
      return true;
  }
};

// Timeout wrapper for long-running operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);

};


// Standardized function to find mapno column index
export const findMapNoColumnIndex = (headers: string[]): number => {
  const mapCandidates = [
    'mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number',
    'map_number', 'mapnumber', 'mapno', 'map no', 'mapno.', 'map no.'
  ];
  
  return headers.findIndex(header => {
    const lowerHeader = (header || '').toString().toLowerCase().trim();
    return mapCandidates.includes(lowerHeader);
  });
};



// Standardized function to find name column index
export const findNameColumnIndex = (headers: string[]): number => {
  const nameCandidates = [
    'name', 'student name', 'student_name', 'studentname',
    'student_name', 'studentname', 'name', 'student', 'student_name', 'full name', 'maono'
  ];
  
  return headers.findIndex(header => {
    const lowerHeader = (header || '').toString().toLowerCase().trim();
    return nameCandidates.includes(lowerHeader);
  });
};



// Standardized function to check if a filter is a search filter
export const isSearchFilter = (filter: any): boolean => {
  const lowerColumn = filter.column.toLowerCase();
  const searchColumns = [
    'mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 
    'mapno.', 'map no.',
    'name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'
  ];
  return searchColumns.includes(lowerColumn) && String(filter.value ?? '').trim() !== '';
};

// Standardized function to check if query has search filters
export const hasSearchFilter = (query?: QueryConfig): boolean => {
  if (!query?.filters) return false;
  return query.filters.some(filter => isSearchFilter(filter));
};

export const processData = (
  data: any[][],
  headers: string[],
  query: QueryConfig
): any[][] => {
  try {
    // Add performance monitoring for large datasets
    const estimatedSize = JSON.stringify(data).length;
    if (estimatedSize > 10 * 1024 * 1024) {
      console.log(`Processing large dataset (${(estimatedSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    let processedData = [...data];

  // Apply search filter
  if (query.searchTerm) {
    const searchTerm = query.searchTerm.toLowerCase();
    processedData = processedData.filter(row =>
      row.some(cell =>
        cell?.toString().toLowerCase().includes(searchTerm) ||
        // Enhanced search: also search in formatted numbers and dates
        (detectDataType(cell) === 'number' && Number(cell).toString().includes(searchTerm)) ||
        (detectDataType(cell) === 'date' && new Date(cell).toLocaleDateString().toLowerCase().includes(searchTerm))
      )
    );
  }

  // Apply column filters
  query.filters.forEach(filter => {
    if (filter.column && filter.value !== '') {
      const columnIndex = headers.indexOf(filter.column);
      if (columnIndex !== -1) {
        processedData = processedData.filter(row => {
          const cellValue = row[columnIndex];
          return compareValues(cellValue, filter.value, filter.operator);
        });
      }
    }
  });

  // Apply sorting
  if (query.sortColumn) {
    const columnIndex = headers.indexOf(query.sortColumn);
    if (columnIndex !== -1) {
      processedData.sort((a, b) => {
        const aValue = a[columnIndex];
        const bValue = b[columnIndex];
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined || aValue === '') {
          if (bValue === null || bValue === undefined || bValue === '') return 0;
          return query.sortDirection === 'desc' ? 1 : -1;
        }
        if (bValue === null || bValue === undefined || bValue === '') {
          return query.sortDirection === 'desc' ? -1 : 1;
        }
        
        const aType = detectDataType(aValue);
        const bType = detectDataType(bValue);
        
        // Compare by detected type
        if (aType === 'number' && bType === 'number') {
          const aNum = Number(aValue);
          const bNum = Number(bValue);
          return query.sortDirection === 'desc' ? bNum - aNum : aNum - bNum;
        }
        
        if (aType === 'date' && bType === 'date') {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          return query.sortDirection === 'desc' ? bDate.getTime() - aDate.getTime() : aDate.getTime() - bDate.getTime();
        }
        
        if (aType === 'boolean' && bType === 'boolean') {
          const aBool = aValue.toString().toLowerCase() === 'true' || aValue.toString().toLowerCase() === 'yes';
          const bBool = bValue.toString().toLowerCase() === 'true' || bValue.toString().toLowerCase() === 'yes';
          if (aBool === bBool) return 0;
          return query.sortDirection === 'desc' ? (bBool ? 1 : -1) : (aBool ? 1 : -1);
        }
        
        // Compare as strings
        const aStr = aValue?.toString() || '';
        const bStr = bValue?.toString() || '';
        
        if (query.sortDirection === 'desc') {
          return bStr.localeCompare(aStr);
        } else {
          return aStr.localeCompare(bStr);
        }
      });
    }
  }


  return processedData;
} catch (error) {
    console.error('Error processing data:', error);
    return [];
  }
};

// Enhanced statistics with better data type handling
export const getDataStatistics = (data: any[][], headers: string[]) => {
  const stats = {
    totalRows: data.length,
    totalColumns: headers.length,
    columnStats: headers.map((header, index) => {
      const columnData = data.map(row => row[index]).filter(val => val !== null && val !== undefined && val !== '');
      const numericData = columnData.map(val => Number(val)).filter(val => !isNaN(val));
      const dateData = columnData.filter(val => detectDataType(val) === 'date');
      const booleanData = columnData.filter(val => detectDataType(val) === 'boolean');

      return {
        name: header,
        totalValues: columnData.length,
        emptyValues: data.length - columnData.length,
        numericValues: numericData.length,
        dateValues: dateData.length,
        booleanValues: booleanData.length,
        textValues: columnData.length - numericData.length - dateData.length - booleanData.length,
        min: numericData.length > 0 ? Math.min(...numericData) : null,
        max: numericData.length > 0 ? Math.max(...numericData) : null,
        average: numericData.length > 0 ? numericData.reduce((a, b) => a + b, 0) / numericData.length : null,
        uniqueValues: new Set(columnData.map(val => val?.toString().toLowerCase())).size,
      };
    }),
  };

  return stats;
};

// New function to get unique values per column as strings without duplicates
export const getUniqueValuesPerColumn = (data: any[][], headers: string[]): Record<string, string[]> => {
  const uniqueValuesMap: Record<string, Set<string>> = {};

  headers.forEach(header => {
    uniqueValuesMap[header] = new Set<string>();
  });

  data.forEach(row => {
    row.forEach((cell, index) => {
      const header = headers[index];
      if (header) {
        const cellStr = cell !== null && cell !== undefined ? cell.toString() : '';
        if (cellStr !== '') {
          uniqueValuesMap[header].add(cellStr);
        }
      }
    });
  });

  const result: Record<string, string[]> = {};
  Object.keys(uniqueValuesMap).forEach(header => {
    result[header] = Array.from(uniqueValuesMap[header]).sort();
  });

  return result;
};

// Export function for processed data
export const exportToCSV = (data: any[][], headers: string[], filename: string = 'exported_data.csv') => {
  const csvContent = [
    headers.join(','),
    ...data.map(row => row.map(cell => {
      const cellStr = cell?.toString() || '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Advanced filtering function for complex queries
export const applyAdvancedFilter = (
  data: any[][],
  headers: string[],
  conditions: { column: string; operator: string; value: any; logicalOperator?: 'AND' | 'OR' }[]
): any[][] => {
  if (conditions.length === 0) return data;

  return data.filter(row => {
    let result = true;
    let currentLogical = 'AND';

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const columnIndex = headers.indexOf(condition.column);

      if (columnIndex === -1) continue;

      const cellValue = row[columnIndex];
      const conditionResult = compareValues(cellValue, condition.value, condition.operator);

      if (i === 0) {
        result = conditionResult;
      } else {
        if (currentLogical === 'AND') {
          result = result && conditionResult;
        } else {
          result = result || conditionResult;
        }
      }

      currentLogical = condition.logicalOperator || 'AND';
    }

    return result;
  });
};
