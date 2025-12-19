
import { Router } from 'express';
import {
  uploadFileController,
  getFileController,
  getAllFilesController,
  saveAnalysisHistoryController,
  getAnalysisHistoryController,
  getAnalysisHistoryByIdController,
  deleteAnalysisHistoryController,
  processFileController,
  getLastFileController,
  searchMultiController,
  deleteFileByNameController
} from '../controllers/index';

import { signup, login } from '../controllers/authcontroller';

const router = Router();

// Auth routes
router.post('/signup', signup);
router.post('/login', login);

// File upload routes
router.post('/upload', uploadFileController);
// Frontend expects these endpoints
router.post('/process-file', uploadFileController);
router.post('/api/process-file', uploadFileController);

// File retrieval
router.get('/files', getAllFilesController);
router.get('/files/:id', getFileController);
router.get('/api/files/:id', getFileController); // Frontend alias

// Frontend-specific endpoints
router.get('/last-file', getLastFileController);
router.get('/api/last-file', getLastFileController); // Frontend expects this

router.get('/search-multi', searchMultiController);
router.get('/api/search-multi', searchMultiController); // Frontend expects this

router.delete('/files/by-name', deleteFileByNameController);
router.delete('/api/files/by-name', deleteFileByNameController); // Frontend expects this

// Analysis history routes
router.post('/analysis-history', saveAnalysisHistoryController);
router.get('/analysis-history', getAnalysisHistoryController);
router.get('/analysis-history/:id', getAnalysisHistoryByIdController);
router.delete('/analysis-history/:id', deleteAnalysisHistoryController);

// Frontend alias routes for analysis history
router.post('/history', saveAnalysisHistoryController);
router.get('/history', getAnalysisHistoryController);
router.get('/api/history', getAnalysisHistoryController);
router.get('/api/last-file', getLastFileController);
router.get('/api/search-multi', searchMultiController);
router.delete('/api/history/:id', deleteAnalysisHistoryController);
router.delete('/api/files/by-name', deleteFileByNameController);

export default router;
