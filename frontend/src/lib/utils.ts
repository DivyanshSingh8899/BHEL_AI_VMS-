import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return 'In Progress'
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // Input: DD-MM-YYYY, output: 19 Jun 2026
  const [d, m, y] = dateStr.split('-')
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[parseInt(m)]} ${y}`
}

export function todayFormatted(): string {
  const now = new Date()
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const y = now.getFullYear()
  return `${d}-${m}-${y}`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    inside: 'bg-blue-100 text-blue-800',
    exited: 'bg-gray-100 text-gray-800',
    blacklisted: 'bg-red-100 text-red-900 font-bold',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}
