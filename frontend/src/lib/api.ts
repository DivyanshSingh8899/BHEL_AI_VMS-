import axios, { AxiosError } from 'axios'
import Cookies from 'js-cookie'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = Cookies.get('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh })
          Cookies.set('access_token', data.access_token, { expires: 1, secure: true, sameSite: 'strict' })
          Cookies.set('refresh_token', data.refresh_token, { expires: 7, secure: true, sameSite: 'strict' })
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

// Admin
export const adminApi = {
  uploadUserPhoto: (userId: number | string, formData: FormData) => api.post(`/auth/users/${userId}/photo`, formData),
}

// Visitors
export const visitorApi = {
  register: (data: any) => api.post('/visitors/register', data),
  enrollFace: (data: any) => api.post('/visitors/enroll-face', data),
  list: (params?: any) => api.get('/visitors', { params }),
  get: (visitorId: string) => api.get(`/visitors/${visitorId}`),
  getLogs: (visitorId: string) => api.get(`/visitors/${visitorId}/entry-exit-logs`),
}

// Gate
export const gateApi = {
  recognize: (image: string, gateType: 'entry' | 'exit', cameraId?: string) =>
    api.post('/gate/recognize', { image, gate_type: gateType, camera_id: cameraId }),
  verifyQR: (token: string, gateType: 'entry' | 'exit') =>
    api.post(`/gate/qr-verify?pass_token=${token}&gate_type=${gateType}`),
}

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  dailyTrend: (days?: number) => api.get('/dashboard/daily-trend', { params: { days } }),
  departmentAnalytics: () => api.get('/dashboard/department-analytics'),
  hourlyDistribution: () => api.get('/dashboard/hourly-distribution'),
  monthlySummary: (year?: number) => api.get('/dashboard/monthly-summary', { params: { year } }),
  activeVisitors: () => api.get('/dashboard/active-visitors'),
}

// Approvals
export const approvalApi = {
  pending: () => api.get('/approvals/pending'),
  action: (approvalId: number, data: any) => api.post(`/approvals/${approvalId}/action`, data),
}

// Blacklist
export const blacklistApi = {
  list: () => api.get('/blacklist'),
  add: (visitorId: string, reason: string) => api.post('/blacklist', { visitor_id: visitorId, reason }),
  remove: (blacklistId: string, reason: string) =>
    api.delete(`/blacklist/${blacklistId}`, { data: { removal_reason: reason } }),
}

// Reports
export const reportApi = {
  summary: (dateFrom: string, dateTo: string) =>
    api.get('/reports/summary', { params: { date_from: dateFrom, date_to: dateTo } }),
  downloadCSV: (dateFrom: string, dateTo: string, dept?: string) => {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (dept) params.append('department', dept)
    window.open(`${BASE_URL}/reports/csv?${params}&token=${Cookies.get('access_token')}`)
  },
  downloadExcel: (dateFrom: string, dateTo: string, dept?: string) => {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (dept) params.append('department', dept)
    window.open(`${BASE_URL}/reports/excel?${params}&token=${Cookies.get('access_token')}`)
  },
}
