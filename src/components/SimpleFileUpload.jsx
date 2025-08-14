import React, { useState } from 'react'
import { Upload, X, File, CheckCircle, AlertCircle, Loader } from 'lucide-react'

const SimpleFileUpload = ({ onSuccess, onClose }) => {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const supportedTypes = ['.sol', '.vy', '.move', '.cairo']

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(droppedFiles)
    setResult(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('contracts', file))

      const token = localStorage.getItem('secweb3_token')
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        setFiles([])
        setTimeout(() => {
          onSuccess?.(data)
          onClose?.()
        }, 1500)
      }
    } catch (error) {
      setResult({ success: false, error: 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById('file-input').click()}
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-8 text-center cursor-pointer transition-colors"
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Drop files here or click to browse
        </h3>
        <p className="text-gray-500 mb-4">
          Supports: {supportedTypes.join(', ')}
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept={supportedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">
            Selected Files ({files.length})
          </h4>
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <File className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={uploadFiles}
          disabled={uploading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {uploading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Upload {files.length} File{files.length > 1 ? 's' : ''}</span>
            </>
          )}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg border-l-4 ${
          result.success ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'
        }`}>
          <div className="flex items-center space-x-2">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '✅ Upload Successful!' : '❌ Upload Failed'}
            </p>
          </div>
          {result.error && (
            <p className="text-red-700 text-sm mt-1">{result.error}</p>
          )}
          {result.success && (
            <p className="text-green-700 text-sm mt-1">Closing in a moment...</p>
          )}
        </div>
      )}
    </div>
  )
}

export default SimpleFileUpload
