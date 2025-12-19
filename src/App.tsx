import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { FileSpreadsheet, LogOut, Upload, Table2, History as HistoryIcon, Menu as MenuIcon, X as XIcon } from 'lucide-react';
import { useMemoryManagement } from './hooks/useMemoryManagement';
import { AnalysisSidebar } from './components/AnalysisSidebar';
import { FileUpload } from './components/FileUpload';
import { SheetSelector } from './components/SheetSelector';
import { FileManager } from './components/FileManager';
import { QueryBuilder } from './components/QueryBuilder';
import { EnhancedDataTable } from './components/EnhancedDataTable';
import DetentionAnalysis from './components/DetentionAnalysis';
import GradeDistributionAnalysis from './components/GradeDistributionAnalysis';
import { SemesterSelector } from './components/SemesterSelector';
import { YearSelector } from './components/YearSelector';
import { BranchSelector } from './components/BranchSelector';
import { processData } from './utils/dataProcessor';
import { User, AnalysisHistory, QueryConfig } from './types';
import Login from './components/auth/Login';
import { emergencyMemoryReset, quickMemoryReset } from './utils/memoryReset';

interface ExcelFile {
  name: string;
  sheets: Array<{
    name: string;
    headers: string[];
    data: any[][];
  }>;
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}


function AppContent() {
  // Memory management - only trigger cleanup on out-of-heap memory errors
  const { getMemoryStats } = useMemoryManagement({
    enableCleanup: false, // Disable automatic cleanup
    enableMonitoring: false, // We'll implement our own monitoring
  });
  
  const [user, setUser] = useState<User | null>(null);
  const [currentFile, setCurrentFile] = useState<ExcelFile | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [query, setQuery] = useState<QueryConfig>({
    filters: [],
    searchTerm: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gradeRanges, setGradeRanges] = useState<{ spi: { min: number; max: number }; cpi: { min: number; max: number }; cgpa: { min: number; max: number } } | undefined>(undefined);
  const [loadTick, setLoadTick] = useState(0);


  const [isCombinedView, setIsCombinedView] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [combinedFileNames, setCombinedFileNames] = useState<string[]>([]);

  const [includedSources, setIncludedSources] = useState<string[] | undefined>(undefined);
  const [excludedSources, setExcludedSources] = useState<string[]>([]);




  const [selectedSem, setSelectedSem] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<'all' | '1' | '2' | '3' | '4'>('all');

  const [selectedSemesters, setSelectedSemesters] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  

  // Analysis view state for sidebar navigation
  const [currentAnalysisView, setCurrentAnalysisView] = useState<string>('data-table');
  
  // Auto-select first branch when grade analysis is accessed
  const handleAnalysisViewChange = (view: string) => {
    setCurrentAnalysisView(view);
    
    // If switching to grade analysis and no branch is selected, auto-select the first available branch
    if (view === 'grade-analysis' && !selectedBranch && currentSheet?.data?.length > 0 && currentSheet.headers) {
      const branchIdx = currentSheet.headers.findIndex(h => 
        h.toLowerCase().includes('branch') || h.toLowerCase().includes('dept') || h.toLowerCase().includes('department')
      );
      
      if (branchIdx !== -1) {
        const branches = Array.from(new Set(
          currentSheet.data
            .map(row => row[branchIdx])
            .filter(Boolean)
        ));
        
        if (branches.length > 0) {
          setSelectedBranch(String(branches[0]));
        }
      }
    }
  };



  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uploadCompleteRef = useRef(false);
  const autoLoadOnceRef = useRef(false);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadTickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [originalFile, setOriginalFile] = useState<ExcelFile | null>(null);

  // Centralized API base
  const API_BASE = 'http://localhost:5002';

  // Helpers to read auth context safely
  const getEmailHeader = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      return u?.email || '';
    } catch { return ''; }
  };
  const getAuthToken = () => {
    try { return localStorage.getItem('token') || ''; } catch { return ''; }
  };



  // Extract filename from exam data - use the actual exam column data as filename
  const extractFilenameFromData = (data: any[][], headers: string[]) => {
    if (!data || data.length === 0 || !headers) return null;
    
    // Look for exact "exam" column (not partial matches)
    const examColumnIndex = headers.findIndex(header => {
      const name = (header || '').toString().toLowerCase().trim();
      return name === 'exam'; // Exact match only
    });
    
    if (examColumnIndex === -1) return null;
    
    // Get the actual exam data from the first row
    const firstRow = data[0];
    if (!firstRow || !firstRow[examColumnIndex]) return null;
    
    const examValue = String(firstRow[examColumnIndex] || '').trim();
    if (!examValue) return null;
    
    // Return the actual exam data as the filename
    return examValue;
  };

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {

      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
      } catch (error) {
        console.log('Failed to parse user data:', error);
      }
    }
  }, []);







  // Clear combined files state on user change (disable auto-restore)
  useEffect(() => {
    if (!user || !user.email) return;
    
    // Clear any previously saved combined state to avoid duplicates
    localStorage.removeItem('combinedFileIds');
    localStorage.removeItem('combinedFileNames');
    setSelectedFileIds([]);
    setCombinedFileNames([]);
    setIsCombinedView(false);

  }, [user]);




  // Removed auto-load mechanism - users will manually load data when needed
  // Previous auto-load logic removed to prevent automatic refreshing
  // Note: Auto-load disabled for better user control


  // Memory monitoring - only trigger cleanup on out-of-heap memory errors
  useEffect(() => {
    let memoryCheckInterval: NodeJS.Timeout;
    let memoryWarningShown = false;

    const checkMemory = async () => {
      try {
        const stats = getMemoryStats();
        if (stats) {
          const heapUsedMB = stats.heapUsed / 1024 / 1024;
          const heapTotalMB = stats.heapTotal / 1024 / 1024;
          
          // Check for out-of-heap memory errors (very high usage)
          if (heapUsedMB > 500 && !memoryWarningShown) { // 500MB threshold
            memoryWarningShown = true;
            console.warn(`🚨 High memory usage detected: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB`);
            
            // Automatically trigger memory cleanup
            console.log('🧹 Auto-triggering memory cleanup due to high usage...');
            try {
              const result = await quickMemoryReset();
              console.log('Auto cleanup completed:', result);
              alert(`Memory cleanup performed automatically due to high usage (${heapUsedMB.toFixed(1)}MB)\nFreed: ${(result.freedMemory / 1024 / 1024).toFixed(1)}MB`);
            } catch (error) {
              console.error('Auto cleanup failed:', error);
            }
          }
          
          // Reset warning flag if memory usage drops
          if (heapUsedMB < 200) {
            memoryWarningShown = false;
          }
        }
      } catch (error) {
        console.warn('Memory check failed:', error);
      }
    };

    // Check memory every 30 seconds when user is active
    memoryCheckInterval = setInterval(checkMemory, 30000);
    
    // Initial check
    checkMemory();

    return () => {
      if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
      }
    };
  }, [getMemoryStats, quickMemoryReset]);

  // Cleanup all timeout references on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      if (loadTickTimeoutRef.current) {
        clearTimeout(loadTickTimeoutRef.current);
        loadTickTimeoutRef.current = null;
      }
    };
  }, []);


  // Helper function to fetch and update combined data
  const fetchAndUpdateCombinedData = useCallback(async (fileIds?: string[]) => {
    try {
      setIsLoading(true);
      const email = getEmailHeader();
      const token = getAuthToken();
      
      let url = email 
        ? `${API_BASE}/api/search-multi?email=${encodeURIComponent(email)}&q=`
        : `${API_BASE}/api/search-multi?q=`;
        
      const idsToUse = fileIds || selectedFileIds;
      if (idsToUse.length > 0) {
        url += `&fileIds=${idsToUse.join(',')}`;
      }
        
      const resp = await fetch(url, {
        headers: {
          'x-user-email': email,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (resp.ok) {
        const payload = await resp.json();
        if (payload?.success && payload?.data) {
          const combined: ExcelFile = {
            name: 'Combined',
            sheets: [{ name: 'Combined', headers: payload.data.headers || [], data: payload.data.data || [] }],
          };
          setCurrentFile(combined);
          setSelectedSheet('Combined');
          setIsCombinedView(true);
        }
      }
    } catch (error) {
      console.error('Failed to load combined data:', error);
      setDataError('Failed to load combined data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFileIds, API_BASE]);

  // Memory reset handlers
  const handleQuickReset = useCallback(async () => {
    try {
      setIsResetting(true);
      console.log('🧹 Performing quick memory reset...');
      
      const result = await quickMemoryReset();
      console.log('Quick reset completed:', result);
      
      // Show success message
      alert(`Memory reset completed!\nFreed: ${(result.freedMemory / 1024 / 1024).toFixed(2)}MB\nActions: ${result.actionsPerformed.length}`);
    } catch (error) {
      console.error('Error during quick reset:', error);
      alert('Error during memory reset. Check console for details.');
    } finally {
      setIsResetting(false);
    }
  }, []);

  const handleEmergencyReset = useCallback(async () => {
    const confirmed = confirm(
      'This will perform an EMERGENCY memory reset and clear ALL data (including localStorage).\n\n' +
      'This action will:\n' +
      '• Clear all memory and storage\n' +
      '• Reset application state\n' +
      '• Require you to log in again\n\n' +
      'Are you sure you want to continue?'
    );
    
    if (!confirmed) return;
    
    try {
      setIsResetting(true);
      console.log('🚨 Starting emergency memory reset...');
      
      const result = await emergencyMemoryReset();
      console.log('Emergency reset completed:', result);
      
      // Clear user session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      
      // Navigate to login
      navigate('/login');
      
      alert(`Emergency memory reset completed!\nFreed: ${(result.freedMemory / 1024 / 1024).toFixed(2)}MB\nActions performed: ${result.actionsPerformed.join(', ')}`);
    } catch (error) {
      console.error('Error during emergency reset:', error);
      alert('Error during emergency reset. The page will reload to ensure a clean state.');
      window.location.reload();
    }

  }, [navigate]);

  // Keyboard shortcut for quick memory reset (Ctrl+Shift+R)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+R for quick memory reset
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        handleQuickReset();
      }
      // Ctrl+Shift+E for emergency memory reset
      if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        handleEmergencyReset();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleQuickReset, handleEmergencyReset]);

  const handleFileUpload = useCallback(async (file: File) => {
    console.log('[Upload] start', { name: file?.name, size: file?.size });
    
    try {
      setUploadError(null);
      setIsLoading(true);
      setIsUploading(true);
      setDataError(null); // Clear any previous data errors


      // Clear previous data
      setCurrentFile(null);
      setSelectedSheet('');
      setSelectedBranch(null);
      setGradeRanges(undefined);
      setSelectedSubject('');
      setQuery({ filters: [], searchTerm: '' });
      setIsCombinedView(false);
      setIncludedSources(undefined);
      setExcludedSources([]);
      setSelectedFileIds([]);
      setCombinedFileNames([]);
      setSelectedSemesters([]);
      
      // Clear combined file data from localStorage
      localStorage.removeItem('combinedFileIds');
      localStorage.removeItem('combinedFileNames');

      console.log('[Upload] Data cleared, starting upload process');

      // Health check
      try {
        const health = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
        if (!health.ok) {
          throw new Error(`Backend health check failed (${health.status})`);
        }
        console.log('[Upload] Health check passed');
      } catch (e: any) {
        throw new Error('Server is not reachable. Please start the backend on port 5002 and retry.');
      }

      // Create FormData and upload
      const formData = new FormData();
      formData.append('file', file);

      const emailHeader = getEmailHeader();
      const authToken = getAuthToken();
      
      console.log('[Upload] Sending file to server...');

      const response = await fetch(`${API_BASE}/api/process-file`, {
        method: 'POST',
        headers: {
          'x-user-email': emailHeader,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: formData,
      });

      console.log('[Upload] Server response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Upload] Server error:', errorData);
        throw new Error(errorData.error || `Upload failed (${response.status})`);
      }

      const result = await response.json();
      console.log('[Upload] Server result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process file');
      }

      // Convert backend response to frontend format
      const parsedFile: ExcelFile = {
        name: result.data.name,
        sheets: [{
          name: 'Sheet1',
          headers: result.data.headers,
          data: result.data.data
        }]
      };

      // Try to extract filename from exam data
      const extractedFilename = extractFilenameFromData(result.data.data, result.data.headers);
      if (extractedFilename) {
        parsedFile.name = extractedFilename;
      }

      console.log('[Upload] Setting file data:', {
        name: parsedFile.name,
        headers: parsedFile.sheets[0].headers?.length,
        dataRows: parsedFile.sheets[0].data?.length
      });

      // Set the uploaded file as current
      setCurrentFile(parsedFile);
      setCurrentFileId(result.fileId || result.data?.id || null);
      setSelectedSheet('Sheet1');


      // Keep original file reference for potential restoration
      setOriginalFile(parsedFile);

      // Mark upload as complete
      uploadCompleteRef.current = true;
      
      console.log('[Upload] File data set, navigating to /data');
      


      // Navigate to data page after successful upload
      navigate('/data', { replace: true });
      
      // Ensure data is loaded by triggering a small delay and refresh
      // Clear any existing timeout first
      if (loadTickTimeoutRef.current) {
        clearTimeout(loadTickTimeoutRef.current);
      }
      
      loadTickTimeoutRef.current = setTimeout(() => {
        setLoadTick(prev => prev + 1); // Force refresh components
      }, 100);

    } catch (error) {
      console.error('[Upload] Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload the Excel file. Please try again.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      
      // Cleanup timeout references
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      if (loadTickTimeoutRef.current) {
        clearTimeout(loadTickTimeoutRef.current);
        loadTickTimeoutRef.current = null;
      }
    }
  }, [navigate]);



  const handleAddFile = useCallback(async (file: File) => {

    try { console.log('[Add file] start', { name: file?.name, size: file?.size }); } catch (error) { console.log('Add file logging failed:', error); }
    
    try {
      setUploadError(null);
      setIsLoading(true);
      setIsUploading(true);

      // Health check
      try {
        const health = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
        if (!health.ok) {
          throw new Error(`Backend health check failed (${health.status})`);
        }
      } catch (e: any) {
        throw new Error('Server is not reachable. Please start the backend on port 5002 and retry.');
      }

      // Create FormData and upload
      const formData = new FormData();
      formData.append('file', file);

      const emailHeader = getEmailHeader();
      const authToken = getAuthToken();

      const response = await fetch(`${API_BASE}/api/process-file`, {
        method: 'POST',
        headers: {
          'x-user-email': emailHeader,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed (${response.status})`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to process file');
      }






      // Extract filename from exam data for combined view
      const extractedFilename = extractFilenameFromData(result.data.data, result.data.headers);
      const fileNameForCombined = extractedFilename || result.data.name;
      
      // Check for duplicates based on email + file name (removed hash-based checking)
      const email = getEmailHeader();
      const isDuplicate = combinedFileNames.some(existingName => 
        existingName === fileNameForCombined
      );
      
      console.log(`[Add file] File ${file.name}: Email=${email}, Name=${fileNameForCombined}, isDuplicate=${isDuplicate}`);
      
      if (isDuplicate) {
        setUploadError(`File "${fileNameForCombined}" is already in your combined analysis and was ignored.`);
        return;
      }
      
      // Only add if it's not a duplicate
      const newFileIds = [...selectedFileIds, result.fileId];
      const newFileNames = [...combinedFileNames, fileNameForCombined];
      
      console.log(`[Add file] Adding new file: ${newFileIds.length} files total`);
      
      setSelectedFileIds(newFileIds);
      setCombinedFileNames(newFileNames);
      
      // Save to localStorage
      localStorage.setItem('combinedFileIds', JSON.stringify(newFileIds));
      localStorage.setItem('combinedFileNames', JSON.stringify(newFileNames));

      // Switch to combined view and fetch combined data
      setIsCombinedView(true);
      setIncludedSources(undefined); // Reset to show all sources by default
      setExcludedSources([]);


      // Navigate to data page and fetch combined data
      if (location.pathname !== '/data') {
        navigate('/data', { replace: true });
      }
      
      // Automatically fetch combined data with proper cleanup
      // Clear any existing timeout first
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
      
      uploadTimeoutRef.current = setTimeout(() => {
        fetchAndUpdateCombinedData(newFileIds);
        setLoadTick(prev => prev + 1);
      }, 300);
      
      console.log('File added to combined view. Data will be loaded automatically.');

    } catch (error) {
      console.error('Error adding file:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to add the Excel file. Please try again.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }

  }, [navigate, location.pathname, selectedFileIds, combinedFileNames]);




  const handleAddFiles = useCallback(async (files: File[]) => {

    try { console.log('[Add files] start', { count: files.length, names: files.map(f => f.name) }); } catch (error) { console.log('Add files logging failed:', error); }
    
    try {
      setUploadError(null);
      setIsLoading(true);
      setIsUploading(true);

      // Health check
      try {
        const health = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
        if (!health.ok) {
          throw new Error(`Backend health check failed (${health.status})`);
        }
      } catch (e: any) {
        throw new Error('Server is not reachable. Please start the backend on port 5002 and retry.');
      }

      // Upload all files sequentially and append to existing files
      const emailHeader = getEmailHeader();
      const authToken = getAuthToken();
      const uploadResults: Array<{ fileId: string; fileName: string; isNew: boolean }> = [];

      for (const file of files) {
        console.log(`[Add files] Processing file: ${file.name}`);
        
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/api/process-file`, {
          method: 'POST',
          headers: {
            'x-user-email': emailHeader,
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed for ${file.name} (${response.status})`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Failed to process file: ${file.name}`);
        }

        // Extract filename from exam data for combined view
        const extractedFilename = extractFilenameFromData(result.data.data, result.data.headers);
        const fileNameForCombined = extractedFilename || result.data.name;
        
        // Check for duplicates based on email + file name (removed hash-based checking)
        const email = getEmailHeader();
        const isDuplicate = combinedFileNames.some(existingName => 
          existingName === fileNameForCombined
        );
        
        uploadResults.push({
          fileId: result.fileId,
          fileName: fileNameForCombined,
          isNew: !isDuplicate
        });
        
        console.log(`[Add files] File ${file.name}: Email=${email}, Name=${fileNameForCombined}, isNew=${!isDuplicate}`);
      }

      // Only add NEW files to the combined lists (ignore duplicates)
      const newFileIds = uploadResults.filter(result => result.isNew).map(result => result.fileId);
      const newFileNames = uploadResults.filter(result => result.isNew).map(result => result.fileName);
      
      const duplicatesCount = uploadResults.filter(result => !result.isNew).length;
      const newFilesCount = newFileIds.length;
      
      console.log(`[Add files] Summary: ${newFilesCount} new files, ${duplicatesCount} duplicates ignored`);
      
      // Show feedback to user
      if (duplicatesCount > 0) {
        setUploadError(`Added ${newFilesCount} new file(s). Ignored ${duplicatesCount} duplicate file(s).`);
      }

      // Combine new files with existing ones, ensuring no duplicates
      const existingFileIds = [...selectedFileIds];
      const existingFileNames = [...combinedFileNames];
      
      // Add only new files that aren't already in the existing arrays
      const finalFileIds = [...existingFileIds];
      const finalFileNames = [...existingFileNames];
      
      newFileIds.forEach((newId, index) => {
        if (!finalFileIds.includes(newId)) {
          finalFileIds.push(newId);
          if (index < newFileNames.length) {
            finalFileNames.push(newFileNames[index]);
          }
        }
      });
      
      console.log(`[Add files] Final state: ${finalFileIds.length} files total`);
      
      setSelectedFileIds(finalFileIds);
      setCombinedFileNames(finalFileNames);
      
      // Save to localStorage
      localStorage.setItem('combinedFileIds', JSON.stringify(finalFileIds));
      localStorage.setItem('combinedFileNames', JSON.stringify(finalFileNames));

      // Switch to combined view and fetch combined data
      setIsCombinedView(true);
      setIncludedSources(undefined); // Reset to show all sources by default
      setExcludedSources([]);

      // Navigate to data page and fetch combined data
      if (location.pathname !== '/data') {
        navigate('/data', { replace: true });
      }
      
      // Automatically fetch combined data after adding files with proper cleanup
      // Clear any existing timeout first
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
      
      uploadTimeoutRef.current = setTimeout(() => {
        fetchAndUpdateCombinedData(finalFileIds);
        setLoadTick(prev => prev + 1);
      }, 500);

    } catch (error) {
      console.error('Error adding files:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to add the Excel files. Please try again.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  }, [navigate, location.pathname, selectedFileIds, combinedFileNames]);

  const currentSheet = useMemo(() => {
    if (!currentFile?.sheets || !selectedSheet) return null;
    return currentFile.sheets.find(sheet => sheet.name === selectedSheet) || null;
  }, [currentFile, selectedSheet]);






  // Remove auto-fetch - users will manually trigger data refresh when needed
  // Duplicate detection now uses email + filename only (no hash checking)


  const processedData = useMemo(() => {
    if (!currentSheet) return [];
    
    // First apply semester filtering
    let filteredData = currentSheet.data;
    if (selectedSemesters.length > 0 && currentSheet.headers) {
      const semesterHeaderCandidates = [
        'sem', 'semester', 'sem no', 'semester no', 'sem number', 'semester number', 
        'semno', 'semesterno', 'semester_number'
      ];
      
      const semIndex = currentSheet.headers.findIndex(header => {
        if (!header) return false;
        const normalizedHeader = header.toString().toLowerCase().trim();
        return semesterHeaderCandidates.includes(normalizedHeader) || 
               normalizedHeader.startsWith('sem') ||
               normalizedHeader.includes('semester');
      });
      
      if (semIndex !== -1) {
        filteredData = currentSheet.data.filter(row => {
          if (!row || row[semIndex] === null || row[semIndex] === undefined) return false;
          const semValue = row[semIndex].toString().trim();
          if (!semValue) return false;
          
          // Extract numeric part and normalize semester format
          const numericMatch = semValue.match(/\d+/);
          if (numericMatch) {
            const semesterNum = parseInt(numericMatch[0], 10);
            const normalizedSemester = `Semester ${semesterNum}`;
            return selectedSemesters.includes(normalizedSemester);
          } else {
            // For non-numeric values, check exact match
            return selectedSemesters.includes(semValue);
          }
        });
      }
    }
    
    // Then apply other filters and processing
    return processData(filteredData, currentSheet.headers, query);
  }, [currentSheet, query, selectedSemesters]);

  const handleDataChange = (newData: any[][]) => {
    if (!currentFile) return;
    
    const updatedSheets = currentFile.sheets.map(sheet => 
      sheet.name === selectedSheet 
        ? { ...sheet, data: newData }
        : sheet
    );
    
    setCurrentFile({ ...currentFile, sheets: updatedSheets });
  };

  const handleQueryChange = (queryUpdate: Partial<QueryConfig>) => {
    setQuery(prev => ({
      filters: queryUpdate.filters ?? prev.filters,
      searchTerm: queryUpdate.searchTerm ?? prev.searchTerm,
    }));
  };

  const saveAnalysisState = useCallback(async (name: string) => {
    if (!currentFileId || !selectedSheet) return;

    try {
      const response = await fetch(`${API_BASE}/api/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: currentFileId,
          name,
          state: {
            selectedSheet,
            query,
            selectedBranch,
            gradeRanges,
            selectedSubject,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save analysis state');
      }

      await response.json();
      loadAnalysisHistory();
    } catch (error) {
      console.error('Error saving analysis state:', error);
    }
  }, [currentFileId, selectedSheet, query, selectedBranch, gradeRanges, selectedSubject]);

  // Debounced autosave
  useEffect(() => {
    if (!currentFileId || !selectedSheet) return;

    const hasSearch = (() => {
      const term = (query.searchTerm || '').trim();
      if (term) return true;
      const aliases = ['name','student name','mapno','map_number','map num','mapnumber','map no'];
      const f = (query.filters || []).find(flt =>
        aliases.includes(String(flt.column || '').toLowerCase()) && String(flt.value ?? '').trim() !== ''
      );
      return Boolean(f);
    })();

    if (!selectedBranch && !hasSearch) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      const name = `Autosave - ${new Date().toLocaleString()}`;
      saveAnalysisState(name).catch(() => {});
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentFileId, selectedSheet, query, selectedBranch]);

  const loadAnalysisHistory = useCallback(async () => {
    if (!currentFileId) return;

    try {
      const response = await fetch(`${API_BASE}/api/history?fileId=${currentFileId}`);
      if (!response.ok) {
        throw new Error('Failed to load analysis history');
      }

      const history = await response.json();
      setAnalysisHistory(history);
    } catch (error) {
      console.error('Error loading analysis history:', error);
    }
  }, [currentFileId]);

  const loadAnalysisState = useCallback((historyItem: AnalysisHistory) => {
    setSelectedSheet(historyItem.state.selectedSheet);
    setQuery(historyItem.state.query);
    if (Object.prototype.hasOwnProperty.call(historyItem.state, 'selectedBranch')) {
      setSelectedBranch(historyItem.state.selectedBranch || null);
    }
    if (historyItem.state.gradeRanges) {
      setGradeRanges(historyItem.state.gradeRanges);
    } else {
      setGradeRanges(undefined);
    }
    if (Object.prototype.hasOwnProperty.call(historyItem.state, 'selectedSubject')) {
      setSelectedSubject(historyItem.state.selectedSubject || '');
    }
    setShowHistory(false);
    setTimeout(() => setLoadTick(t => t + 1), 0);
  }, []);

  const deleteAnalysisHistory = useCallback(async (historyId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/history/${historyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete analysis history');
      }

      loadAnalysisHistory();
    } catch (error) {
      console.error('Error deleting analysis history:', error);
      alert('Failed to delete analysis history');
    }
  }, [loadAnalysisHistory]);


  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentFile(null);
    setCurrentFileId(null);
    setSelectedSheet('');
    setQuery({ filters: [], searchTerm: '' });
    setAnalysisHistory([]);
    uploadCompleteRef.current = false;
    autoLoadOnceRef.current = false;
    navigate('/');
  }, [navigate]);




  // Handle removing a file from combined analysis
  const handleRemoveFileFromCombined = useCallback(async (fileName: string) => {
    try {
      // Remove the file from combinedFileNames
      const updatedNames = combinedFileNames.filter(name => name !== fileName);
      setCombinedFileNames(updatedNames);
      
      // Update localStorage
      localStorage.setItem('combinedFileNames', JSON.stringify(updatedNames));
      
      // If no files remain, reset to single file view
      if (updatedNames.length === 0) {
        setIsCombinedView(false);
        setSelectedFileIds([]);
        setCurrentFile(originalFile);
        setSelectedSheet('Sheet1');
        setIncludedSources(undefined);
        setExcludedSources([]);
        
        // Clear localStorage
        localStorage.removeItem('combinedFileIds');
        localStorage.removeItem('combinedFileNames');
        return;
      }
      
      // Update the file IDs list by finding the corresponding file ID
      // Create a mapping of file names to IDs for proper removal
      const fileNameToIdMap: Record<string, string> = {};
      combinedFileNames.forEach((name, index) => {
        if (index < selectedFileIds.length) {
          fileNameToIdMap[name] = selectedFileIds[index];
        }
      });
      
      const fileIdToRemove = fileNameToIdMap[fileName];
      if (fileIdToRemove) {
        const updatedIds = selectedFileIds.filter(id => id !== fileIdToRemove);
        setSelectedFileIds(updatedIds);
        
        // Update localStorage
        localStorage.setItem('combinedFileIds', JSON.stringify(updatedIds));
        
        // Update combined data
        await fetchAndUpdateCombinedData(updatedIds);
      }
    } catch (error) {
      console.error('Error removing file from combined analysis:', error);
    }
  }, [combinedFileNames, selectedFileIds, originalFile]);





  // Handle adding a new file to combined analysis
  const handleAddFileToCombined = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle manual refresh of combined data
  const handleRefreshCombinedData = useCallback(async () => {
    if (selectedFileIds.length === 0) return;
    
    setIsLoading(true);
    try {
      await fetchAndUpdateCombinedData();
      setLoadTick(prev => prev + 1);
    } catch (error) {
      console.error('Failed to refresh combined data:', error);
      setDataError('Failed to refresh combined data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFileIds, fetchAndUpdateCombinedData]);

  // Show loading state when processing file
  if (isLoading && !currentFile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your file...</p>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Analysis Sidebar */}



      <AnalysisSidebar
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        handleLogout={handleLogout}
        loadAnalysisHistory={loadAnalysisHistory}
        setShowHistory={setShowHistory}
        currentAnalysisView={currentAnalysisView}
        setCurrentAnalysisView={handleAnalysisViewChange}
      />

      {/* Top navbar (fixed) */}
      <header className="fixed top-0 inset-x-0 bg-white shadow z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                className="mr-3 md:hidden border rounded px-2 py-2 text-sm flex items-center"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">Result Analyzer</h1>
            </div>

            {user && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">Welcome, {user.name}</span>
                


                
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content wrapper with padding-top to offset fixed header */}
      <div className="flex-1 flex flex-col pt-16">
        <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              user ? (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900">Upload</h2>
                    <p className="text-gray-600 mt-2">Add a file to start analysis. The data will be combined automatically.</p>
                    {uploadError && (
                      <div className="mt-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                        <span className="font-medium">Error:</span> {uploadError}
                      </div>
                    )}

                    <div className="mt-6">
                      <FileUpload onFileUpload={handleFileUpload} onAddFiles={handleAddFiles} isLoading={isUploading} mode="multiple" />
                    </div>
                  </div>
                </div>
              ) : (
                <Login />
              )
            } />
            



            <Route path="/data" element={
              user ? (
                (!currentFile || !currentSheet) ? (
                  (isLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    </div>
                  ) : (
                    (selectedFileIds.length > 0 ? (
                      // Auto-load combined data if we have selected files
                      <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4" />
                          <p className="text-gray-600 mb-2">Loading combined data...</p>
                          <p className="text-sm text-gray-500">Processing {selectedFileIds.length} selected files</p>
                        </div>
                      </div>
                    ) : (
                      // No files selected, show upload option
                      <div className="flex items-center justify-center h-64">
                        <div className="text-center text-gray-600">
                          <p className="mb-3">{dataError || 'No data available yet. Upload a file to get started.'}</p>
                          <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            Go to Upload
                          </button>
                        </div>
                      </div>
                    ))
                  ))
                ) : (
                  <div className="space-y-6">
                    {dataError && (
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded">
                        {dataError}
                      </div>
                    )}


                    {/* File Management Header */}
                    <div className="bg-white shadow rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">
                            {currentFile.name} - {selectedSheet}
                          </h2>
                          {isCombinedView && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 mt-1">
                              Combined View
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isCombinedView ? (
                            <FileManager
                              selectedFiles={combinedFileNames}
                              allFiles={combinedFileNames}
                              onRemoveFile={handleRemoveFileFromCombined}
                              onAddFile={handleAddFileToCombined}
                              onRefresh={handleRefreshCombinedData}
                              isLoading={isLoading}
                            />
                          ) : (
                            <SheetSelector
                              sheets={currentFile.sheets}
                              selectedSheet={selectedSheet}
                              onSheetSelect={setSelectedSheet}
                            />
                          )}
                          
                          <button
                            onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ''; fileInputRef.current?.click(); }}
                            className={`px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                              isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Uploading...' : 'Add Files'}
                          </button>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls, .xlsm, .xlsb, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                const fileArray = Array.from(files);
                                if (fileArray.length === 1) {
                                  handleAddFile(fileArray[0]);
                                } else {
                                  handleAddFiles(fileArray);
                                }

                                try { e.currentTarget.value = ''; } catch (error) { console.log('Reset input value failed:', error); }
                              }
                            }}
                            className="hidden"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>




                    {/* 2. Filters Section - Always Visible */}
                    <div className="bg-white shadow rounded-lg p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Filters</h2>
                      <div className="space-y-6">
                        {/* Search & Filters */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Search & Filters</label>
                          <QueryBuilder
                            headers={currentSheet.headers || []}
                            data={currentSheet.data || []}
                            onQueryChange={handleQueryChange}
                            query={query}
                            selectedBranch={null}
                          />
                        </div>


                        {/* Year Selector */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                          <YearSelector
                            selectedYear={selectedYear}
                            onYearChange={setSelectedYear}
                            label="Filter by Academic Year (with Pass/Fail criteria)"
                          />
                        </div>



                        {/* Branch Selector */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                          <BranchSelector
                            selectedBranch={selectedBranch}
                            onBranchChange={setSelectedBranch}
                            data={currentSheet.data}
                            headers={currentSheet.headers}
                          />
                        </div>

                        {/* Semester Selector */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                          <SemesterSelector
                            data={currentSheet.data || []}
                            headers={currentSheet.headers || []}
                            selectedSemesters={selectedSemesters}
                            onSemestersChange={setSelectedSemesters}
                            selectedYear={selectedYear}
                            label="Filter by Semester"
                          />
                        </div>



                      </div>
                    </div>



                    {/* 3. Content Area - Conditional Based on Sidebar Selection */}
                    {currentAnalysisView === 'detention-analysis' ? (
                      /* Detention Analysis View */
                      <div className="bg-white shadow rounded-lg p-6">
                        <DetentionAnalysis
                          data={currentSheet.data}
                          headers={currentSheet.headers}
                          selectedBranch={selectedBranch}
                          onDetentionStatusChange={(status) => console.log('Detention status:', status)}
                        />
                      </div>

                    ) : currentAnalysisView === 'grade-analysis' ? (
                      /* Grade Analysis View */
                      <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Grade Wise Analysis</h2>

                        <GradeDistributionAnalysis
                          data={currentSheet.data}
                          processedData={processedData}
                          headers={currentSheet.headers}
                          selectedBranch={selectedBranch}
                          query={query}
                          includedSources={includedSources || undefined}
                        />
                      </div>
                    ) : (
                      /* Data Table View (default) */
                      <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Table</h2>
                        <div className="overflow-x-auto">
                          <EnhancedDataTable
                            data={currentSheet.data}
                            processedData={processedData}
                            headers={currentSheet.headers}
                            onDataChange={handleDataChange}
                            query={query}
                            selectedBranch={selectedBranch}
                            onSelectedBranchChange={setSelectedBranch}
                            gradeRanges={gradeRanges}
                            yearSelected={selectedYear}
                            onGradeRangesChange={setGradeRanges}
                            selectedSubject={selectedSubject}
                            onSelectedSubjectChange={setSelectedSubject}
                            loadedTick={loadTick}
                            includedSources={includedSources || undefined}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <Login />
              )
            } />
          </Routes>
        </main>
      </div>

      {
        mobileMenuOpen && 
        (

        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-lg p-4 space-y-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <span className="ml-2 font-semibold">Result Analyzer</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-600" aria-label="Close menu">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/'); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center"><Upload className="h-4 w-4 mr-2" /> Upload</button>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/data'); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center"><Table2 className="h-4 w-4 mr-2" /> Data</button>
            <button onClick={() => { setMobileMenuOpen(false); loadAnalysisHistory(); setShowHistory(true); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center"><HistoryIcon className="h-4 w-4 mr-2" /> View History</button>
            {user && (
              <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center"><LogOut className="h-4 w-4 mr-2" /> Logout</button>
            )}
          </div>
        </div>
        )
      }


      {/* Analysis History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Load Analysis State</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {analysisHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No saved states found</p>
              ) : (
                analysisHistory.map((item) => (
                  <div key={item._id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadAnalysisState(item)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteAnalysisHistory(item._id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
      )}
    </div>
    
  );
}

export default App;
