import React from 'react';
import { Sheet, ChevronDown } from 'lucide-react';
import { WorksheetData } from '../types/excel';

interface SheetSelectorProps {
  sheets: WorksheetData[];
  selectedSheet: string;
  onSheetSelect: (sheetName: string) => void;
}

export const SheetSelector: React.FC<SheetSelectorProps> = ({
  sheets,
  selectedSheet,
  onSheetSelect,
}) => {

  const getCombinedFiles = (sheet: WorksheetData): string[] => {
    if (!sheet || !sheet.headers || !sheet.data) return [];
    
    // First try to find 'exam' column in the first row
    const examIdx = sheet.headers.findIndex(h => (h || '').toString().toLowerCase() === 'exam');
    if (examIdx !== -1 && sheet.data.length > 0) {
      const firstRow = sheet.data[0];
      const examValue = firstRow?.[examIdx];
      if (examValue !== undefined && examValue !== null && String(examValue).trim()) {
        return [String(examValue).trim()];
      }
    }
    
    // Fallback to source_file if exam column not found or empty
    const sourceIdx = sheet.headers.findIndex(h => (h || '').toString().toLowerCase() === 'source_file');
    if (sourceIdx === -1) return [];
    const set = new Set<string>();
    sheet.data.forEach(row => {
      const v = row?.[sourceIdx];
      if (v !== undefined && v !== null) {
        const name = String(v).trim();
        if (name) set.add(name);
      }
    });
    return Array.from(set);
  };

  const combinedSheet = sheets.find((s) => (s.name || '').toLowerCase() === 'combined');
  const combinedFiles = combinedSheet ? getCombinedFiles(combinedSheet) : [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <Sheet className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold text-gray-800">{combinedSheet ? 'Selected Files' : 'Select Worksheet'}</h2>
      </div>

      {combinedSheet ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {combinedFiles.map((fname) => (
            <div key={fname} className="px-3 py-2 rounded border bg-gray-50 text-sm text-gray-800 truncate" title={fname}>
              {fname}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sheets.map((sheet) => (
            <button
              key={sheet.name}
              onClick={() => onSheetSelect(sheet.name)}
              className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                selectedSheet === sheet.name
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-gray-200 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-800">{sheet.name}</h3>
                  <p className="text-sm text-gray-500">
                    {sheet.data.length} rows × {sheet.headers.length} columns
                  </p>
                </div>
                {selectedSheet === sheet.name && (
                  <div className="bg-primary text-white rounded-full p-1">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};