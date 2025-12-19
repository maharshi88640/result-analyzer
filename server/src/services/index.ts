import { UserModel, FileModel, AnalysisHistoryModel } from '../models';
import { IFile, IAnalysisHistory, IUser } from '../models';

export const createUser = async (userData: IUser): Promise<IUser> => {
  const user = new UserModel(userData);
  return await user.save();
};

export const getUserById = async (userId: string): Promise<IUser | null> => {
  return await UserModel.findById(userId).exec();
};

export const updateUser = async (userId: string, userData: Partial<IUser>): Promise<IUser | null> => {
  return await UserModel.findByIdAndUpdate(userId, userData, { new: true }).exec();
};

export const deleteUser = async (userId: string): Promise<IUser | null> => {
  return await UserModel.findByIdAndDelete(userId).exec();
};


<<<<<<< HEAD
=======


// Constants for MongoDB document size limits
const MAX_DOCUMENT_SIZE = 9 * 1024 * 1024; // 9MB
const CHUNK_THRESHOLD = 7 * 1024 * 1024; // 7MB (leave 2MB buffer)
const MAX_CHUNK_SIZE = 3 * 1024 * 1024; // 3MB per chunk

// Helper function to calculate approximate BSON size
const calculateBSONSize = (data: any[]): number => {
  try {
    // Rough estimation: JSON.stringify each row and add overhead
    return data.reduce((total, row) => {
      if (Array.isArray(row)) {
        const rowSize = row.reduce((rowTotal, cell) => {
          const cellSize = JSON.stringify(cell).length;
          return rowTotal + cellSize;
        }, 0);
        return total + rowSize + 100; // Add BSON overhead
      }
      return total + JSON.stringify(row).length + 100;
    }, 0);
  } catch (error) {
    console.warn('Failed to calculate BSON size, using estimate:', error);
    return data.length * 1000; // Rough estimate: 1KB per row
  }
};

// Helper function to split data into chunks
const chunkData = (data: any[]): any[][] => {
  const chunks: any[][] = [];
  let currentChunk: any[] = [];
  let currentSize = 0;

  for (const row of data) {
    const rowSize = JSON.stringify(row).length + 100; // Add BSON overhead
    
    if (currentSize + rowSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push([...currentChunk]);
      currentChunk = [];
      currentSize = 0;
    }
    
    currentChunk.push(row);
    currentSize += rowSize;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

>>>>>>> 6974c8e (working)
export const uploadFile = async (fileData: {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  data: any[];
  userEmail: string;
}): Promise<IFile> => {
<<<<<<< HEAD
  const file = new FileModel(fileData);
  return await file.save();
=======
  try {
    // Calculate the size of the data
    const dataSize = calculateBSONSize(fileData.data);
    
    console.log(`📊 File data analysis:`, {
      rows: fileData.data.length,
      estimatedSize: `${(dataSize / 1024 / 1024).toFixed(2)}MB`,
      isLarge: dataSize > CHUNK_THRESHOLD
    });

    // Prepare file data with metadata
    const preparedFileData = {
      ...fileData,
      dataSize,
      isChunked: dataSize > CHUNK_THRESHOLD
    };


    // Validate document size before saving
    if (dataSize > MAX_DOCUMENT_SIZE) {
      throw new Error(
        `File data is too large (${(dataSize / 1024 / 1024).toFixed(2)}MB). ` +
        `Maximum allowed size is ${(MAX_DOCUMENT_SIZE / 1024 / 1024).toFixed(0)}MB. ` +
        `Please split your Excel file into smaller files and try again.`
      );
    }

    const file = new FileModel(preparedFileData);
    return await file.save();
  } catch (error: any) {
    console.error('Error in uploadFile service:', error);
    

    // Handle specific BSON errors
    if (error.name === 'BSONError' || error.code === 10334) {
      throw new Error(
        'File data exceeds 9MB limit and is too large to store in database. Please split your Excel file into smaller files and try again.'
      );
    }
    
    throw error;
  }
>>>>>>> 6974c8e (working)
};

export const getFileById = async (fileId: string): Promise<IFile | null> => {
  return await FileModel.findById(fileId).exec();
};

export const getAllFiles = async (): Promise<IFile[]> => {
  return await FileModel.find().exec();
};

export const saveAnalysisHistory = async (historyData: {
  fileId: string;
  name: string;
  state: {
    selectedSheet: string;
    query: {
      filters: any[];
      searchTerm: string;
    };
  };
}): Promise<IAnalysisHistory> => {
  const history = new AnalysisHistoryModel(historyData);
  return await history.save();
};

export const getAnalysisHistory = async (fileId?: string): Promise<IAnalysisHistory[]> => {
  const query = fileId ? { fileId } : {};
  return await AnalysisHistoryModel.find(query).sort({ createdAt: -1 }).exec();
};

export const getAnalysisHistoryById = async (historyId: string): Promise<IAnalysisHistory | null> => {
  return await AnalysisHistoryModel.findById(historyId).exec();
};

export const deleteAnalysisHistory = async (historyId: string): Promise<IAnalysisHistory | null> => {
  return await AnalysisHistoryModel.findByIdAndDelete(historyId).exec();
};


<<<<<<< HEAD
=======

>>>>>>> 6974c8e (working)
export const findFileByNameAndData = async (originalName: string, data: any[], userEmail?: string): Promise<IFile | null> => {
  console.log(`🔍 Checking for duplicate file: ${originalName}`);
  console.log(`📊 New file data length: ${data.length}`);
  console.log(`👤 User email: ${userEmail}`);

  // Build query to find files with same name and user (if userEmail provided)
  const query: any = { originalName: originalName };
  if (userEmail) {
    query.userEmail = userEmail;
  }

<<<<<<< HEAD
  // Get all files with the same name and user
  const filesWithSameName = await FileModel.find(query).exec();
  console.log(`📁 Found ${filesWithSameName.length} files with same name and user`);

  // Check each file's data for exact match
  for (const file of filesWithSameName) {
    console.log(`🔎 Comparing with existing file ID: ${file._id}, data length: ${file.data.length}`);

    try {
      // Normalize data for comparison (trim strings, handle null/undefined)
      const normalizedExisting = file.data.map((row: any[]) =>
        row.map((cell: any) => cell?.toString().trim() || '')
      );
      const normalizedNew = data.map((row: any[]) =>
        row.map((cell: any) => cell?.toString().trim() || '')
      );

      const existingStr = JSON.stringify(normalizedExisting);
      const newStr = JSON.stringify(normalizedNew);

      console.log(`📏 Existing data hash length: ${existingStr.length}`);
      console.log(`📏 New data hash length: ${newStr.length}`);

      if (existingStr === newStr) {
        console.log(`✅ Duplicate found! Using existing file: ${file._id}`);
        return file;
      } else {
        console.log(`❌ Data doesn't match, checking next file...`);
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
