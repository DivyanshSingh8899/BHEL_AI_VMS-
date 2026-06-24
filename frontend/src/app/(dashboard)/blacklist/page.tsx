'use client'
import { useState, useEffect } from 'react'
import { blacklistApi } from '@/lib/api'
import { Ban, Plus, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BlacklistPage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [visitorId, setVisitorId] = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchList = async () => {
    try {
      const res = await blacklistApi.list()
      setList(res.data)
    } catch { toast.error('Failed to load blacklist') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchList() }, [])

  const addToBlacklist = async () => {
    if (!visitorId || !reason) { toast.error('Visitor ID and reason required'); return }
    setAdding(true)
    try {
      await blacklistApi.add(visitorId, reason)
      toast.success('Visitor added to blacklist')
      setShowAdd(false); setVisitorId(''); setReason('')
      fetchList()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add')
    } finally { setAdding(false) }
  }

  const removeFromBlacklist = async (blacklistId: string) => {
    const removeReason = prompt('Reason for removal?')
    if (!removeReason) return
    try {
      await blacklistApi.remove(blacklistId, removeReason)
      toast.success('Removed from blacklist')
      fetchList()
    } catch { toast.error('Failed to remove') }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Ban className="w-7 h-7 text-red-600" /> Blacklist Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage restricted visitors</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700">
          <Plus className="w-4 h-4" /> Add to Blacklist
        </button>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-red-800 dark:text-red-300">Security Notice</p>
          <p className="text-red-600 dark:text-red-400">Blacklisted visitors will be denied entry and trigger a security alert at all gates.</p>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bhel-card p-6">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Add Visitor to Blacklist</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Visitor ID *</label>
              <input value={visitorId} onChange={e => setVisitorId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="BHEL-VST-2026-0001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason *</label>
              <input value={reason} onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Reason for blacklisting" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addToBlacklist} disabled={adding}
              className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {adding ? 'Adding...' : 'Confirm Blacklist'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bhel-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No blacklisted visitors</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-red-50 dark:bg-red-900/20 border-b border-red-100">
              <tr>
                {['Blacklist ID', 'Visitor ID', 'Name', 'Mobile', 'Reason', 'Blacklisted On', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-red-700 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((entry: any) => (
                <tr key={entry.blacklist_id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                  <td className="px-4 py-3 font-mono text-xs text-red-600">{entry.blacklist_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.visitor_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{entry.name}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.mobile}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.reason}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(entry.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeFromBlacklist(entry.blacklist_id)}
                      className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded" title="Remove from blacklist">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
