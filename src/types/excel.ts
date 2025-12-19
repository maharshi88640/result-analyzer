export interface WorksheetData {
  name: string;
  data: any[][];
  headers: string[];
}

export interface ExcelFile {
  name: string;
  lastModified: number;
  size: number;
  sheets: WorksheetData[];
  selectedSheet?: string;
}

export interface FilterConfig {
  column: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'not_equals';
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

export interface QueryConfig {
  filters: FilterConfig[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  searchTerm?: string;
}

export interface ColumnStats {
  name: string;
  totalValues: number;
  emptyValues: number;
  numericValues: number;
  dateValues: number;
  booleanValues: number;
  textValues: number;
  min: number | null;
  max: number | null;
  average: number | null;
  uniqueValues: number;
}