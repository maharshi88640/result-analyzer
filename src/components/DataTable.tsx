import React, { useState } from 'react';
import { ArrowUpDown, Edit, Trash2, Download, BarChart2, Plus } from 'lucide-react';
import { exportToCSV } from '../utils/dataProcessor';
import { exportToExcel } from '../utils/excelExporter';
import { exportToPDF } from '../utils/pdfExporter';
import { AnalysisPanel } from './AnalysisPanel';

interface DataTableProps {
  headers: string[];
  data: any[][];
  onDataChange?: (newData: any[][]) => void; // Made optional since we're not using it
  hints?: string[];
}

export const DataTable: React.FC<DataTableProps> = ({ headers, data }) => {
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all' | 'custom'>('all');
  const [customRowsPerPage, setCustomRowsPerPage] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    if (value === 'all') {
      setRowsPerPage('all');
      setCustomRowsPerPage(null);
    } else if (value === 'custom') {
      setRowsPerPage('custom');
      setCustomRowsPerPage(null);
    } else {
      const num = Number(value);
      if (!isNaN(num) && num > 0) {
        setRowsPerPage('custom');
        setCustomRowsPerPage(num);
      }
    }
  };

  const handleCustomRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = Number(e.target.value);
    if (!isNaN(num) && num > 0) {
      setCustomRowsPerPage(num);
      setRowsPerPage('custom');
    } else {
      setCustomRowsPerPage(null);
    }
  };


  const paginatedData = rowsPerPage === 'all' ? data : rowsPerPage === 'custom' && customRowsPerPage ? data.slice(0, customRowsPerPage) : rowsPerPage === 'custom' ? data : data.slice(0, rowsPerPage);


  const exportData = () => {
    exportToCSV(paginatedData, headers, 'data.csv');
  };

  const exportExcel = () => {
    exportToExcel(paginatedData, headers, 'data.xlsx');
  };

  const exportPDF = () => {
    exportToPDF(paginatedData, headers, 'data.pdf');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Data Table</h2>
        <div className="flex space-x-3">
          <div className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Read-only Mode</span>
          </div>
          <button
            onClick={exportData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-11 rounded-full shadow-sm flex items-center gap-2 transition-colors duration-200"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-5 h-11 rounded-full shadow-sm flex items-center gap-2 transition-colors duration-200"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={exportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-5 h-11 rounded-full shadow-sm flex items-center gap-2 transition-colors duration-200"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors duration-200 ${
              showAnalysis
                ? 'bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>{showAnalysis ? 'Hide Analysis' : 'Show Analysis'}</span>
          </button>
        </div>
      </div>

      {showAnalysis && (
        <div className="mt-8">
          <AnalysisPanel
            data={data}
            headers={headers}
          />
        </div>
      )}

      <div className="mb-4 flex items-center space-x-2">
        <label htmlFor="rowsPerPage" className="text-xs uppercase tracking-wide text-gray-500">Rows per page</label>
        <select
          id="rowsPerPage"
          value={rowsPerPage === 'all' || rowsPerPage === 'custom' ? rowsPerPage : rowsPerPage.toString()}
          onChange={handleRowsPerPageChange}
          className="border border-gray-300 rounded px-2 py-1 text-sm text-slate-700"
        >
          <option value="all">All</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="custom">Custom</option>
        </select>
        <input
          type="number"
          min={1}
          placeholder="Enter number"
          value={customRowsPerPage || ''}
          onChange={handleCustomRowsPerPageChange}
          className={`border border-gray-300 rounded px-2 py-1 w-20 min-w-[5rem] text-sm text-slate-700 transition-opacity duration-200 ${rowsPerPage === 'custom' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      </div>


      <table className="min-w-full border-collapse border border-gray-300 striped-table text-sm text-slate-700">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="border border-gray-300 px-6 py-4 text-left font-semibold" style={{ fontWeight: '600' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-100 cursor-pointer table-row">
              {row.map((cell, colIndex) => (
                <td 
                  key={colIndex} 
                  className="border border-gray-300 px-6 py-4 text-sm text-slate-700"
                  style={{
                    height: '52px',
                    paddingLeft: colIndex === 0 ? '12px' : '24px',
                    borderLeft: colIndex === 0 ? '4px solid indigo' : 'none'
                  }}
                >
                  <div className="min-h-[28px] flex items-center">
                    {cell}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      <style>{`
        .striped-table tbody tr:nth-child(even) {
          background-color: #FAFAFA;
        }
        .table-row {
          height: 52px;
        }
      `}</style>

      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No data to display</p>
        </div>
      )}
    </div>
  );
};
