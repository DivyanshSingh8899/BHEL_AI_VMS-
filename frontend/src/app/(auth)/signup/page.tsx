'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import Webcam from 'react-webcam'
import { Eye, EyeOff, UserPlus, ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

const schema = z
  .object({
    full_name: z.string().min(3, 'Full name must be at least 3 characters'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores allowed'),
    email: z.string().email('Invalid email address'),
    phone: z.string().regex(/^\d{10}$/, 'Enter valid 10-digit mobile number').optional().or(z.literal('')),
    role: z.enum(['admin', 'security_officer', 'receptionist', 'employee']),
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/\d/, 'Must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Must contain at least one special character'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type FormData = z.infer<typeof schema>

const ROLES = [
  { value: 'admin', label: 'Administrator', desc: 'Full system access' },
  { value: 'security_officer', label: 'Security Officer', desc: 'Gate & blacklist management' },
  { value: 'receptionist', label: 'Receptionist', desc: 'Visitor registration & approvals' },
  { value: 'employee', label: 'Employee', desc: 'View & approve assigned visitors' },
]

export default function SignUpPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const webcamRef = useRef<Webcam | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'employee' },
  })

  const password = watch('password', '')

  const passwordStrength = (pw: string) => {
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[a-z]/.test(pw)) score++
    if (/\d/.test(pw)) score++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++
    return score
  }

  const strength = passwordStrength(password)
  const strengthLabel = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][strength]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'][strength]

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const form = new FormData()
      form.append('full_name', data.full_name)
      form.append('username', data.username)
      form.append('email', data.email)
      if (data.phone) form.append('phone', data.phone)
      form.append('role', data.role)
      form.append('password', data.password)
      // attach captured photo if available
      if (captured) {
        const res = await fetch(captured)
        const blob = await res.blob()
        form.append('photo', blob, 'photo.jpg')
      }
      await api.post('/auth/register', form)
      toast.success('Account created! Please login.')
      router.push('/login')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bhel-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-blue-900 font-black text-lg">BHEL</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-blue-200 text-sm mt-1">BHEL Smart AI Visitor Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-blue-900" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Staff Registration</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Webcam capture */}
            <div className="flex gap-3 items-start">
              <div>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="rounded-lg w-48 h-36 border"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const img = webcamRef.current?.getScreenshot() || null
                      setCaptured(img)
                    }}
                    className="px-3 py-1 bg-blue-900 text-white rounded"
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptured(null)}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {captured && (
                <img src={captured} alt="captured" className="w-48 h-36 object-cover rounded-lg" />
              )}
            </div>
            {/* Full Name + Username */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('full_name')}
                  className={inputCls(!!errors.full_name)}
                  placeholder="Amit Kumar Singh"
                />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('username')}
                  className={inputCls(!!errors.username)}
                  placeholder="amit_singh"
                />
                {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                {...register('email')}
                type="email"
                className={inputCls(!!errors.email)}
                placeholder="amit.singh@bhel.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Phone Number
                </label>
                <input
                  {...register('phone')}
                  className={inputCls(!!errors.phone)}
                  placeholder="9876543210"
                  maxLength={10}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select {...register('role')} className={inputCls(!!errors.role)}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Description */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              <Shield className="w-3.5 h-3.5 inline mr-1" />
              {ROLES.find((r) => r.value === watch('role'))?.desc}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={inputCls(!!errors.password) + ' pr-10'}
                  placeholder="Min 8 chars, upper, lower, number, symbol"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-1.5">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength ? strengthColor : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{strengthLabel}</p>
                </div>
              )}
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register('confirm_password')}
                  type={showConfirm ? 'text' : 'password'}
                  className={inputCls(!!errors.confirm_password) + ' pr-10'}
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bhel-gradient text-white font-semibold rounded-lg
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 transition-all mt-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-900 dark:text-blue-400 font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-blue-200 text-xs mt-4">
          © 2026 BHEL Varanasi | Smart AI Visitor Management System
        </p>
      </div>
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2.5 border rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white
    focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition-all
    ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 dark:border-gray-600'}`
}
