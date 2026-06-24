'use client'
import { useState } from 'react'
import { reportApi } from '@/lib/api'
import { FileBarChart, Download, FileSpreadsheet, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { todayFormatted } from '@/lib/utils'

export default function ReportsPage() {
  const today = todayFormatted()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [dept, setDept] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await reportApi.summary(dateFrom, dateTo)
      setSummary(res.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileBarChart className="w-7 h-7 text-blue-900" /> Reports
        </h1>
        <p className="text-gray-500 text-sm mt-1">Generate and download visitor reports</p>
      </div>

      {/* Filters */}
      <div className="bhel-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Report Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date (DD-MM-YYYY)</label>
            <input value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="01-06-2026" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date (DD-MM-YYYY)</label>
            <input value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="30-06-2026" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Department (optional)</label>
            <input value={dept} onChange={e => setDept(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="All departments" />
          </div>
        </div>
        <button onClick={fetchSummary} disabled={loading}
          className="mt-4 bhel-gradient text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bhel-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Report Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Visits', value: summary.total_visits, color: 'text-blue-900' },
              { label: 'Completed', value: summary.completed_visits, color: 'text-green-700' },
              { label: 'Active', value: summary.active_visits, color: 'text-yellow-700' },
              { label: 'Avg Duration', value: `${summary.avg_duration_minutes}m`, color: 'text-gray-700' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Department breakdown */}
          {Object.keys(summary.department_breakdown || {}).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Department</h4>
              <div className="space-y-2">
                {Object.entries(summary.department_breakdown).map(([dept, count]: any) => (
                  <div key={dept} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 truncate">{dept}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bhel-gradient h-2 rounded-full"
                        style={{ width: `${(count / summary.total_visits) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download Buttons */}
      <div className="bhel-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Download Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => reportApi.downloadExcel(dateFrom, dateTo, dept)}
            className="flex items-center justify-center gap-3 p-4 border-2 border-green-300 bg-green-50 text-green-800
                       rounded-xl hover:bg-green-100 transition-colors"
          >
            <FileSpreadsheet className="w-6 h-6 text-green-700" />
            <div className="text-left">
              <p className="font-semibold">Download Excel</p>
              <p className="text-xs text-green-600">.xlsx format with formatting</p>
            </div>
            <Download className="w-4 h-4 ml-auto" />
          </button>
          <button
            onClick={() => reportApi.downloadCSV(dateFrom, dateTo, dept)}
            className="flex items-center justify-center gap-3 p-4 border-2 border-blue-300 bg-blue-50 text-blue-800
                       rounded-xl hover:bg-blue-100 transition-colors"
          >
            <FileBarChart className="w-6 h-6 text-blue-700" />
            <div className="text-left">
              <p className="font-semibold">Download CSV</p>
              <p className="text-xs text-blue-600">.csv format for data analysis</p>
            </div>
            <Download className="w-4 h-4 ml-auto" />
          </button>
        </div>
      </div>
    </div>
  )
}
