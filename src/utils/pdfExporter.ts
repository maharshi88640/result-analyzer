import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToPDF(data: any[][], headers: string[], filename: string) {
  try {
    const doc = new jsPDF();

    // Filter out empty rows
    const filteredData = data.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

    if (filteredData.length === 0) {
      console.error('No data to export');
      return;
    }

    // Prepare data for autoTable - simple array format
    const tableData = filteredData.map(row =>
      headers.map((header, index) => {
        const value = row[index];
        return value !== null && value !== undefined ? String(value) : '';
      })
    );

    // Add autoTable to the document
    autoTable(doc, {
      head: [headers],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185], // blue color
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 20, right: 10, bottom: 10, left: 10 },
    });

    // Save the PDF
    doc.save(filename);
    console.log('PDF exported successfully');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Failed to export PDF. Please check the console for details.');
  }
}
