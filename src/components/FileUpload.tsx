

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  onAddFiles?: (files: File[]) => Promise<void>;
  isLoading: boolean;
  mode?: 'single' | 'multiple';
}


export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, onAddFiles, isLoading, mode = 'single' }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessing = useRef(false);
  const dragCounterRef = useRef(0); // Track drag enter/leave events to prevent false triggers

  const validateFile = (file: File): boolean => {
    try { console.log('[UploadUI] validateFile', { name: file?.name, size: file?.size, type: file?.type }); } catch {}
    // Reset previous errors
    setError(null);

    // Check if already processing
    if (isProcessing.current) {
      setError('Please wait for current file to finish processing');
      return false;
    }


    // Check file size (limit to 9MB)
    const maxSize = 9 * 1024 * 1024; // 9MB in bytes
    if (file.size > maxSize) {
      setError('File size exceeds 9MB limit. Please upload a smaller file.');
      return false;
    }

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];

    // Check file extension as a fallback
    const validExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setError('Please upload a valid Excel file (.xlsx, .xls, .xlsm, .xlsb)');
      return false;
    }
    return true;

  };


  const handleFile = useCallback(async (file: File | null) => {
    try {  } catch {}
    if (!file) {
      setError('No file selected');
      return;
    }

    if (!validateFile(file)) {
      try { console.warn('[UploadUI] validation failed'); } catch {}
      return;
    }

    isProcessing.current = true;
    setError(null);
    
    try {
      try { console.log('[UploadUI] calling onFileUpload'); } catch {}
      await onFileUpload(file);
      try { console.log('[UploadUI] onFileUpload resolved'); } catch {}
      // Reset input after successful upload to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Failed to process the file. Please try again.');
    } finally {
      isProcessing.current = false;
    }
  }, [onFileUpload]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      setError('No files selected');
      return;
    }

    const fileArray = Array.from(files);
    
    // Validate all files
    for (const file of fileArray) {
      if (!validateFile(file)) {
        return;
      }
    }

    isProcessing.current = true;
    setError(null);
    
    try {
      if (mode === 'multiple' && onAddFiles) {
        await onAddFiles(fileArray);
      } else {
        // For single mode, process only the first file
        await onFileUpload(fileArray[0]);
      }
      
      // Reset input after successful upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error processing files:', err);
      setError(err instanceof Error ? err.message : 'Failed to process the files. Please try again.');
    } finally {
      isProcessing.current = false;
    }
  }, [onFileUpload, onAddFiles, mode]);


  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use drag counter to prevent false leave events when dragging over child elements
    if (e.type === 'dragenter') {
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setDragActive(true);
      }
    } else if (e.type === 'dragleave') {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setDragActive(false);
      }
    }
    // Note: 'dragover' doesn't change dragCounter, no state change needed
  }, []);



  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag counter on drop
    dragCounterRef.current = 0;
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try { console.log('[UploadUI] drop files', { count: e.dataTransfer.files.length, names: Array.from(e.dataTransfer.files).map(f => f.name) }); } catch {}
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);




  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    try { console.log('[UploadUI] input change', { hasFiles: !!files, count: files?.length, names: files ? Array.from(files).map(f => f.name) : [] }); } catch {}
    if (files && files.length > 0) {
      if (mode === 'multiple' && onAddFiles) {
        handleFiles(files);
      } else {
        handleFile(files[0]);
      }
    }
  }, [handleFile, handleFiles, mode, onAddFiles]);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading && fileInputRef.current) {
      try { console.log('[UploadUI] button click - triggering input'); } catch {}
      fileInputRef.current.click();
    }
  }, [isLoading]);

  // Cleanup drag counter and processing state on component unmount
  useEffect(() => {
    return () => {
      // Reset drag counter to prevent memory leaks
      dragCounterRef.current = 0;
      setDragActive(false);
      
      // Reset processing state to prevent race conditions
      isProcessing.current = false;
    };
  }, []);

  return (
    <div className="max-w-lg mx-auto">

      <div
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg ${
          dragActive ? 'border-primary bg-primary/10' : 'border-gray-300'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-center">
          <div className="flex justify-center">
            {isLoading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            ) : (
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
            )}
          </div>

                <div className="flex flex-col items-center text-sm text-gray-600">
            {isLoading ? (
              <p className="mt-2 text-primary">Processing your file{fileInputRef.current?.files && fileInputRef.current.files.length > 1 ? 's' : ''}...</p>
            ) : (
              <>
                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={handleButtonClick}
                    className="inline-flex items-center gap-2 px-5 h-11 rounded-full shadow-sm bg-primary text-white hover:bg-indigo-700"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {mode === 'multiple' ? 'Add files to combine' : 'Add or combine file'}
                  </button>
                  <span>or drag and drop</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Excel files only (XLSX, XLS, XLSM, XLSB){mode === 'multiple' ? ' - Multiple files allowed' : ''}</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx, .xls, .xlsm, .xlsb, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleChange}
            disabled={isLoading}
            data-testid="upload-input"
            multiple={mode === 'multiple'}
          />
          {error && (
            <div className="mt-2 flex items-center justify-center text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};