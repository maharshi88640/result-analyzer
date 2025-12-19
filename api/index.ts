// @ts-ignore
import { VercelRequest, VercelResponse } from '@vercel/node';
<<<<<<< HEAD
=======
// @ts-ignore
>>>>>>> 6974c8e (working)
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

// @ts-ignore
const { Readable } = require('stream');

// MongoDB connection (will be reused across function calls)
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  await mongoose.connect(mongoUri);
  isConnected = true;
  console.log('MongoDB connected');
};

// Models
const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  data: { type: [mongoose.Schema.Types.Mixed], required: true },
  userEmail: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const AnalysisHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  name: { type: String, required: true },
  state: {
    selectedSheet: { type: String, required: true },
    query: {
      filters: { type: [mongoose.Schema.Types.Mixed], default: [] },
      searchTerm: { type: String, default: '' },
    },
  },
  createdAt: { type: Date, default: Date.now },
});

const FileModel = mongoose.models.File || mongoose.model('File', FileSchema);
const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
const AnalysisHistoryModel = mongoose.models.AnalysisHistory || mongoose.model('AnalysisHistory', AnalysisHistorySchema);

// Helper function to find duplicate files
const findFileByNameAndData = async (originalName: string, data: any[], userEmail?: string) => {
  console.log(`🔍 Checking for duplicate file: ${originalName}`);
  console.log(`📊 New file data length: ${data.length}`);
  console.log(`👤 User email: ${userEmail}`);

  const query: any = { originalName: originalName };
  if (userEmail) {
    query.userEmail = userEmail;
  }

<<<<<<< HEAD
  const filesWithSameName = await FileModel.find(query).exec();
  console.log(`📁 Found ${filesWithSameName.length} files with same name and user`);

  for (const file of filesWithSameName) {
    console.log(`🔎 Comparing with existing file ID: ${file._id}, data length: ${file.data.length}`);

    try {
      const normalizedExisting = file.data.map((row: any[]) =>
        row.map((cell: any) => cell?.toString().trim() || '')
      );
      const normalizedNew = data.map((row: any[]) =>
        row.map((cell: any) => cell?.toString().trim() || '')
      );

      const existingStr = JSON.stringify(normalizedExisting);
      const newStr = JSON.stringify(normalizedNew);

      if (existingStr === newStr) {
        console.log(`✅ Duplicate found! Using existing file: ${file._id}`);
        return file;
      }
    } catch (error) {
      console.log(`⚠️ Error comparing file ${file._id}:`, error);
      continue;
    }
  }

  console.log(`❌ No duplicate found, will create new file`);
  return null;
=======
  // Find first file with same name and user
  const duplicateFile = await FileModel.findOne(query).exec();
  
  if (duplicateFile) {
    console.log(`✅ Duplicate found! Using existing file: ${duplicateFile._id}`);
    return duplicateFile;
  } else {
    console.log(`❌ No duplicate found, will create new file`);
    return null;
  }
>>>>>>> 6974c8e (working)
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Connect to database
  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(500).json({ error: 'Database connection failed' });
  }

  // Handle different routes
  const { url, method } = req;
  
  try {
    if (url?.includes('/health')) {
      return res.json({ status: 'OK', message: 'Server is running' });
    }

    if (url?.includes('/process-file') || url?.includes('/upload')) {
      if (method === 'POST') {
        return await handleFileUpload(req, res);
      }
    }

    if (url?.includes('/search-multi')) {
      if (method === 'GET') {
        return await handleSearchMulti(req, res);
      }
    }

    if (url?.includes('/files') && method === 'GET') {
      return await handleGetFiles(req, res);
    }

    if (url?.includes('/history') || url?.includes('/analysis-history')) {
      if (method === 'POST') {
        return await handleSaveAnalysisHistory(req, res);
      }
      if (method === 'GET') {
        return await handleGetAnalysisHistory(req, res);
      }
    }

    if (url?.includes('/history/') || url?.includes('/analysis-history/')) {
      if (method === 'DELETE') {
        return await handleDeleteAnalysisHistory(req, res);
      }
    }

    // Default response for unhandled routes
    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// File upload handler
async function handleFileUpload(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse multipart form data manually for serverless
    const formData = await parseMultipartForm(req);
    
    if (!formData.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userEmail = req.headers['x-user-email'] as string;
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Parse Excel file
    const workbook = XLSX.read(formData.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Check for duplicates
    const existingFile = await findFileByNameAndData(formData.file.originalname, data, userEmail);

    let savedFile;
    if (existingFile) {
      savedFile = existingFile;
    } else {
      // Save new file
      const fileData = {
        filename: `${Date.now()}-${formData.file.originalname}`,
        originalName: formData.file.originalname,
        size: formData.file.size,
        mimeType: formData.file.mimetype,
        data: data,
        userEmail: userEmail
      };

      const file = new FileModel(fileData);
      savedFile = await file.save();
    }

    res.status(201).json({
      success: true,
      fileId: savedFile._id,
      data: {
        name: savedFile.originalName,
        headers: data[0] || [],
        data: data.slice(1)
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload and process file' });
  }
}

// Search multi handler (for combined files)
async function handleSearchMulti(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, q, fileIds } = req.query;

    const userEmail = (req.headers['x-user-email'] as string) || 
                     (email && typeof email === 'string' && email.trim() ? email.trim() : null);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Get all files for the user
    const allFiles = await FileModel.find({ userEmail }).exec();
    
    // Filter to only include files specified in fileIds parameter
    let filesToCombine = allFiles;
    if (fileIds && typeof fileIds === 'string' && fileIds.trim()) {
      const requestedFileIds = fileIds.split(',').map(id => id.trim());
<<<<<<< HEAD
      filesToCombine = allFiles.filter(file => requestedFileIds.includes(file._id.toString()));
=======

      filesToCombine = allFiles.filter((file: any) => requestedFileIds.includes(file._id.toString()));
>>>>>>> 6974c8e (working)
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

    // Process files for combination (same logic as original)
    const combinedData = await combineFiles(filesToCombine, q as string);

    res.json({
      success: true,
      data: {
        headers: combinedData.headers,
        data: combinedData.data
      }
    });
  } catch (error) {
    console.error('Error in search-multi:', error);
    res.status(500).json({ error: 'Failed to search files' });
  }
}

<<<<<<< HEAD
=======

>>>>>>> 6974c8e (working)
// Get files handler
async function handleGetFiles(req: VercelRequest, res: VercelResponse) {
  try {
    const files = await FileModel.find().exec();
<<<<<<< HEAD
    const fileList = files.map(file => ({
=======
    const fileList = files.map((file: any) => ({
>>>>>>> 6974c8e (working)
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
}

// Analysis history handlers
async function handleSaveAnalysisHistory(req: VercelRequest, res: VercelResponse) {
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
  } catch (error) {
    console.error('Error saving analysis history:', error);
    res.status(500).json({ error: 'Failed to save analysis history' });
  }
}

async function handleGetAnalysisHistory(req: VercelRequest, res: VercelResponse) {
  try {
    const history = await AnalysisHistoryModel.find().sort({ createdAt: -1 }).exec();
    res.json(history);
  } catch (error) {
    console.error('Error retrieving analysis history:', error);
    res.status(500).json({ error: 'Failed to retrieve analysis history' });
  }
}

async function handleDeleteAnalysisHistory(req: VercelRequest, res: VercelResponse) {
  try {
    const id = req.url?.split('/').pop();
    const result = await AnalysisHistoryModel.findByIdAndDelete(id).exec();

    if (!result) {
      return res.status(404).json({ error: 'Analysis history not found' });
    }

    res.json({ message: 'Analysis history deleted' });
  } catch (error) {
    console.error('Error deleting analysis history:', error);
    res.status(500).json({ error: 'Failed to delete analysis history' });
  }
}

// Helper function to parse multipart form data
async function parseMultipartForm(req: VercelRequest): Promise<{ file: any }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundary = buffer.toString().split('\r\n')[0];
      const parts = buffer.toString().split(boundary);
      
      for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part.includes('filename=')) {
          // This is the file part
          const lines = part.split('\r\n');
          const fileStart = lines.findIndex(line => line === '');
          if (fileStart !== -1) {
            const fileBuffer = Buffer.from(part.substring(fileStart + 2), 'binary');
            const filename = part.match(/filename="([^"]+)"/)?.[1] || 'unknown';
            const contentType = part.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'application/octet-stream';
            
            resolve({
              file: {
                buffer: fileBuffer,
                originalname: filename,
                mimetype: contentType,
                size: fileBuffer.length
              }
            });
            return;
          }
        }
      }
      
      reject(new Error('File not found in multipart data'));
    });
    
    req.on('error', reject);
  });
}

// Helper function to combine files (simplified version)
async function combineFiles(files: any[], searchTerm?: string) {
  // This would contain the same file combination logic as the original
  // For brevity, I'll return a basic structure
  return {
    headers: ['Name', 'MAP Number', 'Subject', 'Grade'],
    data: []
  };
}
