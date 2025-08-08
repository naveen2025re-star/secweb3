import React, { useState } from 'react'
import { Upload, Code, Trash2, Sparkles } from 'lucide-react'
import CodeEditor from './CodeEditor'

const InputSection = ({ onAnalyze, isAnalyzing, onClear }) => {
  const [activeTab, setActiveTab] = useState('paste')
  const [code, setCode] = useState('')
  const [filename, setFilename] = useState('')

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCode(e.target.result)
        setFilename(file.name)
        setActiveTab('paste') // Switch to editor view
      }
      reader.readAsText(file)
    }
  }

  const handleAnalyze = () => {
    if (code.trim()) {
      onAnalyze(code, filename)
    }
  }

  const handleClear = () => {
    setCode('')
    setFilename('')
    onClear()
  }

  const isValidFile = (filename) => {
    const validExtensions = ['.sol', '.vy', '.move', '.cairo']
    return validExtensions.some(ext => filename.toLowerCase().endsWith(ext))
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Smart Contract Input</h2>
        <button
          onClick={handleClear}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          aria-label="Clear all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('paste')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md flex-1 justify-center transition-colors ${
            activeTab === 'paste'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code className="h-4 w-4" />
          <span>Paste Code</span>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md flex-1 justify-center transition-colors ${
            activeTab === 'upload'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="h-4 w-4" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'paste' && (
          <div className="flex-1 flex flex-col">
            {filename && (
              <div className="mb-3 p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isValidFile(filename) ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-sm font-medium">{filename}</span>
                </div>
              </div>
            )}
            <CodeEditor value={code} onChange={setCode} />
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8">
            <div className="text-center">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Upload Smart Contract</h3>
              <p className="text-muted-foreground mb-6">
                Supports .sol, .vy, .move, .cairo files
              </p>
              <label className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg cursor-pointer hover:bg-primary/90 transition-colors">
                <Upload className="h-4 w-4" />
                <span>Choose File</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".sol,.vy,.move,.cairo"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Analyze Button */}
      <div className="mt-6">
        <button
          onClick={handleAnalyze}
          disabled={!code.trim() || isAnalyzing}
          className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2"
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Analyze Contract</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default InputSection
