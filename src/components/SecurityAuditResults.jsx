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
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
              Security Analysis Complete
            </h3>
            <p className="text-green-700 dark:text-green-300 mt-1">
              No critical vulnerabilities detected in the smart contract code.
            </p>
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
          className={`border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${getSeverityColor(vulnerability.severity)}`}
        >
          {/* Issue Header */}
          <div
            className="p-4 cursor-pointer"
            onClick={() => toggleIssue(vulnerability.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                {getSeverityIcon(vulnerability.severity)}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Issue #{index + 1}: {vulnerability.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="flex items-center space-x-1">
                      <span className="font-medium">Severity:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadgeColor(vulnerability.severity)}`}>
                        {vulnerability.severity}
                      </span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="font-medium">Affected Chain/Standard:</span>
                      <span>{vulnerability.chain}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <FileText className="w-3 h-3" />
                      <span className="font-medium">File/Line:</span>
                      <span>{vulnerability.file}, {vulnerability.line}</span>
                    </span>
                  </div>
                </div>
              </div>
              <button className="ml-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" aria-label="Toggle details">
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${expandedIssues.has(vulnerability.id) ? 'rotate-180' : ''}`}
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
            <div className="border-t border-gray-200 dark:border-gray-600 p-4 bg-white/60 dark:bg-gray-800/60">
              <div className="space-y-4">
                {/* Vulnerable Code Snippet */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <Code className="w-4 h-4 mr-2" />
                    Vulnerable Code Snippet:
                  </h4>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`// Example vulnerable code pattern
function vulnerableFunction() {
    // This is where the vulnerability occurs
    // Specific code would be extracted from analysis
}`}</pre>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Description:</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {vulnerability.description || 'Detailed description of the security vulnerability and its potential impact on the smart contract.'}
                  </p>
                </div>

                {/* Impact */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Impact:</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    This vulnerability could potentially lead to security issues if exploited. The specific impact depends on the vulnerability type and context.
                  </p>
                </div>

                {/* Remediation */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Remediation:</h4>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
                    <p className="text-green-800 dark:text-green-200 text-sm">
                      Follow secure coding practices and implement the recommended fixes to address this vulnerability.
                    </p>
                  </div>
                </div>

                {/* Recommended Fix Code */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Recommended Fix:
                  </h4>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`// Secure implementation
function secureFunction() {
    // Apply security best practices
    // Use recommended patterns and libraries
}`}</pre>
                  </div>
                </div>

                {/* Additional Resources */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Additional Resources:
                  </h4>
                  <div className="space-y-1 text-sm">
                    <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline block">
                      • OpenZeppelin Security Guidelines
                    </a>
                    <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline block">
                      • Ethereum Smart Contract Security Best Practices
                    </a>
                    <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline block">
                      • ConsenSys Security Tools and Resources
                    </a>
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
