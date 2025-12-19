import * as XLSX from 'xlsx';
import { ExcelFile, WorksheetData } from '../types/excel';

// Supported Excel MIME types and extensions
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
];

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.xla', '.xlam', '.xltx', '.xltm', '.xlt'];

// Helper function to validate file type and size
const validateExcelFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  const fileName = file.name.toLowerCase();
  const isValidType = EXCEL_MIME_TYPES.includes(file.type) || 
                     EXCEL_EXTENSIONS.some(ext => fileName.endsWith(ext));
  
  if (!isValidType) {
    return {
      valid: false,
      error: 'Please upload a valid Excel file (.xlsx, .xls, .xlsm, .xlsb)'
    };
  }

  // Check file size (100MB max)
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds the maximum limit of 100MB'
    };
  }

  return { valid: true };
};

// Process worksheet data with error handling
const processWorksheet = (worksheet: XLSX.WorkSheet): { headers: string[]; data: any[][] } | null => {
  if (!worksheet || !worksheet['!ref']) return null;

  try {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: true
    }) as any[][];

    if (!jsonData || jsonData.length === 0) return null;

    // Process headers
    const headers = (jsonData[0] || []).map(header =>
      header !== null && header !== undefined ? String(header).trim() : ''
    );

    // Process data rows - handle numeric conversion properly
    const data = jsonData.slice(1).map(row =>
      Array.isArray(row)
        ? row.map((cell, index) => {
            if (cell === null || cell === undefined || cell === '') return '';

            // Check if this column should be numeric (map_number, spi, cpi, cgpa, etc.)
            const header = headers[index]?.toLowerCase() || '';
            const isNumericColumn = header.includes('map') ||
                                   header === 'spi' ||
                                   header === 'cpi' ||
                                   header === 'cgpa' ||
                                   /^\d+$/.test(header); // Subject codes

            if (isNumericColumn && typeof cell === 'number') {
              // If it's already a number from raw parsing, keep it as number
              return cell;
            } else if (isNumericColumn && typeof cell === 'string') {
              // Try to parse string as number
              const numValue = Number(cell);
              if (!isNaN(numValue) && isFinite(numValue)) {
                return numValue;
              }
            }

            // Default to string for other columns or failed conversions
            return String(cell).trim();
          })
        : []
    );

    return { headers, data };
  } catch (error) {
    console.error('Error processing worksheet:', error);
    return null;
  }
};

export const parseExcelFile = (file: File): Promise<ExcelFile> => {
  return new Promise((resolve, reject) => {
    // Validate file first
    const validation = validateExcelFile(file);
    if (!validation.valid) {
      reject(new Error(validation.error));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file: No data received');
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        let workbook: XLSX.WorkBook | undefined;
        
        // Try different parsing options
        const readOptions = [
          { type: 'array' as const, cellDates: true, cellNF: false },
          { type: 'array' as const, cellDates: true, cellNF: true },
          { type: 'array' as const, cellText: false, cellNF: false },
          { type: 'buffer' as const, cellDates: true },
          { type: 'binary' as const, cellDates: true }
        ];
        
        // Try each set of options until one works
        for (const options of readOptions) {
          try {
            workbook = XLSX.read(data, { ...options, dense: true });
            if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
              break;
            }
          } catch (err) {
            console.debug(`Parsing with options failed, trying next...`, { options, error: err });
          }
        }

        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Could not parse the Excel file. Please ensure it is not corrupted or password protected.');
        }
        
        // Process all sheets
        const sheets: WorksheetData[] = [];
        
        for (const sheetName of workbook.SheetNames) {
          try {
            const worksheet = workbook?.Sheets[sheetName];
            if (!worksheet) continue;
            
            const result = processWorksheet(worksheet);
            if (!result) continue;
            
            sheets.push({
              name: sheetName,
              headers: result.headers,
              data: result.data
            });
          } catch (error) {
            console.warn(`Skipping sheet '${sheetName}' due to error:`, error);
          }
        }

        if (sheets.length === 0) {
          throw new Error('No valid worksheets found in the Excel file.');
        }

        resolve({
          name: file.name,
          lastModified: file.lastModified,
          size: file.size,
          sheets
        });

      } catch (error) {
        console.error('Error parsing Excel file:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while parsing the Excel file';
        reject(new Error(errorMessage));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file. The file might be corrupted or in use by another program.'));
    };

    try {
      // Try reading as ArrayBuffer first, fallback to binary string if needed
      if (typeof reader.readAsArrayBuffer === 'function') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      reject(new Error('Failed to read file. It may be corrupted or in an unsupported format.'));
    }
  });
};