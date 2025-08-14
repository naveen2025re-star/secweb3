import React, { useState, useEffect } from 'react';
import { 
  FileText, Trash2, Edit3, Calendar, Search, Filter, 
  Eye, Code, Download, CheckSquare, Square, AlertCircle,
  Loader, Tag, Clock, BarChart3
} from 'lucide-react';
import FileUpload from './FileUpload';

const FileManager = ({ onFileSelect, selectedFileIds = [], className = '' }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [showUploader, setShowUploader] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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

  const deleteFile = async (fileId) => {
    try {
      const token = localStorage.getItem('secweb3_token');
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setFiles(prev => prev.filter(file => file.id !== fileId));
        setDeleteConfirm(null);
      } else {
        alert('Failed to delete file: ' + result.error);
      }
    } catch (err) {
      alert('Failed to delete file: ' + err.message);
    }
  };

  const updateFileMetadata = async (fileId, metadata) => {
    try {
      const token = localStorage.getItem('secweb3_token');
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      const result = await response.json();
      if (result.success) {
        setFiles(prev => prev.map(file => 
          file.id === fileId ? { ...file, ...result.file } : file
        ));
        setEditingFile(null);
      } else {
        alert('Failed to update file: ' + result.error);
      }
    } catch (err) {
      alert('Failed to update file: ' + err.message);
    }
  };

  const handleFileSelect = (fileId) => {
    const isSelected = selectedFileIds.includes(fileId);
    if (isSelected) {
      onFileSelect(selectedFileIds.filter(id => id !== fileId));
    } else {
      onFileSelect([...selectedFileIds, fileId]);
    }
  };

  const handleSelectAll = () => {
    const filteredFiles = getFilteredFiles();
    const allFiltered = filteredFiles.every(file => selectedFileIds.includes(file.id));
    
    if (allFiltered) {
      // Deselect all filtered files
      const remainingSelected = selectedFileIds.filter(id => 
        !filteredFiles.some(file => file.id === id)
      );
      onFileSelect(remainingSelected);
    } else {
      // Select all filtered files
      const newSelection = [...new Set([
        ...selectedFileIds, 
        ...filteredFiles.map(file => file.id)
      ])];
      onFileSelect(newSelection);
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLanguageColor = (language) => {
    const colors = {
      solidity: 'bg-purple-100 text-purple-800',
      vyper: 'bg-green-100 text-green-800',
      move: 'bg-blue-100 text-blue-800',
      cairo: 'bg-orange-100 text-orange-800'
    };
    return colors[language?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getFilteredFiles = () => {
    return files.filter(file => {
      const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           file.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (file.description && file.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesLanguage = languageFilter === 'all' || 
                             file.language?.toLowerCase() === languageFilter.toLowerCase();
      
      return matchesSearch && matchesLanguage;
    });
  };

  const uniqueLanguages = [...new Set(files.map(file => file.language).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading your contract files...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchFiles}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredFiles = getFilteredFiles();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contract Files</h2>
          <p className="text-gray-600 mt-1">
            Manage your uploaded contract files and select them for scanning
          </p>
        </div>
        
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {showUploader ? 'Hide Uploader' : 'Upload Files'}
        </button>
      </div>

      {/* File Upload Section */}
      {showUploader && (
        <div className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FileUpload 
            onUploadComplete={(result) => {
              fetchFiles(); // Refresh the file list
              if (result.success) {
                setShowUploader(false);
              }
            }}
          />
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Languages</option>
          {uniqueLanguages.map(lang => (
            <option key={lang} value={lang}>
              {lang?.charAt(0).toUpperCase() + lang?.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Selection Controls */}
      {filteredFiles.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 text-blue-700 hover:text-blue-800 font-medium"
            >
              {filteredFiles.every(file => selectedFileIds.includes(file.id)) ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                {filteredFiles.every(file => selectedFileIds.includes(file.id)) 
                  ? 'Deselect All' 
                  : 'Select All'
                }
              </span>
            </button>
            
            {selectedFileIds.length > 0 && (
              <span className="text-sm text-blue-700">
                {selectedFileIds.length} file{selectedFileIds.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        </div>
      )}

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {files.length === 0 ? 'No contract files yet' : 'No files match your search'}
          </h3>
          <p className="text-gray-600 mb-6">
            {files.length === 0 
              ? 'Upload your first contract file to get started with security analysis.'
              : 'Try adjusting your search terms or filters.'}
          </p>
          {files.length === 0 && (
            <button
              onClick={() => setShowUploader(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Upload Your First File
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer
                ${selectedFileIds.includes(file.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
              onClick={() => handleFileSelect(file.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {selectedFileIds.includes(file.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {file.original_name}
                      </h4>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className={`
                          px-2 py-1 text-xs rounded-full font-medium
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
                        {file.scan_count > 0 && (
                          <span className="text-xs text-green-600 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Scanned {file.scan_count}x
                          </span>
                        )}
                      </div>
                      
                      {file.description && (
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {file.description}
                        </p>
                      )}
                      
                      {file.tags && file.tags.length > 0 && (
                        <div className="flex items-center space-x-1 mt-2">
                          {file.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {file.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{file.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFile(file);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit metadata"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(file.id);
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit File Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit File Metadata
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editingFile.description || ''}
                  onChange={(e) => setEditingFile({
                    ...editingFile,
                    description: e.target.value
                  })}
                  placeholder="Add a description for this contract..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editingFile.tags ? editingFile.tags.join(', ') : ''}
                  onChange={(e) => setEditingFile({
                    ...editingFile,
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  })}
                  placeholder="defi, token, security..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingFile(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateFileMetadata(editingFile.id, {
                  description: editingFile.description,
                  tags: editingFile.tags
                })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Contract File
              </h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this file? This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteFile(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
