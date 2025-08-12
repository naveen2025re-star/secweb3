import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getUserProfile, updateUserProfile } from '../utils/api'

const ProfileModal = ({ open, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [walletAddress, setWalletAddress] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!open) return
      setLoading(true)
      try {
        const res = await getUserProfile()
        if (res.success && res.user) {
          setDisplayName(res.user.ensName || '')
          setWalletAddress(res.user.walletAddress || '')
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setSaving(true)
    try {
      const res = await updateUserProfile(displayName.trim())
      if (res.success && res.user) {
        onSaved?.(res.user)
        onClose?.()
      }
    } catch (e) {
      // surface minimal error to user
      alert('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <button
          className="absolute top-3 right-3 p-2 rounded hover:bg-gray-800 text-gray-400"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-semibold text-white mb-1">Profile</h3>
        <p className="text-xs text-gray-400 mb-4">Manage your display name and wallet.</p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Wallet address</label>
            <input
              type="text"
              value={walletAddress}
              readOnly
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || loading || !displayName.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfileModal
