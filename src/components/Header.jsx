import React from 'react'
import { Shield, Moon, Sun } from 'lucide-react'

const Header = ({ darkMode, setDarkMode, user, creditsBalance, onShowPlans, onDisconnect }) => {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">SecWeb3 AI Auditor</h1>
          </div>

          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">{creditsBalance || 0}</span> credits
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onShowPlans}
                    className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Upgrade
                  </button>
                  <button
                    onClick={onDisconnect}
                    className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
