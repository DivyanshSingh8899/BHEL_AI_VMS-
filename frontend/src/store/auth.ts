import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Cookies from 'js-cookie'
import { authApi } from '@/lib/api'

interface User {
  id: number
  username: string
  full_name: string
  email: string
  role: 'admin' | 'security_officer' | 'employee' | 'receptionist'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true })
        try {
          const { data } = await authApi.login(username, password)
          Cookies.set('access_token', data.access_token, { expires: 1, secure: true, sameSite: 'strict' })
          Cookies.set('refresh_token', data.refresh_token, { expires: 7, secure: true, sameSite: 'strict' })
          set({
            user: {
              id: data.user_id,
              username: data.username,
              full_name: data.full_name,
              email: '',
              role: data.role,
            },
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        try { await authApi.logout() } catch {}
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        set({ user: null, isAuthenticated: false })
      },

      hydrate: async () => {
        const token = Cookies.get('access_token')
        if (!token) { set({ isAuthenticated: false, user: null }); return }
        try {
          const { data } = await authApi.me()
          set({ user: data, isAuthenticated: true })
        } catch {
          Cookies.remove('access_token')
          set({ user: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'bhel-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
