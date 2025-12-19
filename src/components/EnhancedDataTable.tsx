
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ArrowUpDown, BarChart2, Filter, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { SimplifiedAnalysisPanel } from './SimplifiedAnalysisPanel';
import { BranchAnalysis } from './BranchAnalysis';
import SubjectAnalysis from './SubjectAnalysisClean';
import GradeRangeFilter from './GradeRangeFilter';
import { StudentDetails } from './StudentDetails';
import { QueryConfig } from '../types/excel';
import { exportToExcel } from '../utils/excelExporter';
import { exportToPDF } from '../utils/pdfExporter';

import { findMapNoColumnIndex, findNameColumnIndex, isSearchFilter, hasSearchFilter } from '../utils/dataProcessor';

interface EnhancedDataTableProps {
  headers: string[];
  data: any[][];
  processedData?: any[][];
  onDataChange: (newData: any[][]) => void;
  hints?: string[];
  query?: QueryConfig;
  selectedBranch?: string | null;
  onSelectedBranchChange?: (branch: string | null) => void;
  gradeRanges?: { spi: { min: number; max: number }; cpi: { min: number; max: number }; cgpa: { min: number; max: number } };
  onGradeRangesChange?: (ranges: { spi: { min: number; max: number }; cpi: { min: number; max: number }; cgpa: { min: number; max: number } }) => void;
  selectedSubject?: string;
  onSelectedSubjectChange?: (subject: string) => void;
  loadedTick?: number;
  includedSources?: string[];
  yearSelected?: 'all' | '1' | '2' | '3' | '4';
}

// Helper function to find column index with flexible matching
const findColumnIndexByName = (headers: string[], targetNames: string[]): number => {
  return headers.findIndex(header => {
    const normalizedHeader = header.toLowerCase().trim();
    return targetNames.some(name => normalizedHeader === name);
  });
};

export const EnhancedDataTable: React.FC<EnhancedDataTableProps> = ({
  headers,
  data,
  processedData,
  query,
  selectedBranch: controlledBranch,
  onSelectedBranchChange,
  gradeRanges,
  onGradeRangesChange,
  selectedSubject,
  onSelectedSubjectChange,
  loadedTick,
  includedSources,
  yearSelected,

  }) => {

  const [internalSelectedBranch, setInternalSelectedBranch] = useState<string | null>(null);
  const selectedBranch = controlledBranch !== undefined ? controlledBranch : internalSelectedBranch;
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [analysisView, setAnalysisView] = useState<'summary' | 'branch' | 'subject'>('subject');

  const [gradeFilteredData, setGradeFilteredData] = useState<any[][]>([]);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [resetKey, setResetKey] = useState(0);
  const [selectedStudentData, setSelectedStudentData] = useState<any[] | null>(null);

  const defaultColumnOrder = ['map_number', 'name', 'br_name', 'spi', 'cpi', 'cgpa', 'result'];

  const norm = useCallback((v: any) => (v === null || v === undefined ? '' : String(v))
    .toLowerCase()
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' '), []);

  // Detect if this is a Combined view by presence of source_file (any variant)
  // This must be declared early since it's used in multiple useEffect hooks
  const isCombined = useMemo(() => {
    return headers.some(h => {
      const n = norm(h);
      return n === 'source file' || n === 'source_file' || (n.includes('source') && n.includes('file'));
    });
  }, [headers, norm]);

  const shouldShowAnalysis = useMemo(() => {
    return showAnalysis;
  }, [showAnalysis]);

  const showPanels = useMemo(() => {
    return true; // Always show analysis panels regardless of year selection
  }, []);
  const yearMode = useMemo(() => !!yearSelected && yearSelected !== 'all', [yearSelected]);

  const yearSemLabel = useMemo(() => {
    if (!yearMode) return '';
    const map: Record<'1'|'2'|'3'|'4', string> = { '1': 'Sem 1–2', '2': 'Sem 3–4', '3': 'Sem 5–6', '4': 'Sem 7–8' };
    return map[(yearSelected as '1'|'2'|'3'|'4')] || '';
  }, [yearMode, yearSelected]);

  // qualifiedCount computed after filteredData is defined further below



  // Update analysis view when branch selection changes - ensure subject view is shown
  // But don't auto-switch if we're in branch view (let user stay in branch view)
  useEffect(() => {
    if (selectedBranch && analysisView !== 'branch') {
      // When a branch is selected and not in branch view, ensure subject view is shown
      setAnalysisView('subject');
      setShowAnalysis(true);
    } else if (!selectedBranch && analysisView === 'subject') {
      // When branch is cleared and we're in subject view, switch to summary
      setAnalysisView('summary');
    }
  }, [selectedBranch, analysisView]);

  // Additional effect to ensure subject view when auto-selecting branch due to search
  useEffect(() => {
    if (selectedBranch && hasSearchFilter(query) && analysisView !== 'subject') {
      // When a branch is auto-selected due to search, ensure subject view is shown
      setAnalysisView('subject');
      setShowAnalysis(true);
    }
  }, [selectedBranch, query, analysisView]);

  // When a controlled branch/subject is provided (e.g., after loading a state),
  // ensure we show the subject view and the analysis panel is visible.
  useEffect(() => {
    if (controlledBranch || selectedSubject) {
      setShowAnalysis(true);
      setAnalysisView('subject');
    }
  }, [controlledBranch, selectedSubject]);

  // After parent finishes loading a state, force the view again to avoid timing issues
  useEffect(() => {
    if (!loadedTick) return;
    if (controlledBranch || selectedSubject) {
      setShowAnalysis(true);
      setAnalysisView('subject');
    }
  }, [loadedTick]);




  // Auto-select branch for name/map search and show subject-wise analysis
  // IMPORTANT: Do NOT auto-select in Combined view (we want the compact table, not subject columns).
  useEffect(() => {
    if (isCombined) return;
    if (controlledBranch !== undefined && controlledBranch !== null && controlledBranch !== '') return;
    
    const searchFilter = query?.filters?.find(filter => isSearchFilter(filter));
    if (!searchFilter || !searchFilter.value) return;
    

    // Find the search column (map number or name)
    const mapIndex = findMapNoColumnIndex(headers);
    const nameIndex = findNameColumnIndex(headers);
    

    // Determine which column to search based on filter type
    let searchColumnIndex = -1;
    const searchColumnLower = searchFilter.column.toLowerCase();
    
    // Use helper function to find the correct column
    const mapCandidates = ['mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'];
    const nameCandidates = ['name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'];
    
    if (mapCandidates.includes(searchColumnLower)) {
      searchColumnIndex = mapIndex;
    } else if (nameCandidates.includes(searchColumnLower)) {
      searchColumnIndex = nameIndex;
    } else {
      // Fallback: try to find by actual header names
      const actualMapIndex = findColumnIndexByName(headers, mapCandidates);
      const actualNameIndex = findColumnIndexByName(headers, nameCandidates);
      
      if (actualMapIndex !== -1) {
        searchColumnIndex = actualMapIndex;
      } else if (actualNameIndex !== -1) {
        searchColumnIndex = actualNameIndex;
      }
    }
    const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
    
    if (searchColumnIndex === -1 || brNameIndex === -1) return;
    
    const searchValue = String(searchFilter.value).toLowerCase().trim();
    
    // Find the matching student in the data
    const matchingStudent = data.find(row => {
      const cellValue = String(row[searchColumnIndex] || '').toLowerCase().trim();
      if (searchFilter.operator === 'contains') {
        return cellValue.includes(searchValue);
      } else {
        return cellValue === searchValue;
      }
    });
    
    if (matchingStudent) {
      const studentBranch = String(matchingStudent[brNameIndex] || '').trim();
      if (studentBranch && studentBranch !== selectedBranch) {
        // Auto-select the student's branch
        if (onSelectedBranchChange) {
          onSelectedBranchChange(studentBranch);
        } else {
          setInternalSelectedBranch(studentBranch);
        }
        

        // Clear any existing subject selection
        if (onSelectedSubjectChange) {
          onSelectedSubjectChange('');
        }
        


        // Switch to subject-wise analysis
        setAnalysisView('subject');
        setShowAnalysis(true);
      }
    }
  }, [query, data, headers, isCombined, controlledBranch, selectedBranch, onSelectedBranchChange, onSelectedSubjectChange]);




  useEffect(() => {
    if (!hasSearchFilter(query)) {
      if (controlledBranch === undefined) setInternalSelectedBranch(null);
      // Clear filters should reset to summary view
      setAnalysisView('summary');
      setShowAnalysis(true);
      setGradeFilteredData([]);
      setSortColumn(null);
      setSortDirection('asc');
      setResetKey(prev => prev + 1);
    }
  }, [query, controlledBranch, selectedSubject]);

  // Support multiple possible names for semester column
  const semesterHeaderCandidates = ['sem', 'semester', 'sem no', 'semester no', 'sem number', 'semester number', 'semno', 'semesterno'];

  // Build default columns dynamically; in Combined view show only requested columns
  const dynamicDefaultOrder = useMemo(() => {
    if (isCombined) {
      // Requested order: name, mapno, sem, branch, result, spi, cpi, cgpa, curr bck
      return ['name', 'map_number', 'sem', 'br_name', 'result', 'spi', 'cpi', 'cgpa', 'curr_bck'];
    }
    return defaultColumnOrder;
  }, [isCombined]);

  const [selectedColumns, setSelectedColumns] = useState<number[]>(() => {
    // Map each desired column name to actual header index, with special handling for semester
    const resolveIndex = (colName: string) => {
      const lower = norm(colName);
      if (lower === 'name') {
        const nameCandidates = ['name', 'student name'];
        return headers.findIndex(h => nameCandidates.includes(norm(h)));
      }
      if (lower === 'sem') {
        const idx = headers.findIndex(h => {
          const n = norm(h);
          return semesterHeaderCandidates.includes(n) || n.startsWith('sem');
        });
        return idx;
      }
      if (lower === 'map_number') {
        const mapCandidates = ['mapno', 'map number', 'map_number', 'map num', 'map no'];
        return headers.findIndex(h => mapCandidates.includes(norm(h)));
      }
      if (lower === 'br_name') {
        const brCandidates = ['br_name', 'branch', 'branch name', 'br name'];
        return headers.findIndex(h => brCandidates.includes(norm(h)));
      }
      if (lower === 'curr_bck') {
        const bckCandidates = ['curr bck','curr_bck','current bck','current backlog','backlog','bck','bck curr','current_bck'];
        return headers.findIndex(h => bckCandidates.includes(norm(h)));
      }
      if (lower === 'source_file') {
        const srcCandidates = ['source_file', 'source file'];
        return headers.findIndex(h => srcCandidates.includes(norm(h)));
      }
      return headers.findIndex(h => norm(h) === lower);
    };

    const defaultCols = dynamicDefaultOrder
      .map(resolveIndex)
      .filter(index => index !== -1);

    // If we have at least some defaults, use them. Otherwise, select all columns except student ID columns
    if (defaultCols.length > 0) {
      return defaultCols;
    }
    return headers
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => !['std_id', 'st_id', 'student_id'].includes((header || '').toString().toLowerCase()))
      .map(({ index }) => index);
  });

  // When headers change (e.g., switching to Combined sheet), recompute selected columns to include sem/source_file as needed
  useEffect(() => {
    const resolveIndex = (colName: string) => {
      const lower = norm(colName);
      if (lower === 'name') {
        const nameCandidates = ['name', 'student name'];
        return headers.findIndex(h => nameCandidates.includes(norm(h)));
      }
      if (lower === 'sem') {
        return headers.findIndex(h => {
          const n = norm(h);
          return semesterHeaderCandidates.includes(n) || n.startsWith('sem');
        });
      }
      if (lower === 'map_number') {
        const mapCandidates = ['mapno', 'map number', 'map_number', 'map num', 'map no'];
        return headers.findIndex(h => mapCandidates.includes(norm(h)));
      }
      if (lower === 'br_name') {
        const brCandidates = ['br_name', 'branch', 'branch name', 'br name'];
        return headers.findIndex(h => brCandidates.includes(norm(h)));
      }
      if (lower === 'curr_bck') {
        const bckCandidates = ['curr bck','curr_bck','current bck','current backlog','backlog','bck','bck curr','current_bck'];
        return headers.findIndex(h => bckCandidates.includes(norm(h)));
      }
      if (lower === 'source_file') {
        const srcCandidates = ['source_file', 'source file'];
        return headers.findIndex(h => srcCandidates.includes(norm(h)));
      }
      return headers.findIndex(h => norm(h) === lower);
    };
    const nextDefaults = dynamicDefaultOrder
      .map(resolveIndex)
      .filter(i => i !== -1);
    if (nextDefaults.length > 0) {
      setSelectedColumns(nextDefaults);
    }
  }, [headers, dynamicDefaultOrder]);




  const branches = useMemo(() => {
    const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
    if (brNameIndex === -1) return [];

    const uniqueBranches = new Set<string>();
    // Use processedData for branches if available, otherwise use data
    const dataToUse = processedData || data;
    dataToUse.forEach(row => {
      if (row[brNameIndex]) {
        uniqueBranches.add(String(row[brNameIndex]));
      }
    });
    return Array.from(uniqueBranches).sort();
  }, [data, processedData, headers]);

  // Normalize selected branch to the exact option value (case-insensitive) for the select control
  const normalizedSelectedBranch = useMemo(() => {
    if (!selectedBranch) return '';
    const found = branches.find(b => b.toLowerCase() === selectedBranch.toLowerCase());
    return found || '';
  }, [branches, selectedBranch]);


  // Helper functions for year filtering
  const parseSem = (v: any): number | null => {
    const s = String(v ?? '').toLowerCase();
    const m = s.match(/\d+/);
    if (!m) return null;
    const n = parseInt(m[0], 10);
    if (n >= 1 && n <= 8) return n;
    return null;
  };

  const isPass = (v: any): boolean => {
    const s = String(v ?? '').toLowerCase();
    const passIndicators = ['pass', 'p', '1', 'promoted', 'cleared', 'successful', '合格', '通过'];
    const failIndicators = ['fail', 'fail_mod', 'failed', 'r', 'reappear', 'repeat', 'unsuccessful', '不合格', '失败', '未通过', 'f', 'absent', ' detained', 'detained', 'kt', 'kt', 'drop'];
    
    // Check if it's clearly a fail
    if (failIndicators.some(indicator => s.includes(indicator))) {
      return false;
    }
    
    // Check if it's clearly a pass
    if (passIndicators.some(indicator => s === indicator || s.includes(indicator))) {
      return true;
    }
    
    // Default to pass for ambiguous cases to be safe
    return true;
  };

  const backlogVal = (v: any): number => {
    if (v === null || v === undefined || String(v).trim() === '') return 0;
    const n = parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  const filteredData = useMemo(() => {
    // Start with processedData (which includes QueryBuilder filters) or fallback to data
    let result = gradeFilteredData.length > 0 ? gradeFilteredData : (processedData || data);

    if (selectedBranch) {
      const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
      if (brNameIndex !== -1) {
        result = result.filter(row =>
          String(row[brNameIndex] || '').toLowerCase() === selectedBranch.toLowerCase()
        );
      }
    }




    // If there's a map number or name search filter, further filter by that specific search
    if (query?.filters) {
      const searchFilter = query.filters.find(filter => isSearchFilter(filter));
      if (searchFilter) {
        const mapIndex = findMapNoColumnIndex(headers);
        const nameIndex = findNameColumnIndex(headers);
        

    // Determine which column to search based on the filter column
        let searchColumnIndex = -1;
        const filterColumnLower = searchFilter.column.toLowerCase();
        
        // Use helper function to find the correct column
        const mapCandidates = ['mapno', 'map_number', 'map num', 'mapnumber', 'map no', 'map number', 'mapno.', 'map no.'];
        const nameCandidates = ['name', 'student name', 'student_name', 'studentname', 'student', 'full name', 'maono'];
        
        if (mapCandidates.includes(filterColumnLower)) {
          searchColumnIndex = mapIndex;
        } else if (nameCandidates.includes(filterColumnLower)) {
          searchColumnIndex = nameIndex;
        } else {
          // Fallback: try to find by actual header names
          const actualMapIndex = findColumnIndexByName(headers, mapCandidates);
          const actualNameIndex = findColumnIndexByName(headers, nameCandidates);
          
          if (actualMapIndex !== -1) {
            searchColumnIndex = actualMapIndex;
          } else if (actualNameIndex !== -1) {
            searchColumnIndex = actualNameIndex;
          }
        }
        
        if (searchColumnIndex !== -1) {
          const filterValue = String(searchFilter.value).toLowerCase();
          result = result.filter(row => {
            const cellValue = String(row[searchColumnIndex] || '').toLowerCase();
            if (searchFilter.operator === 'contains') {
              return cellValue.includes(filterValue);
            } else {
              return cellValue === filterValue;
            }
          });
        }
      }
    }

    // If Combined view and includedSources provided, filter by source_file
    if (isCombined && includedSources && includedSources.length > 0) {
      const srcIdx = headers.findIndex(h => {
        const n = norm(h);
        return n === 'source file' || n === 'source_file' || (n.includes('source') && n.includes('file'));
      });
      if (srcIdx !== -1) {
        const set = new Set(includedSources.map(s => String(s)));
        result = result.filter(row => set.has(String(row[srcIdx] ?? '')));
      }
    }


    // Apply yearSelected qualification filter
    if (yearSelected && yearSelected !== 'all') {
      // Resolve critical indices
      const semIdx = (() => {
        return headers.findIndex(h => {
          const n = norm(h);
          const candidates = [
            'sem','semester','sem no','semester no','sem number','semester number','semno','semesterno',
            'exam','exam name','exam title'
          ];
          return candidates.includes(n) || n.startsWith('sem');
        });
      })();
      const mapIdx = (() => {
        const candidates = ['mapno', 'map number', 'map_number', 'map num', 'map no'];
        return headers.findIndex(h => candidates.includes(norm(h)));
      })();
      const resultIdx = (() => {
        return headers.findIndex(h => {
          const n = norm(h);
          return n === 'result' || n === 'result status' || n === 'status' || n.includes('result');
        });
      })();
      const backlogIdx = (() => {
        const candidates = ['curr bck','curr_bck','current bck','current backlog','backlog','backlogs','no of backlogs','no backlogs','bck','bck curr','current_bck','backlog current'];
        return headers.findIndex(h => candidates.includes(norm(h)));
      })();

      if (semIdx !== -1 && mapIdx !== -1 && resultIdx !== -1) {
        // Determine the semester set for the selected year (pairs per academic year)
        let targetSems: number[] = [];
        if (yearSelected === '1') targetSems = [1, 2];
        else if (yearSelected === '2') targetSems = [3, 4];
        else if (yearSelected === '3') targetSems = [5, 6];
        else if (yearSelected === '4') targetSems = [7, 8];
        const requiredSems = new Set<number>(targetSems);

        // Group by student
        const byStudent: Record<string, Array<any[]>> = {};
        for (const row of result) {
          const key = String(row[mapIdx] ?? '').trim();
          if (!key) continue;
          (byStudent[key] ||= []).push(row);
        }

        const qualifies = new Set<string>();

        for (const [stud, rows] of Object.entries(byStudent)) {
          const present: Record<number, boolean> = {};
          const ok: Record<number, boolean> = {};
          for (const row of rows) {
            const semNum = parseSem(row[semIdx]);
            if (!semNum || !requiredSems.has(semNum)) continue;
            present[semNum] = true;
            const pass = isPass(row[resultIdx]);
            const b = backlogIdx !== -1 ? backlogVal(row[backlogIdx]) : 0;
            const rowOk = pass && b === 0;
            if (ok[semNum] === undefined) ok[semNum] = true;
            // Any failing row for the sem disqualifies that sem
            if (!rowOk) ok[semNum] = false;
          }
          // Qualification rules per year (relaxed for all years):
          // At least one target semester present AND all present target semesters are clean (pass, 0 backlogs)
          let allGood = true;
          const anyPresent = targetSems.some(s => !!present[s]);
          const noneBad = targetSems.every(s => ok[s] !== false);
          allGood = anyPresent && noneBad;
          if (allGood) qualifies.add(stud);
        }

        // Filter result to qualifying students and target semesters only
        result = result.filter(row => {
          const key = String(row[mapIdx] ?? '').trim();
          if (!qualifies.has(key)) return false;
          const semNum = parseSem(row[semIdx]);
          return !!semNum && requiredSems.has(semNum);
        });
      }
    }

    return result;
  }, [data, processedData, headers, selectedBranch, gradeFilteredData, query, includedSources, isCombined, yearSelected]);

  // Count unique qualifying students in current filteredData (by map number)
  const qualifiedCount = useMemo(() => {
    const mapIdx = (() => {
      const candidates = ['mapno', 'map number', 'map_number', 'map num', 'map no'];
      return headers.findIndex(h => candidates.includes(norm(h)));
    })();
    if (mapIdx === -1) return filteredData.length;
    const set = new Set<string>();
    for (const row of filteredData) set.add(String(row[mapIdx] ?? ''));
    return set.size;
  }, [filteredData, headers, norm]);


  // Year-mode subject insights (minimal): computed from all rows in selected year's semesters
  const yearSubjectInsights = useMemo(() => {
    if (!yearMode) return null;
    // Resolve indices
    const semIdx = (() => {
      return headers.findIndex(h => {
        const n = norm(h);
        const candidates = [
          'sem','semester','sem no','semester no','sem number','semester number','semno','semesterno',
          'exam','exam name','exam title'
        ];
        return candidates.includes(n) || n.startsWith('sem');
      });
    })();
    if (semIdx === -1) return null;
    const spiIdx = headers.findIndex(h => norm(h) === 'spi');
    const backlogIdx = (() => {
      const candidates = ['curr bck','curr_bck','current bck','current backlog','backlog','backlogs','no of backlogs','no backlogs','bck','bck curr','current_bck','backlog current'];
      return headers.findIndex(h => candidates.includes(norm(h)));
    })();
    // Subject identifier column: prefer one that includes 'subject' but not 'grade'
    const subjIdx = (() => {
      let idx = headers.findIndex(h => {
        const n = norm(h);
        return n.includes('subject') && !n.includes('grade');
      });
      if (idx !== -1) return idx;
      const fallbacks = ['sub code','sub_code','subject code','subject name','sub name','sub_name'];
      return headers.findIndex(h => fallbacks.includes(norm(h)));
    })();
    if (subjIdx === -1) return null;

    // Determine target semesters for selected year
    const target: Record<'1'|'2'|'3'|'4', number[]> = { '1': [1,2], '2': [3,4], '3': [5,6], '4': [7,8] };
    const targetSems = target[yearSelected as '1'|'2'|'3'|'4'];
    const parseSem = (v: any): number | null => {
      const semStr = String(v ?? '').toLowerCase();
      const match = semStr.match(/\d+/);
      if (!match) return null;
      const num = parseInt(match[0], 10);
      return num >= 1 && num <= 8 ? num : null;
    };
    const dataAll = (processedData || data).filter(r => {
      const semNum = parseSem(r[semIdx]);
      return !!semNum && targetSems.includes(semNum);
    });
    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a,b)=>a-b);
      const mid = Math.floor(sorted.length/2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
    };
    type Agg = { subj: string; n: number; backs: number; spiVals: number[] };
    const agg: Record<string, Agg> = {};
    for (const r of dataAll) {
      const subj = String(r[subjIdx] ?? '').trim();
      if (!subj) continue;
      if (!agg[subj]) agg[subj] = { subj, n: 0, backs: 0, spiVals: [] };
      agg[subj].n++;
      if (backlogIdx !== -1) {
        const v = r[backlogIdx];
        const num = v === null || v === undefined || String(v).trim()==='' ? 0 : parseFloat(String(v));
        if (!isNaN(num) && num > 0) agg[subj].backs++;
      }
      if (spiIdx !== -1) {
        const spiValue = parseFloat(String(r[spiIdx] ?? ''));
        if (!isNaN(spiValue)) agg[subj].spiVals.push(spiValue);
      }
    }
    const items = Object.values(agg).map(a => ({
      subj: a.subj,
      n: a.n,
      backs: a.backs,
      medSPI: median(a.spiVals),
    }));
    const highestBacks = [...items].sort((a,b)=> b.backs - a.backs || a.subj.localeCompare(b.subj)).slice(0,5);
    const lowestMedianSPI = [...items].sort((a,b)=> a.medSPI - b.medSPI || a.subj.localeCompare(b.subj)).slice(0,5);
    return { highestBacks, lowestMedianSPI };
  }, [yearMode, yearSelected, headers, norm, processedData, data]);

  const handleGradeFilterChange = useCallback((filteredData: any[][]) => {
    setGradeFilteredData(filteredData);
  }, []);

  // Ensure Subject view can show by auto-selecting the first branch if none selected
  useEffect(() => {
    if (analysisView === 'subject' && !selectedBranch && branches.length > 0) {
      const first = branches[0];
      if (onSelectedBranchChange) {
        onSelectedBranchChange(first);
      } else {
        setInternalSelectedBranch(first);
      }
    }
  }, [analysisView, selectedBranch, branches, onSelectedBranchChange]);

  const handleSort = (colIndex: number) => {
    // Get the actual column index (accounting for selected columns)
    const actualColIndex = selectedColumns.length > 0 ? selectedColumns[colIndex] : colIndex;

    if (sortColumn === actualColIndex) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with ascending
      setSortColumn(actualColIndex);
      setSortDirection('asc');
    }
  };

  const getVisibleHeaders = useMemo(() => {
    if (selectedColumns.length === 0) {
      return headers;
    }

    return selectedColumns.map(colIndex =>
      (colIndex >= 0 && colIndex < headers.length) ? headers[colIndex] : `Column ${colIndex}`
    );
  }, [headers, selectedColumns]);

  const getVisibleData = useMemo(() => {
    let dataToDisplay = filteredData;

    // Apply sorting if a column is selected
    if (sortColumn !== null) {
      dataToDisplay = [...filteredData].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle different data types
        let aParsed, bParsed;

        // Try to parse as number first
        const aNum = parseFloat(String(aVal || ''));
        const bNum = parseFloat(String(bVal || ''));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          // Both are numbers
          aParsed = aNum;
          bParsed = bNum;
        } else {
          // Treat as strings
          aParsed = String(aVal || '').toLowerCase();
          bParsed = String(bVal || '').toLowerCase();
        }

        if (aParsed < bParsed) return sortDirection === 'asc' ? -1 : 1;
        if (aParsed > bParsed) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (selectedColumns.length === 0) {
      return dataToDisplay;
    }

    return dataToDisplay.map(row =>
      selectedColumns.map(colIndex => (colIndex >= 0 && colIndex < row.length) ? row[colIndex] : '')
    );
  }, [filteredData, selectedColumns, sortColumn, sortDirection]);

  const currentPageData = useMemo(() => {
    return getVisibleData;
  }, [getVisibleData]);

  // Export functions
  const handleExportExcel = useCallback(() => {
      const exportHeaders = getVisibleHeaders;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `result-data-${timestamp}.xlsx`;
      exportToExcel(exportData, exportHeaders, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export Excel file. Please try again.');
    }
  }, [getVisibleData, getVisibleHeaders]);

  const handleExportPDF = useCallback(() => {
    try {
      const exportData = getVisibleData;
      const exportHeaders = getVisibleHeaders;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `result-data-${timestamp}.pdf`;
      exportToPDF(exportData, exportHeaders, filename);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export PDF file. Please try again.');
    }
  }, [getVisibleData, getVisibleHeaders]);


  const handleBranchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value || null;
      onSelectedBranchChange(next);
    } else {
      setInternalSelectedBranch(next);
    }
    // When "All Branches" is selected (next is null), switch to summary
    if (!next) {
      setAnalysisView('summary');
      setShowAnalysis(true);
    } else if (next && analysisView !== 'branch') {
      // When a branch is selected, switch to subject view only if not in branch view
      setAnalysisView('subject');
      setShowAnalysis(true);
    }
  };

  const handleStudentSelect = (rowIndex: number) => {
    const selectedRow = filteredData[rowIndex];
    if (selectedRow) {
      setSelectedStudentData([selectedRow]);
    }
  };

  const handleBackToTable = () => {
    setSelectedStudentData(null);
  };

  const toggleAnalysis = () => {
    setShowAnalysis(!showAnalysis);
  };

  


    
 

  // const startEdit = (rowIndex: number, colIndex: number) => {
  //   const actualColIndex = selectedColumns.length > 0 
  //     ? selectedColumns[colIndex] 
  //     : colIndex;
      
  //   setEditingCell({ row: rowIndex, col: actualColIndex });
  //   setEditValue(filteredData[rowIndex]?.[actualColIndex] || '');
  // };

  // const saveEdit = () => {
  //   if (!editingCell) return;
    
  //   const newData = [...data];
  //   const rowIndex = editingCell.row;
  //   const colIndex = editingCell.col;
    
  //   const originalRowIndex = data.findIndex(row => 
  //     row[0] === filteredData[rowIndex]?.[0]
  //   );
    
  //   if (originalRowIndex !== -1) {
  //     newData[originalRowIndex] = [...newData[originalRowIndex]];
  //     newData[originalRowIndex][colIndex] = editValue;
  //     onDataChange(newData);
  //   }
    
  //   setEditingCell(null);
  // };

  // const handleRowClick = (rowIndex: number, colIndex: number) => {
  //   if (editingCell) {
  //     saveEdit();
  //   } else {
  //     startEdit(rowIndex, colIndex);
  //   }
  // };

  // const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
  //   if (e.key === 'Enter') {
  //     e.preventDefault();
  //     saveEdit();
  //   } else if (e.key === 'Escape') {
  //     setEditingCell(null);
  //   } else if (e.key === 'Tab') {
  //     e.preventDefault();
  //     saveEdit();
      
  //     const nextCol = e.shiftKey ? col - 1 : col + 1;
  //     const visibleCols = selectedColumns.length > 0 ? selectedColumns : headers.map((_, i) => i);
      
  //     if (nextCol >= 0 && nextCol < visibleCols.length) {
  //       startEdit(row, nextCol);
  //     }
  //   }
  // };


  // If a student is selected, show student details instead of data table
  if (selectedStudentData) {
    return (
      <div className="w-full overflow-x-auto">
        <StudentDetails
          studentData={selectedStudentData}
          headers={headers}
          onBack={handleBackToTable}
        />
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      {shouldShowAnalysis && (
        <div className="mb-6 bg-white rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-semibold text-text">{yearMode ? 'Year Analysis' : 'Analysis'}</h3>
            <div className="flex items-center gap-2">
              {yearMode && (
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                  {yearSemLabel} • Qualified: {qualifiedCount}
                </span>
              )}
              {/* header right actions could go here */}
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1">
                <button
                  onClick={() => { 
                    setShowAnalysis(true); 
                    setAnalysisView('summary');
                    // Clear branch selection when switching to summary
                    if (onSelectedBranchChange) {
                      onSelectedBranchChange(null);
                    } else {
                      setInternalSelectedBranch(null);
                    }
                  }}
                  className={`${analysisView === 'summary' ? 'bg-white text-primary border border-primary shadow-sm' : 'bg-[#F1F5F9] text-gray-600 border border-transparent'} rounded-full py-2 px-4`}
                >
                  {yearMode ? 'Year Summary' : 'Summary'}
                </button>

                <button
                  onClick={() => { setShowAnalysis(true); setAnalysisView('branch'); }}
                  className={`${analysisView === 'branch' ? 'bg-white text-primary border border-primary shadow-sm' : 'bg-[#F1F5F9] text-gray-600 border border-transparent'} rounded-full py-2 px-4`}
                >
                  {yearMode ? 'Year Branches' : 'Branch Analysis'}
                </button>
                {selectedBranch && (
                  <button
                    onClick={() => { setShowAnalysis(true); setAnalysisView('subject'); }}
                    className={`${analysisView === 'subject' ? 'bg-white text-primary border border-primary shadow-sm' : 'bg-[#F1F5F9] text-gray-600 border border-transparent'} rounded-full py-2 px-4`}
                  >
                    {yearMode ? 'Year Subjects' : 'Subject-wise Analysis'}
                  </button>
                )}

      
              </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="flex items-center space-x-1 bg-white border rounded-lg px-3 py-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={normalizedSelectedBranch}
                    onChange={handleBranchSelect}
                    className="appearance-none bg-transparent border-none focus:outline-none focus:ring-0"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch, index) => (
                      <option key={index} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Show currently active selections when present */}
              {selectedBranch && (
                <span className="ml-2 text-sm text-gray-700">Branch: <span className="font-medium">{selectedBranch}</span></span>
              )}
              {selectedSubject && analysisView === 'subject' && (
                <span className="ml-2 text-sm text-gray-700">Subject: <span className="font-medium">{selectedSubject}</span></span>
              )}
            </div>
            {/* end controls row */}
          </div>

          {analysisView === 'summary' && showPanels && (
            <SimplifiedAnalysisPanel
              data={filteredData}
              processedData={filteredData}
              headers={headers}
              title="Performance Analysis"
              selectedBranch={selectedBranch}
              branches={branches}
            />
          )}

          {analysisView === 'branch' && showPanels && (
            <BranchAnalysis
              data={gradeFilteredData.length > 0 ? gradeFilteredData : data}
              processedData={filteredData}
              headers={headers}
              selectedBranch={selectedBranch}
            />
          )}


          {analysisView === 'subject' && (
            <div className="mt-4">
              <SubjectAnalysis
                data={processedData || data}
                processedData={filteredData}
                headers={headers}
                selectedBranch={selectedBranch}
                query={query}
                selectedSubject={selectedSubject}
                onSelectedSubjectChange={onSelectedSubjectChange}
              />
            </div>
          )}

        </div>
        </div>
      )}




      {/* Grade Range Filter - Above Data Table */}
      <div className="mb-6 bg-white rounded-xl shadow-md border border-gray-200">
        <GradeRangeFilter
          key={resetKey}
          data={selectedBranch ? filteredData : (processedData || data)}
          headers={headers}
          onFilterChange={handleGradeFilterChange}
          ranges={gradeRanges}
          onRangesChange={onGradeRangesChange}
          selectedYear={yearSelected}
        />
      </div>

      {/* Data Table - Always visible */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        {selectedBranch && (
          <div className="bg-blue-50 border border-blue-200 rounded-t-lg px-4 py-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Branch Filter Active:</span> Showing data for <span className="font-semibold">{selectedBranch}</span> branch. You can change the branch selection above or view all branches.
                </p>
              </div>
            </div>
          </div>
        )}
        {!selectedBranch && (
          <div className="bg-blue-50 border border-blue-200 rounded-t-lg px-4 py-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Data Table View:</span> Showing all branches combined. Select a specific branch above for focused analysis.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Data Table Header with Export Buttons */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Data Table</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors duration-200"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-2 transition-colors duration-200"
            >
              <FileText className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {getVisibleHeaders.map((header: string, colIndex: number) => (
                <th
                  key={colIndex}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center">
                    {header}
                    <button
                      onClick={() => handleSort(colIndex)}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentPageData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-gray-50"
              >
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {cell || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {currentPageData.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No data found for the current filters.</p>
          </div>
        )}
      </div>


      <div className="flex justify-end items-center mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleAnalysis}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${
              showAnalysis
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>{showAnalysis ? 'Hide Analysis' : 'Show Analysis'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDataTable;
