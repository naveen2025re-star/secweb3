import React from 'react'
import { Shield, Moon, Sun, Zap, TrendingUp } from 'lucide-react'

const Header = ({ darkMode, setDarkMode, user, onShowPlans, onDisconnect }) => {
  // Use the credits balance from user object (which gets updated in real-time)
  const creditsBalance = user?.creditsBalance || 0;
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
                {/* Enhanced Credits Display */}
                <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        {creditsBalance || 0}
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">credits</span>
                    </div>
                    <div className="text-xs text-blue-500 dark:text-blue-300">
                      {user.plan?.name || 'Free'} Plan
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={onShowPlans}
                    className="flex items-center space-x-1 text-sm px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>Upgrade</span>
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
