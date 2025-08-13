import React, { useState, useMemo } from 'react'
import { Plus, MessageSquare, MoreHorizontal, Edit3, Trash2, Search, Wallet, LogOut, Copy, Check } from 'lucide-react'
import { useWeb3Auth } from '../hooks/useWeb3Auth'
import ProfileModal from './ProfileModal'

const Sidebar = ({ user, conversations, activeConversation, onNewConversation, onSelectConversation, onDeleteConversation, onRenameConversation }) => {
  const { logout, refreshProfile } = useWeb3Auth()
  const [hoveredConversation, setHoveredConversation] = useState(null)
  const [query, setQuery] = useState('')
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [editingConversation, setEditingConversation] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const copyAddress = async () => {
    if (user?.walletAddress) {
      try {
        await navigator.clipboard.writeText(user.walletAddress)
        setCopiedAddress(true)
        setTimeout(() => setCopiedAddress(false), 2000)
      } catch (error) {
        console.error('Failed to copy address:', error)
      }
    }
  }

  const handleEditConversation = (conversation, e) => {
    e.stopPropagation()
    setEditingConversation(conversation.id)
    setEditTitle(conversation.title)
  }

  const handleSaveEdit = (conversationId) => {
    if (editTitle.trim() && onRenameConversation) {
      onRenameConversation(conversationId, editTitle.trim())
    }
    setEditingConversation(null)
    setEditTitle('')
  }

  const handleDeleteConversation = (conversationId, e) => {
    e.stopPropagation()
    if (onDeleteConversation && window.confirm('Are you sure you want to delete this conversation?')) {
      onDeleteConversation(conversationId)
    }
  }

  const formatAddress = (address) => {
    if (!address || typeof address !== 'string' || address.length < 10) {
      return null;
    }
    try {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    } catch {
      return null;
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday' 
    if (diffInDays < 7) return `${diffInDays} days ago`
    return date.toLocaleDateString()
  }

  const truncateTitle = (title, maxLength = 28) => {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength) + '...'
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => c.title.toLowerCase().includes(q))
  }, [conversations, query])

  const groupedConversations = {
    'Today': filtered.filter(conv => {
      const diffInDays = Math.floor((new Date() - new Date(conv.timestamp)) / (1000 * 60 * 60 * 24))
      return diffInDays === 0
    }),
    'Yesterday': filtered.filter(conv => {
      const diffInDays = Math.floor((new Date() - new Date(conv.timestamp)) / (1000 * 60 * 60 * 24))
      return diffInDays === 1
    }),
    'Previous 7 days': filtered.filter(conv => {
      const diffInDays = Math.floor((new Date() - new Date(conv.timestamp)) / (1000 * 60 * 60 * 24))
      return diffInDays > 1 && diffInDays <= 7
    }),
  }

  return (
    <div className="w-72 h-full bg-gray-950/95 backdrop-blur-md text-white flex flex-col border-r border-gray-800/60 shadow-2xl animate-slide-in-left">
      {/* Header */}
      <div className="p-5 border-b border-gray-800/40">
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <div>
            <h2 className="font-semibold text-white text-lg">SecWeb3</h2>
            <p className="text-xs text-gray-400">Smart Contract Auditor</p>
          </div>
        </div>

        <button
          onClick={onNewConversation}
          className="w-full flex items-center space-x-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 hover:border-blue-400/50 text-white px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm group shadow-lg hover:shadow-xl backdrop-blur-sm"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          <span>New Analysis</span>
        </button>
      </div>

      {/* User Profile Section */}
      {user && (
        <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">
                    {(user?.ensName && user.ensName.trim()) 
                      ? user.ensName 
                      : (user?.walletAddress ? formatAddress(user.walletAddress) : 'Wallet User')}
                  </p>
                  <button
                    onClick={() => setProfileOpen(true)}
                    className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                    title="Edit profile"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <p className="text-xs text-green-400 font-medium">Connected</p>
                  </div>
                  <span className="text-gray-500">•</span>
                  <p className="text-xs text-gray-400">
                    {user?.subscriptionTier || 'Free Plan'}
                  </p>
                </div>
                <div className="mt-1">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-600 rounded-full h-1">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-green-400 h-1 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(((user?.apiCallsCount || 0) / (user?.apiCallsLimit || 100)) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">
                      {user?.apiCallsCount || 0}/{user?.apiCallsLimit || 100}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-all duration-200"
              title="Disconnect Wallet"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {/* Profile Modal */}
          <ProfileModal
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            onSaved={async () => {
              await refreshProfile();
              setProfileOpen(false);
            }}
          />
        </div>
      )}

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-sm text-gray-400 font-medium">No conversations yet</p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">Start by creating a new analysis<br />to audit your smart contracts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedConversations).map(([timeGroup, convs]) => 
              convs.length > 0 && (
              <div key={timeGroup} className="space-y-2">
                <div className="text-xs text-gray-400 px-2 py-1 font-semibold uppercase tracking-wider">
                  {timeGroup}
                </div>
                {convs.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredConversation(conversation.id)}
                    onMouseLeave={() => setHoveredConversation(null)}
                  >
                    {editingConversation === conversation.id ? (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg">
                        <MessageSquare className="w-4 h-4 flex-shrink-0 text-blue-400" />
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(conversation.id)
                            if (e.key === 'Escape') setEditingConversation(null)
                          }}
                          onBlur={() => handleSaveEdit(conversation.id)}
                          className="flex-1 bg-transparent text-white text-sm outline-none border-b border-blue-400"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectConversation(conversation.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 relative group ${
                          activeConversation === conversation.id
                            ? 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/40 text-white shadow-lg backdrop-blur-sm'
                            : 'hover:bg-gray-800/60 text-gray-300 hover:border-gray-700/50 border border-transparent'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                          activeConversation === conversation.id ? 'text-blue-400' : 'text-gray-400'
                        }`} />
                        <span className="flex-1 min-w-0 text-sm truncate">
                          {truncateTitle(conversation.title)}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(conversation.timestamp)}</span>
                      </button>
                    )}

                    {/* Hover actions */}
                    {hoveredConversation === conversation.id && editingConversation !== conversation.id && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 bg-gray-800 rounded-md px-1">
                        <button 
                          onClick={(e) => handleEditConversation(conversation, e)}
                          className="p-1 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-400"
                          title="Rename conversation"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteConversation(conversation.id, e)}
                          className="p-1 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
