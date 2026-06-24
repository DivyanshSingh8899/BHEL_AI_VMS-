'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Shield, Cpu } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.username, data.password)
      toast.success('Login successful')
      router.push('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid credentials'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bhel-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-blue-900 font-black text-xl">BHEL</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">BHEL Smart VMS</h1>
          <p className="text-blue-200 mt-1 text-sm">AI-Powered Visitor Management System</p>
          <p className="text-blue-300 text-xs mt-1">Bharat Heavy Electricals Limited, Varanasi</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-blue-900" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Secure Login</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username / Email
              </label>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent
                           transition-all duration-200"
                placeholder="Enter username or email"
              />
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent
                             transition-all duration-200 pr-12"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bhel-gradient text-white font-semibold rounded-lg
                         hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                         flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Cpu className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-center text-gray-500">
              <div className="flex items-center gap-1 justify-center">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Face Recognition Active
              </div>
              <div className="flex items-center gap-1 justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                Secure JWT Auth
              </div>
            </div>
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="text-blue-900 dark:text-blue-400 font-semibold hover:underline"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-blue-200 text-xs mt-4">
          © 2026 BHEL Varanasi | Smart AI Visitor Management System v1.0
        </p>
      </div>
    </div>
  )
}
