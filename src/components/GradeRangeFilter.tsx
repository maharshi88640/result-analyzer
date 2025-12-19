import React, { useState, useEffect } from 'react';
import { Filter, BarChart2 } from 'lucide-react';


interface GradeRangeFilterProps {
  data: any[][];
  headers: string[];
  onFilterChange: (filteredData: any[][]) => void;
  ranges?: { spi: { min: number; max: number }; cpi: { min: number; max: number }; cgpa: { min: number; max: number } };
  onRangesChange?: (ranges: { spi: { min: number; max: number }; cpi: { min: number; max: number }; cgpa: { min: number; max: number } }) => void;
  selectedYear?: 'all' | '1' | '2' | '3' | '4';
}


const GradeRangeFilter: React.FC<GradeRangeFilterProps> = ({ data, headers, onFilterChange, ranges: controlledRanges, onRangesChange, selectedYear }) => {

  // Find column indices for SPI, CPI, CGPA
  const spiIndex = headers.findIndex(h => h.toLowerCase() === 'spi');
  const cpiIndex = headers.findIndex(h => h.toLowerCase() === 'cpi');
  const cgpaIndex = headers.findIndex(h => h.toLowerCase() === 'cgpa');
  const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');
  const semIndex = headers.findIndex(h => {
    const n = h.toLowerCase();
    const candidates = ['sem','semester','sem no','semester no','sem number','semester number','semno','semesterno'];
    return candidates.includes(n) || n.startsWith('sem');
  });
  const mapIndex = headers.findIndex(h => {
    const n = h.toLowerCase();
    const candidates = ['mapno', 'map number', 'map_number', 'map num', 'map no'];
    return candidates.includes(n);
  });

  // State for range filters
  const [ranges, setRanges] = useState({
    spi: { min: 0, max: 10 },
    cpi: { min: 0, max: 10 },
    cgpa: { min: 0, max: 10 },
  });

  // Sync from controlled prop
  useEffect(() => {
    if (controlledRanges) {
      setRanges(controlledRanges);
    }
  }, [controlledRanges]);

  // State for result counts
  const [counts, setCounts] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    inRange: 0,
    passedInRange: 0,
  });


  // Update counts and filter data when data or ranges change
  useEffect(() => {
    if (data.length === 0) {
      onFilterChange([]);
      return;
    }

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
      const s = String(v ?? '').toLowerCase().trim();
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

    // Year filtering logic
    let dataToProcess = [...data];
    
    if (selectedYear && selectedYear !== 'all' && semIndex !== -1 && mapIndex !== -1 && resultIndex !== -1) {
      // Determine target semesters for the selected year
      const targetSems: number[] = [];
      if (selectedYear === '1') targetSems.push(1, 2);
      else if (selectedYear === '2') targetSems.push(3, 4);
      else if (selectedYear === '3') targetSems.push(5, 6);
      else if (selectedYear === '4') targetSems.push(7, 8);
      
      const requiredSems = new Set<number>(targetSems);

      // Group by student and apply year qualification
      const byStudent: Record<string, Array<any[]>> = {};
      data.forEach(row => {
        const key = String(row[mapIndex] ?? '').trim();
        if (!key) return;
        (byStudent[key] ||= []).push(row);
      });

      const qualifies = new Set<string>();
      
      for (const [stud, rows] of Object.entries(byStudent)) {
        const present: Record<number, boolean> = {};
        const ok: Record<number, boolean> = {};
        
        for (const row of rows) {
          const semNum = parseSem(row[semIndex]);
          if (!semNum || !requiredSems.has(semNum)) continue;
          
          present[semNum] = true;
          const pass = isPass(row[resultIndex]);
          const b = backlogVal(row[headers.findIndex(h => ['curr bck','curr_bck','current bck','current backlog','backlog','backlogs','no of backlogs','no backlogs','bck','bck curr','current_bck','backlog current'].includes(h.toLowerCase()))]);
          const rowOk = pass && b === 0;
          
          if (ok[semNum] === undefined) ok[semNum] = true;
          if (!rowOk) ok[semNum] = false;
        }
        
        // Qualification: at least one target semester present AND all present target semesters are clean
        const anyPresent = targetSems.some(s => !!present[s]);
        const noneBad = targetSems.every(s => ok[s] !== false);
        const allGood = anyPresent && noneBad;
        
        if (allGood) qualifies.add(stud);
      }

      // Filter data to qualifying students and target semesters only
      dataToProcess = dataToProcess.filter(row => {
        const key = String(row[mapIndex] ?? '').trim();
        if (!qualifies.has(key)) return false;
        const semNum = parseSem(row[semIndex]);
        return !!semNum && requiredSems.has(semNum);
      });
    }

    // Now apply grade range filtering to the year-filtered data
    let totalInRange = 0;
    let passedInRange = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const filtered: any[][] = [];

    dataToProcess.forEach(row => {
      const spi = parseFloat(row[spiIndex]) || 0;
      const cpi = parseFloat(row[cpiIndex]) || 0;
      const cgpa = parseFloat(row[cgpaIndex]) || 0;
      const result = String(row[resultIndex] || '').toLowerCase();
      const isPassResult = isPass(row[resultIndex]);

      // Check if student is within all specified ranges
      const inSpirange = spi >= ranges.spi.min && spi <= ranges.spi.max;
      const inCpirange = cpi >= ranges.cpi.min && cpi <= ranges.cpi.max;
      const inCgparange = cgpa >= ranges.cgpa.min && cgpa <= ranges.cgpa.max;
      const inRange = inSpirange && inCpirange && inCgparange;

      // Update counts
      if (isPassResult) totalPassed++;
      else totalFailed++;

      if (inRange) {
        totalInRange++;
        if (isPassResult) passedInRange++;
        filtered.push([...row]); // Add a copy of the row to filtered results
      }
    });

    // Update the counts state
    setCounts({
      total: dataToProcess.length,
      passed: totalPassed,
      failed: totalFailed,
      inRange: totalInRange,
      passedInRange,
    });

    // Send filtered data to parent
    onFilterChange(filtered);
  }, [data, ranges, selectedYear, spiIndex, cpiIndex, cgpaIndex, resultIndex, semIndex, mapIndex, headers, onFilterChange]);

  const handleRangeChange = (type: 'spi' | 'cpi' | 'cgpa', minOrMax: 'min' | 'max', value: string) => {
    const numValue = Math.max(0, Math.min(10, parseInt(value) || 0));

    setRanges(prev => {
      const currentRange = prev[type];
      let newMin = minOrMax === 'min' ? numValue : currentRange.min;
      let newMax = minOrMax === 'max' ? numValue : currentRange.max;

      // Swap min and max if min > max to allow flexible input order
      if (newMin > newMax) {
        [newMin, newMax] = [newMax, newMin];
      }

      const next = {
        ...prev,
        [type]: {
          min: newMin,
          max: newMax,
        },
      };
      // Notify parent of ranges change
      onRangesChange && onRangesChange(next);
      return next;
    });
  };

  // Create range input for a grade type
  const renderRangeInput = (type: 'spi' | 'cpi' | 'cgpa', label: string) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} Range
      </label>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="0"
          max="10"
          step="1"
          value={ranges[type].min}
          onChange={(e) => handleRangeChange(type, 'min', e.target.value)}
          className="w-20 p-1 border rounded"
        />
        <span>to</span>
        <input
          type="number"
          min="0"
          max="10"
          step="1"
          value={ranges[type].max}
          onChange={(e) => handleRangeChange(type, 'max', e.target.value)}
          className="w-20 p-1 border rounded"
        />
      </div>
    </div>
  );


  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Filter className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold">Grade Range Filter</h3>
        </div>
        {selectedYear && selectedYear !== 'all' && (
          <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 rounded-full text-sm text-blue-800">
            <BarChart2 className="h-4 w-4" />
            <span>Filtered for {selectedYear === '1' ? '1st Year (Sem 1-2)' : 
                           selectedYear === '2' ? '2nd Year (Sem 3-4)' : 
                           selectedYear === '3' ? '3rd Year (Sem 5-6)' : 
                           selectedYear === '4' ? '4th Year (Sem 7-8)' : selectedYear}</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {renderRangeInput('spi', 'SPI')}
        {renderRangeInput('cpi', 'CPI')}
        {renderRangeInput('cgpa', 'CGPA')}
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="p-2">
            <div className="text-sm text-gray-500">Total Students</div>
            <div className="text-xl font-bold">{counts.total}</div>
          </div>
          <div className="p-2">
            <div className="text-sm text-gray-500">Total Passed</div>
            <div className="text-xl font-bold text-green-600">{counts.passed}</div>
          </div>
          <div className="p-2">
            <div className="text-sm text-gray-500">In Range</div>
            <div className="text-xl font-bold">{counts.inRange}</div>
          </div>
          <div className="p-2">
            <div className="text-sm text-gray-500">Passed in Range</div>
            <div className="text-xl font-bold text-green-600">{counts.passedInRange}</div>
          </div>
          <div className="p-2">
            <div className="text-sm text-gray-500">Pass % in Range</div>
            <div className="text-xl font-bold">
              {counts.inRange > 0 ? ((counts.passedInRange / counts.inRange) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeRangeFilter;
