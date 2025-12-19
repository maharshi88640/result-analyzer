import * as XLSX from 'xlsx';

interface BranchStats {
  branch: string;
  total: number;
  passed: number;
  failed: number;
  passPercentage: number;
}

function calculateBranchStats(data: any[][], headers: string[]): BranchStats[] {
  const brNameIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
  const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');

  if (brNameIndex === -1 || resultIndex === -1) return [];

  const branchMap = new Map<string, { total: number; passed: number; failed: number }>();

  data.forEach(row => {
    const branch = String(row[brNameIndex] || '').trim();
    if (!branch) return;

    const result = String(row[resultIndex] || '').toLowerCase();
    const isPass = result.includes('pass') || result === 'p';
    const isFail = result.includes('fail') || result === 'f';

    if (!branchMap.has(branch)) {
      branchMap.set(branch, { total: 0, passed: 0, failed: 0 });
    }

    const stats = branchMap.get(branch)!;
    stats.total++;
    if (isPass) stats.passed++;
    if (isFail) stats.failed++;
  });

  return Array.from(branchMap.entries())
    .map(([branch, stats]) => ({
      branch,
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      passPercentage: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0
    }))
    .sort((a, b) => a.branch.localeCompare(b.branch));
}

export function exportToExcel(data: any[][], headers: string[], filename: string) {
  // Create a worksheet from the data
  const worksheetData = [headers, ...data];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set cell formats to prevent scientific notation for large numbers
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = 0; row <= range.e.r; row++) {
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];

      if (cell && cell.v !== undefined) {
        // Check if this is a map_number column or contains large numbers
        const headerIndex = col;
        const header = headers[headerIndex]?.toLowerCase() || '';

        if (header.includes('map') && typeof cell.v === 'number' && cell.v > 999999) {
          // Force large map numbers to be treated as text to prevent scientific notation
          cell.t = 's'; // string type
          cell.v = String(cell.v);
          cell.w = String(cell.v);
        }
      }
    }
  }

  // Create a new workbook and append the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  // Calculate and add branch analysis sheet
  const branchStats = calculateBranchStats(data, headers);
  if (branchStats.length > 0) {
    const branchHeaders = ['Branch', 'Total Students', 'Passed', 'Failed', 'Pass Percentage'];
    const branchData = branchStats.map(stat => [
      stat.branch,
      stat.total,
      stat.passed,
      stat.failed,
      `${stat.passPercentage}%`
    ]);
    const branchWorksheetData = [branchHeaders, ...branchData];
    const branchWorksheet = XLSX.utils.aoa_to_sheet(branchWorksheetData);
    XLSX.utils.book_append_sheet(workbook, branchWorksheet, 'Branch Analysis');
  }

  // Write the workbook and trigger download
  XLSX.writeFile(workbook, filename);
}
