import React from 'react'
import Editor from '@monaco-editor/react'

const CodeEditor = ({ value, onChange }) => {
  const handleEditorChange = (value) => {
    onChange(value || '')
  }

  const detectLanguage = (code) => {
    if (code.includes('pragma solidity') || code.includes('contract ')) return 'sol'
    if (code.includes('# @version') || code.includes('@external')) return 'python'
    if (code.includes('module ') && code.includes('fun ')) return 'rust'
    if (code.includes('#[contract]') || code.includes('func ')) return 'rust'
    return 'javascript'
  }

  return (
    <div className="flex-1 min-h-0">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        language={detectLanguage(value)}
        value={value}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 16, bottom: 16 },
          fontFamily: 'JetBrains Mono, Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
        }}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('custom-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#1e1e2e',
              'editor.foreground': '#cdd6f4',
              'editorLineNumber.foreground': '#6c7086',
              'editor.selectionBackground': '#414559',
              'editor.inactiveSelectionBackground': '#313244',
              'editorCursor.foreground': '#f38ba8',
            }
          })
        }}
        onMount={(editor, monaco) => {
          monaco.editor.setTheme('custom-dark')
        }}
      />
    </div>
  )
}

export default CodeEditor
