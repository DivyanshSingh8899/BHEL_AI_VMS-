'use client'
import { useEffect, useState, useCallback } from 'react'
import { dashboardApi } from '@/lib/api'
import { Users, UserCheck, UserX, Clock, TrendingUp, Building2, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { formatDuration } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

const COLORS = ['#1a3a5c', '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2']

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="bhel-card p-6 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<any>(null)
  const [dailyTrend, setDailyTrend] = useState<any[]>([])
  const [deptData, setDeptData] = useState<any[]>([])
  const [hourlyData, setHourlyData] = useState<any[]>([])
  const [activeVisitors, setActiveVisitors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [s, trend, dept, hourly, active] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.dailyTrend(14),
        dashboardApi.departmentAnalytics(),
        dashboardApi.hourlyDistribution(),
        dashboardApi.activeVisitors(),
      ])
      setStats(s.data)
      setDailyTrend(trend.data)
      setDeptData(dept.data)
      setHourlyData(hourly.data.filter((h: any) => h.count > 0 || (new Date().getHours() === h.hour)))
      setActiveVisitors(active.data.slice(0, 10))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good {now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'},{' '}
            {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{dateStr} • {timeStr}</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-blue-900 dark:text-blue-200 font-medium">Live Dashboard</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Visitors Today" value={stats?.total_today ?? 0}
          sub="Registered entries today" color="bg-blue-900" />
        <StatCard icon={UserCheck} label="Currently Inside" value={stats?.active_inside ?? 0}
          sub="On campus right now" color="bg-green-600" />
        <StatCard icon={UserX} label="Exited Today" value={stats?.exited_today ?? 0}
          sub="Completed visits" color="bg-gray-600" />
        <StatCard icon={Clock} label="Pending Approvals" value={stats?.pending_approvals ?? 0}
          sub="Awaiting host approval" color="bg-yellow-600" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Trend */}
        <div className="lg:col-span-2 bhel-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Daily Visitor Trend (Last 14 Days)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a3a5c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1a3a5c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(0, 5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [v, 'Visitors']} />
              <Area type="monotone" dataKey="count" stroke="#1a3a5c" strokeWidth={2}
                fill="url(#colorVisitors)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Department Pie */}
        <div className="bhel-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Department Distribution
          </h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deptData} dataKey="count" nameKey="department"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3}>
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend formatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly */}
        <div className="bhel-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Peak Hours (Today)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a3a5c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Visitors Table */}
        <div className="lg:col-span-2 bhel-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Currently Inside Campus
            </h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {activeVisitors.length} Active
            </span>
          </div>
          {activeVisitors.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No visitors currently inside</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left pb-2">Visitor</th>
                    <th className="text-left pb-2">Department</th>
                    <th className="text-left pb-2">Host</th>
                    <th className="text-left pb-2">Entry</th>
                    <th className="text-left pb-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeVisitors.map((v: any) => (
                    <tr key={v.visitor_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5">
                        <div className="font-medium text-gray-900 dark:text-white">{v.name}</div>
                        <div className="text-xs text-gray-400">{v.visitor_id}</div>
                      </td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">{v.department || '—'}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">{v.host_employee}</td>
                      <td className="py-2.5 text-gray-600">{v.entry_time}</td>
                      <td className="py-2.5">
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {v.duration_so_far}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Stat */}
      <div className="bhel-card p-4 flex items-center gap-4">
        <TrendingUp className="w-8 h-8 text-blue-900 dark:text-blue-400" />
        <div>
          <p className="text-sm text-gray-500">This Month's Total Visitors</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.monthly_count ?? 0}</p>
        </div>
        <div className="ml-auto text-xs text-gray-400">
          Last updated: {stats?.last_updated ? new Date(stats.last_updated).toLocaleTimeString() : '—'}
        </div>
      </div>
    </div>
  )
}
