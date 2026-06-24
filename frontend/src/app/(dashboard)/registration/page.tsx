'use client'
import { useState, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import Webcam from 'react-webcam'
import { Camera, X, UserPlus, CheckCircle } from 'lucide-react'
import { visitorApi } from '@/lib/api'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().regex(/^\d{10}$/, 'Enter valid 10-digit mobile number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  company: z.string().optional(),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
  department_name: z.string().optional(),
  host_employee_name: z.string().min(2, 'Host employee name required'),
  vehicle_number: z.string().optional(),
  id_proof_type: z.enum(['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'employee_id']),
  id_proof_number: z.string().min(5, 'ID proof number required'),
})
type FormData = z.infer<typeof schema>

const DEPARTMENTS = [
  'Engineering', 'Power', 'Manufacturing', 'Quality Control', 'HR', 'Finance',
  'IT', 'Security', 'Administration', 'R&D', 'Maintenance', 'Purchase'
]

export default function RegistrationPage() {
  const [photo, setPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<any>(null)
  const webcamRef = useRef<Webcam>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const capturePhoto = useCallback(() => {
    const img = webcamRef.current?.getScreenshot()
    if (img) {
      setPhoto(img)
      setShowCamera(false)
      toast.success('Photo captured!')
    }
  }, [])

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const payload = { ...data, photo_base64: photo }
      const res = await visitorApi.register(payload)
      setSuccess(res.data)
      reset()
      setPhoto(null)
      toast.success(`Registered! Visitor ID: ${res.data.visitor_id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="bhel-card p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Registration Successful!</h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Visitor ID</p>
            <p className="text-3xl font-mono font-bold text-blue-900 dark:text-blue-300">{success.visitor_id}</p>
          </div>
          <div className="text-left space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-6">
            <p><span className="font-medium">Name:</span> {success.name}</p>
            <p><span className="font-medium">Status:</span>{' '}
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">Pending Approval</span>
            </p>
            <p><span className="font-medium">Host:</span> {success.host_employee_name}</p>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            A confirmation has been sent to your email/mobile. Please wait for host approval.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="bhel-gradient text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Register Another Visitor
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UserPlus className="w-7 h-7 text-blue-900" /> Visitor Registration
        </h1>
        <p className="text-gray-500 text-sm mt-1">Register a new visitor for BHEL Varanasi campus access</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Photo Section */}
          <div className="lg:col-span-1">
            <div className="bhel-card p-6">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 text-sm">Visitor Photo</h3>
              {showCamera ? (
                <div className="space-y-3">
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full rounded-lg"
                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={capturePhoto}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                      Capture
                    </button>
                    <button type="button" onClick={() => setShowCamera(false)}
                      className="px-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : photo ? (
                <div className="space-y-3">
                  <img src={photo} alt="Visitor" className="w-full rounded-lg border-2 border-green-300" />
                  <button type="button" onClick={() => setShowCamera(true)}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-900 hover:text-blue-900 transition-colors">
                    Retake Photo
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-32 h-32 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Camera className="w-10 h-10 text-gray-400" />
                  </div>
                  <button type="button" onClick={() => setShowCamera(true)}
                    className="w-full py-3 bhel-gradient text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" /> Open Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="lg:col-span-2 bhel-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal Info */}
              <div className="col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b">
                  Personal Information
                </h3>
              </div>

              <Field label="Full Name *" error={errors.name?.message}>
                <input {...register('name')} className={inputCls} placeholder="Enter full name" />
              </Field>
              <Field label="Mobile Number *" error={errors.mobile?.message}>
                <input {...register('mobile')} className={inputCls} placeholder="10-digit mobile" maxLength={10} />
              </Field>
              <Field label="Email Address" error={errors.email?.message}>
                <input {...register('email')} type="email" className={inputCls} placeholder="email@example.com" />
              </Field>
              <Field label="Vehicle Number">
                <input {...register('vehicle_number')} className={inputCls} placeholder="UP65AB1234 (optional)" />
              </Field>
              <Field label="Address" className="col-span-2">
                <textarea {...register('address')} className={inputCls + ' resize-none'} rows={2}
                  placeholder="Residential address" />
              </Field>

              {/* Visit Info */}
              <div className="col-span-2 pt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b">
                  Visit Details
                </h3>
              </div>

              <Field label="Company / Organization">
                <input {...register('company')} className={inputCls} placeholder="Organization name" />
              </Field>
              <Field label="Department to Visit">
                <select {...register('department_name')} className={inputCls}>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Host Employee Name *" error={errors.host_employee_name?.message}>
                <input {...register('host_employee_name')} className={inputCls} placeholder="Employee name" />
              </Field>
              <Field label="Purpose of Visit *" error={errors.purpose?.message} className="col-span-2">
                <textarea {...register('purpose')} className={inputCls + ' resize-none'} rows={2}
                  placeholder="Describe the purpose of visit" />
              </Field>

              {/* ID Proof */}
              <div className="col-span-2 pt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b">
                  Identity Verification
                </h3>
              </div>

              <Field label="ID Proof Type *" error={errors.id_proof_type?.message}>
                <select {...register('id_proof_type')} className={inputCls}>
                  <option value="">Select ID Type</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="employee_id">Employee ID</option>
                </select>
              </Field>
              <Field label="ID Proof Number *" error={errors.id_proof_number?.message}>
                <input {...register('id_proof_number')} className={inputCls} placeholder="Enter ID number" />
              </Field>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={submitting}
                className="flex-1 bhel-gradient text-white py-3 rounded-lg font-semibold hover:opacity-90
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {submitting ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registering...</>
                ) : (
                  <><UserPlus className="w-5 h-5" /> Register Visitor</>
                )}
              </button>
              <button type="button" onClick={() => { reset(); setPhoto(null) }}
                className="px-6 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                Clear
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

const inputCls = `w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
  bg-white dark:bg-gray-800 text-gray-900 dark:text-white
  focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent`

function Field({ label, error, children, className }: any) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
