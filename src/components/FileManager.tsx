
import React from 'react';
import { X, FileSpreadsheet, Plus, RefreshCw } from 'lucide-react';

interface FileManagerProps {
  selectedFiles: string[];
  allFiles: string[];
  onRemoveFile: (fileName: string) => void;
  onAddFile: () => void;
  onRefresh?: () => void;
  isLoading: boolean;
}


export const FileManager: React.FC<FileManagerProps> = ({
  selectedFiles,
  allFiles,
  onRemoveFile,
  onAddFile,
  onRefresh,
  isLoading
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FileSpreadsheet className="h-5 w-5 mr-2 text-primary" />
          Combined Files ({selectedFiles.length})
        </h3>

        <div className="flex space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading || selectedFiles.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh Data
            </button>
          )}
          <button
            onClick={onAddFile}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Files
          </button>
        </div>
      </div>

      {selectedFiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm">No files combined yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Files" to start combining</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {selectedFiles.map((fileName, index) => (
            <div
              key={`${fileName}-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center flex-1 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    File {index + 1} of {selectedFiles.length}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemoveFile(fileName)}
                disabled={isLoading}
                className="ml-3 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Remove ${fileName} from analysis`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Combined Analysis:</span>
            <span className="font-medium text-primary">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} active
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Only students appearing in multiple files will be shown
          </p>
        </div>
      )}
    </div>
  );
};
