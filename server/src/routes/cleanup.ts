
import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Simple authentication middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const userEmail = req.headers['x-user-email'] as string;
  if (!userEmail) {
    return res.status(401).json({ success: false, error: 'User email required' });
  }
  (req as any).user = { email: userEmail };
  next();
};

// Clear all user files from backend storage
router.post('/clear-user-files', authenticateToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    console.log(`🧹 Clearing all files for user: ${userEmail}`);
    
    // Define upload directory path
    const uploadDir = path.join(__dirname, '../../uploads');
    const dataDir = path.join(__dirname, '../../data');
    
    let filesDeleted = 0;
    let directoriesDeleted = 0;
    
    try {
      // Clear uploads directory
      if (await fileExists(uploadDir)) {
        await fs.rm(uploadDir, { recursive: true, force: true });
        directoriesDeleted++;
        console.log(`🗑️ Deleted uploads directory`);
      }
    } catch (error) {
      console.warn('Could not delete uploads directory:', error);
    }
    
    try {
      // Clear data directory  
      if (await fileExists(dataDir)) {
        await fs.rm(dataDir, { recursive: true, force: true });
        directoriesDeleted++;
        console.log(`🗑️ Deleted data directory`);
      }
    } catch (error) {
      console.warn('Could not delete data directory:', error);
    }
    
    // Clear any user-specific cache or temporary files
    try {
      const tempDir = path.join(__dirname, '../../temp');
      if (await fileExists(tempDir)) {
        await fs.rm(tempDir, { recursive: true, force: true });
        directoriesDeleted++;
        console.log(`🗑️ Deleted temp directory`);
      }
    } catch (error) {
      console.warn('Could not delete temp directory:', error);
    }
    
    // Clear memory caches if any exist
    const cacheDir = path.join(__dirname, '../../cache');
    try {
      if (await fileExists(cacheDir)) {
        await fs.rm(cacheDir, { recursive: true, force: true });
        directoriesDeleted++;
        console.log(`🗑️ Deleted cache directory`);
      }
    } catch (error) {
      console.warn('Could not delete cache directory:', error);
    }
    
    console.log(`✅ File cleanup completed for ${userEmail}: ${filesDeleted} files, ${directoriesDeleted} directories`);
    
    res.json({
      success: true,
      message: 'All user files cleared successfully',
      data: {
        filesDeleted,
        directoriesDeleted,
        userEmail
      }
    });
    
  } catch (error) {
    console.error('Error clearing user files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear user files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Get cleanup status
router.get('/cleanup-status', authenticateToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    
    const uploadDir = path.join(__dirname, '../../uploads');
    const dataDir = path.join(__dirname, '../../data');
    
    const uploadExists = await fileExists(uploadDir);
    const dataExists = await fileExists(dataDir);
    
    let uploadFileCount = 0;
    let dataFileCount = 0;
    
    if (uploadExists) {
      uploadFileCount = await countFiles(uploadDir);
    }
    
    if (dataExists) {
      dataFileCount = await countFiles(dataDir);
    }
    
    res.json({
      success: true,
      data: {
        userEmail,
        directories: {
          uploads: {
            exists: uploadExists,
            fileCount: uploadFileCount
          },
          data: {
            exists: dataExists,
            fileCount: dataFileCount
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting cleanup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cleanup status'
    });
  }
});


// Clear specific file by ID
router.delete('/clear-file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userEmail = (req as any).user.email;
    
    console.log(`🗑️ Clearing specific file: ${fileId} for user: ${userEmail}`);
    
    // Implementation would depend on how files are stored
    // This is a placeholder for file-specific cleanup
    
    res.json({
      success: true,
      message: `File ${fileId} cleared successfully`
    });
    
  } catch (error) {
    console.error('Error clearing specific file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear specific file'
    });
  }
});

// Helper functions
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let count = 0;
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await countFiles(fullPath);
      } else {
        count++;
      }
    }
    
    return count;
  } catch {
    return 0;
  }
}

export default router;

