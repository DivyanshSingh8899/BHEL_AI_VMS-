'use client'
import { useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'
import { gateApi } from '@/lib/api'
import { LogOut, CheckCircle, AlertTriangle, Clock, User, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ExitGatePage() {
  const webcamRef = useRef<Webcam>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)

  const scan = useCallback(async () => {
    const img = webcamRef.current?.getScreenshot()
    if (!img) return
    setStatus('scanning')
    try {
      const res = await gateApi.recognize(img, 'exit', 'EXIT-CAM-001')
      setResult(res.data)
      if (res.data.matched && res.data.log_id) {
        setStatus('success')
        toast.success(`Exit recorded: ${res.data.visitor_name}`)
        setTimeout(() => { setStatus('idle'); setResult(null) }, 6000)
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('idle')
    }
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <LogOut className="w-7 h-7 text-blue-900" /> Exit Gate
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">BHEL Varanasi — Main Exit Gate Camera</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bhel-card p-4">
          <div className="relative">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full rounded-lg"
              videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
            />
            <div className="absolute inset-0 pointer-events-none">
              <div className={cn(
                'absolute inset-4 border-2 rounded-lg',
                status === 'success' ? 'border-green-400' : 'border-white/30'
              )} />
              <div className="absolute top-4 left-4 bg-orange-500 text-white text-xs px-2 py-1 rounded font-bold">
                EXIT GATE
              </div>
            </div>
          </div>
          <button
            onClick={scan}
            disabled={status === 'scanning'}
            className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold
                       disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            {status === 'scanning' ? 'Processing Exit...' : 'Record Exit'}
          </button>
        </div>

        <div className="lg:col-span-2">
          {status === 'success' && result ? (
            <div className="bhel-card border-2 border-green-400 p-6 space-y-4">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-green-700">Exit Recorded ✓</h3>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{result.visitor_name}</p>
                    <p className="text-xs text-gray-500">{result.visitor_id}</p>
                  </div>
                </div>
                <hr className="border-green-200" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Department</p>
                    <p className="font-medium">{result.department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Host Employee</p>
                    <p className="font-medium">{result.host_employee}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                  <Timer className="w-5 h-5 text-blue-900 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Visit Duration</p>
                  <p className="font-bold text-blue-900 text-lg">
                    {result.message?.replace('Exit recorded. Duration: ', '') || 'Completed'}
                  </p>
                </div>
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="bhel-card border-2 border-red-300 p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="font-bold text-red-700">Exit Failed</h3>
              <p className="text-gray-500 text-sm mt-2">{result?.message || 'No active visit found for this visitor.'}</p>
            </div>
          ) : (
            <div className="bhel-card p-6 text-center text-gray-400">
              <LogOut className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Scan visitor face to record exit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
