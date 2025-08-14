import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const FileUpload = ({ onUploadComplete, className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);

  const supportedExtensions = ['.sol', '.vy', '.move', '.cairo'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const maxFiles = 10;

  const validateFile = (file) => {
    const errors = [];
    
    // Check file extension
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!supportedExtensions.includes(extension)) {
      errors.push(`Unsupported file type. Supported: ${supportedExtensions.join(', ')}`);
    }
    
    // Check file size
    if (file.size > maxFileSize) {
      errors.push('File size exceeds 5MB limit');
    }
    
    return errors;
  };

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const errors = validateFile(file);
      return errors.length === 0;
    });
    const fileErrors = fileArray.filter(file => {
      const errors = validateFile(file);
      return errors.length > 0;
    }).map(file => ({ file: file.name, errors: validateFile(file) }));

    // Check total file count
    if (selectedFiles.length + validFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    if (fileErrors.length > 0) {
      console.warn('File validation errors:', fileErrors);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    handleFiles(files);
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setUploadResults(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadResults(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('contracts', file);
      });

      const token = localStorage.getItem('secweb3_token');
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      setUploadResults(result);
      
      if (result.success) {
        // Clear selected files on successful upload
        setSelectedFiles([]);
        // Notify parent component
        onUploadComplete && onUploadComplete(result);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadResults({
        success: false,
        error: 'Upload failed. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Enhanced Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
          ${isDragging 
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg transform scale-[1.02]' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50 hover:shadow-md'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".sol,.vy,.move,.cairo"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-6">
          <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center transition-all duration-300 ${
            isDragging 
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg' 
              : 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-100 hover:to-indigo-100'
          }`}>
            <Upload className={`w-10 h-10 transition-colors ${
              isDragging ? 'text-white' : 'text-gray-600 hover:text-blue-600'
            }`} />
          </div>
          
          <div className="space-y-3">
            <h3 className={`text-xl font-bold transition-colors ${
              isDragging ? 'text-blue-700' : 'text-gray-900'
            }`}>
              {isDragging ? 'Drop your contracts here' : 'Upload Smart Contracts'}
            </h3>
            <p className="text-gray-600 text-base max-w-md mx-auto">
              {isDragging 
                ? 'Release to upload your smart contract files' 
                : 'Drag and drop your contract files here, or click to browse'
              }
            </p>
            
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {supportedExtensions.map(ext => (
                <span key={ext} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {ext}
                </span>
              ))}
            </div>
            
            <div className="text-sm text-gray-500 pt-3 space-y-1">
              <p className="flex items-center justify-center space-x-4">
                <span>Max file size: 5MB</span>
                <span>•</span>
                <span>Max files: {maxFiles}</span>
              </p>
            </div>
          </div>
        </div>

        {uploading && (
          <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <Loader className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-blue-600 font-medium">Uploading...</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h3>
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Clear All
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  disabled={uploading}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={uploadFiles}
            disabled={uploading || selectedFiles.length === 0}
            className={`
              w-full py-3 px-4 rounded-lg font-medium transition-all duration-200
              ${uploading || selectedFiles.length === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02]'
              }
            `}
          >
            {uploading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Uploading {selectedFiles.length} files...</span>
              </div>
            ) : (
              `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div className={`
          p-4 rounded-lg border-l-4 
          ${uploadResults.success 
            ? 'bg-green-50 border-green-400' 
            : 'bg-red-50 border-red-400'
          }
        `}>
          <div className="flex items-start space-x-3">
            {uploadResults.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h4 className={`text-sm font-medium ${
                uploadResults.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {uploadResults.success ? 'Upload Successful!' : 'Upload Failed'}
              </h4>
              
              {uploadResults.message && (
                <p className={`text-sm mt-1 ${
                  uploadResults.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {uploadResults.message}
                </p>
              )}
              
              {uploadResults.errors && uploadResults.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-red-700">Errors:</p>
                  <ul className="text-sm text-red-600 mt-1 space-y-1">
                    {uploadResults.errors.map((error, index) => (
                      <li key={index} className="text-xs">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
