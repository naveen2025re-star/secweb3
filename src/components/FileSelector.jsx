import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Files, Code, ChevronDown, ChevronRight, CheckSquare, Square, 
  FileText, Calendar, BarChart3, Zap, AlertCircle, Loader, X 
} from 'lucide-react';
import FileUpload from './FileUpload';

const FileSelector = ({ onFilesSelected, selectedFileIds = [], onClose, className = '' }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    recent: true,
    byLanguage: false
  });

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('secweb3_token');
      const response = await fetch('/api/files', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const result = await response.json();
      if (result.success) {
        setFiles(result.files);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileToggle = (fileId) => {
    const isSelected = selectedFileIds.includes(fileId);
    let newSelection;
    
    if (isSelected) {
      newSelection = selectedFileIds.filter(id => id !== fileId);
    } else {
      newSelection = [...selectedFileIds, fileId];
    }
    
    onFilesSelected(newSelection);
  };

  const handleSelectAll = (filesToSelect) => {
    const allSelected = filesToSelect.every(file => selectedFileIds.includes(file.id));
    
    if (allSelected) {
      const newSelection = selectedFileIds.filter(id => 
        !filesToSelect.some(file => file.id === id)
      );
      onFilesSelected(newSelection);
    } else {
      const newSelection = [...new Set([
        ...selectedFileIds, 
        ...filesToSelect.map(file => file.id)
      ])];
      onFilesSelected(newSelection);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLanguageColor = (language) => {
    const colors = {
      solidity: 'bg-purple-100 text-purple-800 border-purple-200',
      vyper: 'bg-green-100 text-green-800 border-green-200',
      move: 'bg-blue-100 text-blue-800 border-blue-200',
      cairo: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[language?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <Loader className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading your contract files...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button
              onClick={fetchFiles}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20 backdrop-blur-sm">
              <Files className="w-10 h-10 text-blue-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">+</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">
              Upload Smart Contracts
            </h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Get started by uploading your contract files. Supports Solidity, Vyper, Move, and Cairo.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔵 Upload button clicked - setting showUploader to true');
              console.log('Current showUploader state:', showUploader);
              setShowUploader(true);
              console.log('Should now show uploader modal');
            }}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
          >
            <Files className="w-4 h-4" />
            <span>Upload Contract Files</span>
          </button>
        </div>
      </div>
    );
  }

  // Group files by language
  const filesByLanguage = files.reduce((acc, file) => {
    const lang = file.language || 'unknown';
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(file);
    return acc;
  }, {});

  // Get recent files (last 5)
  const recentFiles = files.slice(0, 5);

  const FileItem = ({ file, compact = false }) => (
    <div
      key={file.id}
      className={`
        flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-150
        ${selectedFileIds.includes(file.id)
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }
      `}
      onClick={() => handleFileToggle(file.id)}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className="flex-shrink-0">
          {selectedFileIds.includes(file.id) ? (
            <CheckSquare className="w-4 h-4 text-blue-600" />
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className="p-1.5 bg-gray-100 rounded">
            <FileText className="w-3 h-3 text-blue-600" />
          </div>
          
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.original_name}
            </p>
            
            {!compact && (
              <div className="flex items-center space-x-2 mt-1">
                <span className={`
                  px-1.5 py-0.5 text-xs rounded border
                  ${getLanguageColor(file.language)}
                `}>
                  {file.language?.toUpperCase() || 'UNKNOWN'}
                </span>
                <span className="text-xs text-gray-500 flex items-center">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  {formatFileSize(file.file_size)}
                </span>
                <span className="text-xs text-gray-500 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(file.upload_date)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`max-h-96 overflow-y-auto ${className}`}>
      <div className="space-y-4">
        {/* Selection Summary */}
        {selectedFileIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800 font-medium">
                {selectedFileIds.length} file{selectedFileIds.length !== 1 ? 's' : ''} selected for scanning
              </span>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-600">Ready to analyze</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Files */}
        <div>
          <button
            onClick={() => toggleCategory('recent')}
            className="flex items-center space-x-2 w-full text-left p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {expandedCategories.recent ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm font-medium text-gray-900">
              Recent Files ({recentFiles.length})
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAll(recentFiles);
              }}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
            >
              {recentFiles.every(file => selectedFileIds.includes(file.id)) ? 'Deselect All' : 'Select All'}
            </button>
          </button>
          
          {expandedCategories.recent && (
            <div className="space-y-2 ml-6 mt-2">
              {recentFiles.map(file => (
                <FileItem key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>

        {/* Files by Language */}
        <div>
          <button
            onClick={() => toggleCategory('byLanguage')}
            className="flex items-center space-x-2 w-full text-left p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {expandedCategories.byLanguage ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm font-medium text-gray-900">
              By Language ({Object.keys(filesByLanguage).length} languages)
            </span>
          </button>
          
          {expandedCategories.byLanguage && (
            <div className="space-y-3 ml-6 mt-2">
              {Object.entries(filesByLanguage).map(([language, languageFiles]) => (
                <div key={language}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`
                      px-2 py-1 text-xs rounded border font-medium
                      ${getLanguageColor(language)}
                    `}>
                      {language.toUpperCase()} ({languageFiles.length})
                    </span>
                    
                    <button
                      onClick={() => handleSelectAll(languageFiles)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      {languageFiles.every(file => selectedFileIds.includes(file.id)) ? 'Deselect' : 'Select All'}
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    {languageFiles.map(file => (
                      <FileItem key={file.id} file={file} compact={true} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Debug: Show state changes */}
      {console.log('🔄 FileSelector render - showUploader:', showUploader)}
      
      {/* Simple debug modal without portal */}
      {showUploader && (
        <div className="fixed inset-0 bg-red-500 bg-opacity-75 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">DEBUG: Modal is working!</h3>
            <p className="mb-4">If you can see this, the state is changing correctly.</p>
            <button 
              onClick={() => setShowUploader(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Close Debug Modal
            </button>
          </div>
        </div>
      )}

      {/* File Upload Modal - Portal to prevent z-index issues */}
      {false && showUploader && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            console.log('🎯 Modal backdrop clicked');
            // Close modal only if clicking the backdrop, not the modal content
            if (e.target === e.currentTarget) {
              console.log('🔴 Closing modal via backdrop click');
              setShowUploader(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking inside
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Upload Contract Files
              </h3>
              <button
                onClick={() => setShowUploader(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <FileUpload
              onUploadComplete={(result) => {
                if (result.success) {
                  // Refresh the files list
                  fetchFiles();
                  // Close the modal
                  setShowUploader(false);
                }
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FileSelector;
