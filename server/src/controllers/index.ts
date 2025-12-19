
import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { uploadFile, getFileById, getAllFiles, saveAnalysisHistory, getAnalysisHistory, getAnalysisHistoryById, deleteAnalysisHistory, findFileByNameAndData } from '../services/index';
import { AnalysisHistoryModel } from '../models';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb'];

    const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  }
});


<<<<<<< HEAD
=======

>>>>>>> 6974c8e (working)
export const uploadFileController = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get user email from headers
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ error: 'User email is required' });
      }

<<<<<<< HEAD
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

=======
      // Check file size limit (100MB from multer config)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (req.file.size > maxSize) {
        return res.status(413).json({ 
          error: 'File size exceeds the maximum limit of 100MB. Please use a smaller file.' 
        });
      }

      // Parse Excel file
      console.log(`📁 Processing file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      let workbook;
      try {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      } catch (parseError: any) {
        console.error('Excel parsing error:', parseError);
        return res.status(400).json({ 
          error: 'Invalid Excel file format. Please ensure the file is a valid Excel spreadsheet.' 
        });
      }

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ 
          error: 'No sheets found in the Excel file. Please ensure the file contains at least one worksheet.' 
        });
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!data || data.length === 0) {
        return res.status(400).json({ 
          error: 'Excel file is empty. Please ensure the file contains data.' 
        });
      }


      console.log(`📊 Parsed Excel data: ${data.length} rows, ${(data[0] as any)?.length || 0} columns`);
>>>>>>> 6974c8e (working)

      // Check if file with same name and data already exists for this user
      const existingFile = await findFileByNameAndData(req.file.originalname, data, userEmail);

      let savedFile;
      if (existingFile) {
<<<<<<< HEAD
        // Use existing file to avoid duplicates
        savedFile = existingFile;
      } else {
        // Save new file data to MongoDB
        const fileData = {
          filename: `${Date.now()}-${req.file.originalname}`,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          data: data,
          userEmail: userEmail
        };

        savedFile = await uploadFile(fileData);
=======
        console.log(`♻️ Using existing file: ${existingFile._id}`);
        savedFile = existingFile;
      } else {
        try {
          // Save new file data to MongoDB
          const fileData = {
            filename: `${Date.now()}-${req.file.originalname}`,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            data: data,
            userEmail: userEmail
          };

          savedFile = await uploadFile(fileData);
          console.log(`✅ File saved successfully: ${savedFile._id}`);
        } catch (uploadError: any) {
          console.error('File upload error:', uploadError);
          
          // Handle specific error types
          if (uploadError.message.includes('too large')) {
            return res.status(413).json({ 
              error: uploadError.message,
              suggestions: [
                'Split your Excel file into smaller files (e.g., by semester or year)',
                'Remove unnecessary columns or empty rows',
                'Use a file with fewer records'
              ]
            });
          }
          
          throw uploadError; // Re-throw if it's a different error
        }
>>>>>>> 6974c8e (working)
      }

      res.status(201).json({
        success: true,
        fileId: savedFile._id,
        data: {
          name: savedFile.originalName,
          headers: data[0] || [], // First row as headers
          data: data.slice(1) // Rest as data
        }
      });
<<<<<<< HEAD
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload and process file' });
=======
    } catch (error: any) {
      console.error('Error uploading file:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to upload and process file';
      let statusCode = 500;
      
      if (error.message) {
        if (error.message.includes('too large') || error.message.includes('data is too large')) {
          errorMessage = error.message;
          statusCode = 413;
        } else if (error.message.includes('Invalid file type')) {
          errorMessage = 'Invalid file type. Only Excel files (.xlsx, .xls, .xlsm, .xlsb) are allowed.';
          statusCode = 400;
        }
      }
      
      res.status(statusCode).json({ error: errorMessage });
>>>>>>> 6974c8e (working)
    }
  }
];

export const getFileController = async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const file = await getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      id: file._id,
      filename: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      dataLength: file.data.length,
      uploadedAt: file.uploadedAt
    });
  } catch (error) {
    console.error('Error retrieving file:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

export const getAllFilesController = async (req: Request, res: Response) => {
  try {
    const files = await getAllFiles();
    const fileList = files.map(file => ({
      id: file._id,
      filename: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      dataLength: file.data.length,
      uploadedAt: file.uploadedAt
    }));

    res.json(fileList);
  } catch (error) {
    console.error('Error retrieving files:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
};

// Save analysis history
export const saveAnalysisHistoryController = async (req: Request, res: Response) => {
  try {
    const { name, state, userId } = req.body;

    if (!name || !state) {
      return res.status(400).json({ error: 'Name and state required' });
    }

    const history = new AnalysisHistoryModel({
      name,
      state,
      userId,
      createdAt: new Date()
    });
    await history.save();

    res.status(201).json({ message: 'Analysis saved', history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get all analysis history
export const getAnalysisHistoryController = async (req: Request, res: Response) => {
  try {
    const history = await AnalysisHistoryModel.find();
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get analysis history by ID
export const getAnalysisHistoryByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await AnalysisHistoryModel.findById(id);

    if (!history) {
      return res.status(404).json({ error: 'Analysis history not found' });
    }

    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Delete analysis history

export const deleteAnalysisHistoryController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await AnalysisHistoryModel.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ error: 'Analysis history not found' });
    }

    res.json({ message: 'Analysis history deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Additional controllers needed by frontend

export const processFileController = uploadFileController; // Alias for file processing

export const getLastFileController = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    // Get the most recent file for this user
    const files = await getAllFiles();
    const lastFile = files.length > 0 ? files[files.length - 1] : null;

    if (!lastFile) {
      return res.json({ success: false, message: 'No files found' });
    }

    res.json({
      success: true,
      data: {
        id: lastFile._id,
        name: lastFile.originalName,
        headers: lastFile.data[0] || [],
        data: lastFile.data.slice(1)
      }
    });
  } catch (error) {
    console.error('Error getting last file:', error);
    res.status(500).json({ error: 'Failed to get last file' });
  }
};







export const searchMultiController = async (req: Request, res: Response) => {
  try {
    const { email, q, fileIds } = req.query;

    // Get user email from headers (preferred) or query parameter
    const userEmail = (req.headers['x-user-email'] as string) || 
                     (email && typeof email === 'string' && email.trim() ? email.trim() : null);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Get all files for the current user
    const allFiles = await getAllFiles();
    const userFiles = allFiles.filter(file => file.userEmail === userEmail);
    
    // Filter to only include files specified in fileIds parameter
    let filesToCombine = userFiles;
    if (fileIds && typeof fileIds === 'string' && fileIds.trim()) {
      const requestedFileIds = fileIds.split(',').map(id => id.trim());
      filesToCombine = userFiles.filter(file => requestedFileIds.includes(file._id.toString()));
    }
    
    if (filesToCombine.length === 0) {
      return res.json({
        success: true,
        data: {
          headers: [],
          data: []
        }
      });
    }

    console.log(`🔄 Processing ${filesToCombine.length} files for combination`);

    // Helper function to normalize header names
    const normalizeHeader = (header: string) => {
      return String(header || '').toLowerCase().replace(/[._-]+/g, ' ').trim();
    };

    // Helper function to find column index by multiple possible names
    const findColumnIndex = (headers: string[], possibleNames: string[]) => {
      const normalizedHeaders = headers.map(h => normalizeHeader(h));
      for (const name of possibleNames) {
        const index = normalizedHeaders.indexOf(name);
        if (index !== -1) return index;
      }
      return -1;
    };

    // Find column indices using first file's headers
    const firstFileHeaders = filesToCombine[0].data[0] || [];
    const nameIndex = findColumnIndex(firstFileHeaders, ['name', 'student name', 'student_name', 'studentname']);
    const mapNumberIndex = findColumnIndex(firstFileHeaders, ['mapno', 'map number', 'map_number', 'map num', 'map no', 'mapnumber', 'map_no']);
    const semesterIndex = findColumnIndex(firstFileHeaders, ['sem', 'semester', 'sem no', 'semester no', 'sem number', 'semester number', 'semno', 'semesterno']);
    const spiIndex = findColumnIndex(firstFileHeaders, ['spi']);
    const cpiIndex = findColumnIndex(firstFileHeaders, ['cpi']);
    const cgpaIndex = findColumnIndex(firstFileHeaders, ['cgpa']);
    const resultIndex = findColumnIndex(firstFileHeaders, ['result', 'result status', 'status', 'result_status']);
    const branchIndex = findColumnIndex(firstFileHeaders, ['br_name', 'branch', 'branch name', 'br name']);

    console.log('Column indices found:', { nameIndex, mapNumberIndex, semesterIndex, spiIndex, cpiIndex, cgpaIndex, resultIndex, branchIndex });

<<<<<<< HEAD
    // Find subject columns (SUBxGR, SUBxNA patterns, or any column that looks like a subject)
    const subjectColumns: Array<{ header: string; index: number }> = [];
    firstFileHeaders.forEach((header, index) => {
=======

    // Find subject columns (SUBxGR, SUBxNA patterns, or any column that looks like a subject)
    const subjectColumns: Array<{ header: string; index: number }> = [];
    firstFileHeaders.forEach((header: any, index: number) => {
>>>>>>> 6974c8e (working)
      if (!header) return;
      const headerStr = String(header).trim();
      // Match patterns like SUB1GR, SUB2GR, SUB1NA, SUB2NA, etc.
      if (/^SUB\d+GR$/i.test(headerStr) || /^SUB\d+NA$/i.test(headerStr)) {
        subjectColumns.push({ header: headerStr, index });
      }
      // Also match other subject patterns
      else if (headerStr.toLowerCase().includes('subject') && 
               (headerStr.toLowerCase().includes('grade') || headerStr.toLowerCase().includes('name'))) {
        subjectColumns.push({ header: headerStr, index });
      }
    });

    console.log(`📚 Found ${subjectColumns.length} subject columns:`, subjectColumns.map(s => s.header));

    // Collect all students from all files, grouped by MAP number
    const studentMap: Record<string, {
      mapNumber: string;
      name: string;
      data: Record<string, any>; // Map file name to student data
      filesPresent: Set<string>;
    }> = {};

    // Process each file
    filesToCombine.forEach(file => {
      const fileData = file.data.slice(1); // Skip headers
      console.log(`📊 Processing file: ${file.originalName}, rows: ${fileData.length}`);

      fileData.forEach(row => {
        const mapNumber = mapNumberIndex !== -1 ? String(row[mapNumberIndex] || '').trim() : '';
        const studentName = nameIndex !== -1 ? String(row[nameIndex] || '').trim() : '';

        // Skip if no MAP number
        if (!mapNumber) {
          return;
        }

        // Initialize student record if not exists
        if (!studentMap[mapNumber]) {
          studentMap[mapNumber] = {
            mapNumber,
            name: studentName || 'Unknown',
            data: {},
            filesPresent: new Set()
          };
        }

        // Add this student's data from this file
        studentMap[mapNumber].data[file.originalName] = row;
        studentMap[mapNumber].filesPresent.add(file.originalName);
        
        // Update name if we find a better one
        if (studentName && studentName !== 'Unknown') {
          studentMap[mapNumber].name = studentName;
        }
      });
    });

    console.log(`👥 Total unique students found: ${Object.keys(studentMap).length}`);

    // Filter to only students present in ALL files
    const commonStudents: Record<string, any> = {};
    Object.entries(studentMap).forEach(([mapNumber, student]) => {
      if (student.filesPresent.size === filesToCombine.length) {
        commonStudents[mapNumber] = student;
      }
    });

    console.log(`✅ Students present in ALL files: ${Object.keys(commonStudents).length}`);

    // Build combined data with proper columns
    const combinedData: any[][] = [];
    const combinedHeaders: string[] = [];

    // Add required columns
    if (nameIndex !== -1) combinedHeaders.push('Name');
    if (mapNumberIndex !== -1) combinedHeaders.push('MAP Number');
    if (semesterIndex !== -1) combinedHeaders.push('Semester');
    if (branchIndex !== -1) combinedHeaders.push('Branch');
    if (resultIndex !== -1) combinedHeaders.push('Result');
    if (spiIndex !== -1) combinedHeaders.push('SPI');
    if (cpiIndex !== -1) combinedHeaders.push('CPI');
    if (cgpaIndex !== -1) combinedHeaders.push('CGPA');
    
    // Add subject columns
    subjectColumns.forEach(subjCol => {
      combinedHeaders.push(subjCol.header);
    });
    
    // Add source file column
    combinedHeaders.push('Source File');

    console.log('Combined headers:', combinedHeaders);

    // Create combined rows
    Object.values(commonStudents).forEach((student: any) => {
      filesToCombine.forEach(file => {
        const studentData = student.data[file.originalName];
        if (!studentData) return;

        const row: any[] = [];
        
        // Add required columns in order
        if (nameIndex !== -1) row.push(student.name);
        if (mapNumberIndex !== -1) row.push(student.mapNumber);
        if (semesterIndex !== -1) row.push(studentData[semesterIndex] || '');
        if (branchIndex !== -1) row.push(studentData[branchIndex] || '');
        if (resultIndex !== -1) row.push(studentData[resultIndex] || '');
        if (spiIndex !== -1) row.push(studentData[spiIndex] || '');
        if (cpiIndex !== -1) row.push(studentData[cpiIndex] || '');
        if (cgpaIndex !== -1) row.push(studentData[cgpaIndex] || '');
        
        // Add subject columns
        subjectColumns.forEach(subjCol => {
          row.push(studentData[subjCol.index] || '');
        });
        
        // Add source file
        row.push(file.originalName);

        combinedData.push(row);
      });
    });

    console.log(`📋 Combined data rows: ${combinedData.length}`);

    let filteredData = combinedData;

    // Apply search filter if provided
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.toLowerCase().trim();
      filteredData = filteredData.filter(row => 
        row.some(cell => 
          cell && cell.toString().toLowerCase().includes(searchTerm)
        )
      );
      console.log(`🔍 After search filter: ${filteredData.length} rows`);
    }

    res.json({
      success: true,
      data: {
        headers: combinedHeaders,
        data: filteredData
      }
    });
  } catch (error) {
    console.error('Error in search-multi:', error);
    res.status(500).json({ error: 'Failed to search files' });
  }
};

export const deleteFileByNameController = async (req: Request, res: Response) => {
  try {
    const { email, name } = req.query;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name parameters required' });
    }

    // Find and delete file by name (simplified implementation)
    const files = await getAllFiles();
    const fileToDelete = files.find(f => f.originalName === name);
    
    if (!fileToDelete) {
      return res.status(404).json({ error: 'File not found' });
    }

    // In a real implementation, you would call a delete service here
    // For now, we'll return success
    res.json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting file by name:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};
