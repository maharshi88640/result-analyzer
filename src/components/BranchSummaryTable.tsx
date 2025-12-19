import React from 'react';

interface BranchSummary {
  branch: string;
  totalStudents: number;
  passed: number;
  failed: number;
  percentage: number;
  avgCpi: number;
  avgSpi: number;
  avgCgpa: number;
  hasData: {
    cpi: boolean;
    spi: boolean;
    cgpa: boolean;
  };
}

interface BranchSummaryTableProps {
  data: any[][]; 
  headers: string[];
}

export const BranchSummaryTable: React.FC<BranchSummaryTableProps> = ({ data, headers }) => {
  // Get column indices
  const branchIndex = headers.findIndex(h => h.toLowerCase() === 'br_name' || h.toLowerCase() === 'branch');
  const resultIndex = headers.findIndex(h => h.toLowerCase() === 'result');
  const cpiIndex = headers.findIndex(h => h.toLowerCase() === 'cpi');
  const spiIndex = headers.findIndex(h => h.toLowerCase() === 'spi');
  const cgpaIndex = headers.findIndex(h => h.toLowerCase() === 'cgpa');

  if (branchIndex === -1 || resultIndex === -1) {
    return <div className="text-red-500">Required columns (branch, result) not found in the data.</div>;
  }

  // Calculate branch-wise statistics
  const branchStats = data.reduce((acc, row) => {
    const branch = row[branchIndex] || 'Unknown';
    const result = String(row[resultIndex] || '').toLowerCase();
    const cpi = cpiIndex !== -1 ? parseFloat(row[cpiIndex]) || 0 : 0;
    const spi = spiIndex !== -1 ? parseFloat(row[spiIndex]) || 0 : 0;
    const cgpa = cgpaIndex !== -1 ? parseFloat(row[cgpaIndex]) || 0 : 0;
    
    if (!acc[branch]) {
      acc[branch] = {
        branch,
        totalStudents: 0,
        passed: 0,
        failed: 0,
        percentage: 0,
        avgCpi: 0,
        avgSpi: 0,
        avgCgpa: 0,
        hasData: {
          cpi: false,
          spi: false,
          cgpa: false
        }
      };
    }
    
    const branchData = acc[branch];
    branchData.totalStudents++;
    
    if (result.includes('pass') || result === 'p') {
      branchData.passed++;
    } else if (result.includes('fail') || result === 'f') {
      branchData.failed++;
    }
    
    // Update metrics if data is available
    if (cpi > 0) {
      branchData.avgCpi = ((branchData.avgCpi * (branchData.totalStudents - 1)) + cpi) / branchData.totalStudents;
      branchData.hasData.cpi = true;
    }
    
    if (spi > 0) {
      branchData.avgSpi = ((branchData.avgSpi * (branchData.totalStudents - 1)) + spi) / branchData.totalStudents;
      branchData.hasData.spi = true;
    }
    
    if (cgpa > 0) {
      branchData.avgCgpa = ((branchData.avgCgpa * (branchData.totalStudents - 1)) + cgpa) / branchData.totalStudents;
      branchData.hasData.cgpa = true;
    }
    
    return acc;
  }, {} as Record<string, BranchSummary>);

  // Convert to array and calculate percentages
  const branchSummaries = Object.values(branchStats).map(branch => ({
    ...branch,
    percentage: branch.totalStudents > 0 
      ? Math.round((branch.passed / branch.totalStudents) * 100)
      : 0,
    avgCpi: parseFloat(branch.avgCpi.toFixed(2)),
    avgSpi: parseFloat(branch.avgSpi.toFixed(2)),
    avgCgpa: parseFloat(branch.avgCgpa.toFixed(2))
  }));

  // Determine which columns to show based on available data
  const showCpi = branchSummaries.some(b => b.hasData.cpi);
  const showSpi = branchSummaries.some(b => b.hasData.spi);
  const showCgpa = branchSummaries.some(b => b.hasData.cgpa);

  // Sort branches by name
  branchSummaries.sort((a, b) => a.branch.localeCompare(b.branch));

  return (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4">Branch-wise Analysis</h3>
      <table className="min-w-full bg-white border border-gray-200">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 border-b text-left">Branch</th>
            <th className="px-4 py-2 border-b text-center">Total</th>
            <th className="px-4 py-2 border-b text-center">Passed</th>
            <th className="px-4 py-2 border-b text-center">Failed</th>
            <th className="px-4 py-2 border-b text-center">Pass %</th>
            {showCpi && <th className="px-4 py-2 border-b text-center">Avg CPI</th>}
            {showSpi && <th className="px-4 py-2 border-b text-center">Avg SPI</th>}
            {showCgpa && <th className="px-4 py-2 border-b text-center">Avg CGPA</th>}
          </tr>
        </thead>
        <tbody>
          {branchSummaries.map((branch, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2 border-b">{branch.branch}</td>
              <td className="px-4 py-2 border-b text-center">{branch.totalStudents}</td>
              <td className="px-4 py-2 border-b text-center text-green-600">{branch.passed}</td>
              <td className="px-4 py-2 border-b text-center text-red-600">{branch.failed}</td>
              <td className="px-4 py-2 border-b text-center font-medium">
                {branch.percentage}%
              </td>
              {showCpi && (
                <td className="px-4 py-2 border-b text-center">
                  {branch.hasData.cpi ? branch.avgCpi.toFixed(2) : '-'}
                </td>
              )}
              {showSpi && (
                <td className="px-4 py-2 border-b text-center">
                  {branch.hasData.spi ? branch.avgSpi.toFixed(2) : '-'}
                </td>
              )}
              {showCgpa && (
                <td className="px-4 py-2 border-b text-center">
                  {branch.hasData.cgpa ? branch.avgCgpa.toFixed(2) : '-'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BranchSummaryTable;
