'use client'
import { useState, useEffect } from 'react'
import { approvalApi } from '@/lib/api'
import { CheckSquare, Check, X, Calendar, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)

  const fetchApprovals = async () => {
    try {
      const res = await approvalApi.pending()
      setApprovals(res.data)
    } catch { toast.error('Failed to load approvals') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchApprovals() }, [])

  const processAction = async (id: number, action: string) => {
    setProcessing(id)
    try {
      await approvalApi.action(id, { action })
      toast.success(`Visitor ${action}d successfully`)
      fetchApprovals()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || `Failed to ${action}`)
    } finally { setProcessing(null) }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CheckSquare className="w-7 h-7 text-blue-900" /> Visitor Approvals
        </h1>
        <p className="text-gray-500 text-sm mt-1">{approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="bhel-card p-12 text-center text-gray-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-sm">No pending visitor approvals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((a: any) => (
            <div key={a.approval_id} className="bhel-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{a.visitor_name?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{a.visitor_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{a.visitor_id}</p>
                    </div>
                    <span className="ml-auto bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium">
                      Pending
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Mobile</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{a.mobile}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Company</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{a.company || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Department</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{a.department || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Host Employee</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{a.host_employee}</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-gray-400">Purpose of Visit</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{a.purpose}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    Requested: {new Date(a.requested_at).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => processAction(a.approval_id, 'approve')}
                  disabled={processing === a.approval_id}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => processAction(a.approval_id, 'reject')}
                  disabled={processing === a.approval_id}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
