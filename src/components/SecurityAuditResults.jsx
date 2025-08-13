import React, { useState, useMemo } from 'react'
import { AlertTriangle, Shield, Info, CheckCircle, FileText, Code, ExternalLink, SlidersHorizontal } from 'lucide-react'

const SecurityAuditResults = ({ content }) => {
  const [expandedIssues, setExpandedIssues] = useState(new Set())
  const [severityFilter, setSeverityFilter] = useState('All')

  const toggleIssue = (issueId) => {
    const next = new Set(expandedIssues)
    next.has(issueId) ? next.delete(issueId) : next.add(issueId)
    setExpandedIssues(next)
  }

  const expandAll = (issues) => {
    setExpandedIssues(new Set(issues.map(i => i.id)))
  }

  const collapseAll = () => {
    setExpandedIssues(new Set())
  }

  // Parse the content to extract structured vulnerability information
  const parseVulnerabilities = (text) => {
    const vulnerabilities = []

    // Look for common vulnerability patterns in the text
    const criticalRegex = /Critical.*?(?=High|Medium|Low|$)/gsi
    const highRegex = /High.*?(?=Critical|Medium|Low|$)/gsi
    const mediumRegex = /Medium.*?(?=Critical|High|Low|$)/gsi
    const lowRegex = /Low.*?(?=Critical|High|Medium|$)/gsi

    const extractVulns = (regex, severity) => {
      const matches = text.match(regex)
      if (matches) {
        matches.forEach((match, index) => {
          const lines = match.split('\n').filter(line => line.trim())
          if (lines.length > 0) {
            const title = lines[0].replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '').trim()
            const description = lines.slice(1).join('\n').trim()

            vulnerabilities.push({
              id: `${severity}-${index}`,
              severity,
              title,
              description,
              chain: 'Ethereum/All EVM chains',
              file: 'Contract.sol',
              line: 'Multiple lines'
            })
          }
        })
      }
    }

    extractVulns(criticalRegex, 'Critical')
    extractVulns(highRegex, 'High')
    extractVulns(mediumRegex, 'Medium')
    extractVulns(lowRegex, 'Low')

    return vulnerabilities
  }

  const vulnerabilities = useMemo(() => parseVulnerabilities(content), [content])

  const getSeverityIcon = (severity) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-500" />
      case 'low':
        return <Info className="w-5 h-5 text-blue-500" />
      default:
        return <Shield className="w-5 h-5 text-gray-500" />
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
      case 'high':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
      case 'low':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800'
    }
  }

  const getSeverityBadgeColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/60 dark:text-gray-200'
    }
  }

  if (vulnerabilities.length === 0) {
    return (
      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl border border-green-200 dark:border-green-800/50 shadow-lg animate-fade-in">
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Shield className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
            No Vulnerabilities Detected
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed max-w-md mx-auto">
            Your smart contract appears to be secure based on our comprehensive security analysis.
          </p>
          <div className="mt-6 inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900/40 rounded-xl text-sm font-medium text-green-800 dark:text-green-200">
            <CheckCircle className="w-4 h-4 mr-2" />
            Security Check Passed
          </div>
        </div>
      </div>
    )
  }

  const filteredVulnerabilities = useMemo(() => {
    if (severityFilter === 'All') return vulnerabilities
    return vulnerabilities.filter(v => v.severity === severityFilter)
  }, [severityFilter, vulnerabilities])

  return (
    <div className="space-y-4">
      {/* Security Summary Header */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Security Audit Results
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => expandAll(filteredVulnerabilities)}
              className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Collapse all
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filter by severity:
          </div>
          {['All', 'Critical', 'High', 'Medium', 'Low'].map(severity => {
            const count = severity === 'All'
              ? vulnerabilities.length
              : vulnerabilities.filter(v => v.severity === severity).length

            const active = severityFilter === severity
            return (
              <button
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition
                  ${active
                    ? 'bg-blue-600 text-white border-blue-600 shadow'
                    : 'bg-white/40 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                aria-pressed={active}
              >
                {severity !== 'All' && getSeverityIcon(severity)}
                <span className={`${severity !== 'All' ? 'ml-2' : ''}`}>{severity}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${getSeverityBadgeColor(severity === 'All' ? 'low' : severity)}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Vulnerability Issues */}
      {filteredVulnerabilities.map((vulnerability, index) => (
        <div
          key={vulnerability.id}
          className={`border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in ${getSeverityColor(vulnerability.severity)} overflow-hidden`}
        >
          {/* Issue Header */}
          <div
            className="p-5 cursor-pointer hover:bg-white/30 dark:hover:bg-gray-800/30 transition-colors duration-200"
            onClick={() => toggleIssue(vulnerability.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(vulnerability.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white text-base mb-3 break-words-safe">
                    Issue #{index + 1}: <span className="text-overflow-ellipsis">{vulnerability.title}</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-xs uppercase tracking-wide">Severity:</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getSeverityBadgeColor(vulnerability.severity)}`}>
                        {vulnerability.severity}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 max-w-xs">
                      <span className="font-medium text-xs uppercase tracking-wide">Chain:</span>
                      <span className="text-xs truncate">{vulnerability.chain}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium text-xs uppercase tracking-wide">Location:</span>
                      <span className="text-xs truncate">{vulnerability.file}, {vulnerability.line}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0" aria-label="Toggle details">
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${expandedIssues.has(vulnerability.id) ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded Issue Details */}
          {expandedIssues.has(vulnerability.id) && (
            <div className="border-t border-gray-200/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm animate-scale-in">
              <div className="p-6 space-y-6">
                {/* Vulnerable Code Snippet */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mr-3">
                      <Code className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    Vulnerable Code Snippet
                  </h4>
                  <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-gray-900 px-4 py-2 border-b border-gray-800">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Solidity</span>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-100 font-mono break-words-safe whitespace-pre-wrap">{`// Example vulnerable code pattern
function vulnerableFunction() {
    // This is where the vulnerability occurs
    // Specific code would be extracted from analysis
}`}</pre>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    Description
                  </h4>
                  <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-4">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed break-words-safe">
                      {vulnerability.description || 'Detailed description of the security vulnerability and its potential impact on the smart contract.'}
                    </p>
                  </div>
                </div>

                {/* Impact */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mr-3">
                      <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    Potential Impact
                  </h4>
                  <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/50 rounded-xl p-4">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed break-words-safe">
                      This vulnerability could potentially lead to security issues if exploited. The specific impact depends on the vulnerability type and context within the smart contract implementation.
                    </p>
                  </div>
                </div>

                {/* Remediation */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                      <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    Remediation Steps
                  </h4>
                  <div className="bg-green-50/70 dark:bg-green-950/30 border border-green-200/60 dark:border-green-800/60 rounded-xl p-4">
                    <p className="text-green-800 dark:text-green-200 leading-relaxed break-words-safe">
                      Follow secure coding practices and implement the recommended fixes to address this vulnerability. Review the code thoroughly and apply industry-standard security patterns.
                    </p>
                  </div>
                </div>

                {/* Recommended Fix Code */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mr-3">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Recommended Fix
                  </h4>
                  <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Secure Implementation</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-100 font-mono break-words-safe whitespace-pre-wrap">{`// Secure implementation
function secureFunction() {
    // Apply security best practices
    // Use recommended patterns and libraries
}`}</pre>
                    </div>
                  </div>
                </div>

                {/* Additional Resources */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center text-base">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-3">
                      <ExternalLink className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    Additional Resources
                  </h4>
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50 rounded-xl p-4">
                    <div className="grid gap-2">
                      <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center group">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3 group-hover:bg-blue-500 transition-colors"></span>
                        OpenZeppelin Security Guidelines
                      </a>
                      <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center group">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3 group-hover:bg-blue-500 transition-colors"></span>
                        Ethereum Smart Contract Security Best Practices
                      </a>
                      <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center group">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3 group-hover:bg-blue-500 transition-colors"></span>
                        ConsenSys Security Tools and Resources
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default SecurityAuditResults
