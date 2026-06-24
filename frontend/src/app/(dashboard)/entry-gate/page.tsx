'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { gateApi } from '@/lib/api'
import { CheckCircle, XCircle, AlertTriangle, Camera, Wifi, User, Building2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type GateStatus = 'idle' | 'scanning' | 'success' | 'unknown' | 'blacklisted' | 'denied'

interface RecognitionData {
  visitor_id?: string
  visitor_name?: string
  department?: string
  purpose?: string
  host_employee?: string
  confidence?: number
  message?: string
  entry_time?: string
  log_id?: string
  is_blacklisted?: boolean
}

export default function EntryGatePage() {
  const webcamRef = useRef<Webcam>(null)
  const [status, setStatus] = useState<GateStatus>('idle')
  const [data, setData] = useState<RecognitionData>({})
  const [isAutoScanning, setIsAutoScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string>('')
  const [scanCount, setScanCount] = useState(0)
  const scanIntervalRef = useRef<NodeJS.Timeout>()

  const processFrame = useCallback(async () => {
    const screenshot = webcamRef.current?.getScreenshot()
    if (!screenshot) return

    setStatus('scanning')
    try {
      const res = await gateApi.recognize(screenshot, 'entry', 'ENTRY-CAM-001')
      const result = res.data
      setScanCount(c => c + 1)
      setLastScan(new Date().toLocaleTimeString())

      if (result.is_blacklisted) {
        setStatus('blacklisted')
        setData(result)
        toast.error('SECURITY ALERT: Blacklisted visitor detected!')
        if (isAutoScanning) {
          clearInterval(scanIntervalRef.current)
          setIsAutoScanning(false)
        }
      } else if (result.matched && result.log_id) {
        setStatus('success')
        setData(result)
        toast.success(`Entry recorded: ${result.visitor_name}`)
        // Auto-reset after 5s
        setTimeout(() => { setStatus('idle'); setData({}) }, 5000)
      } else if (result.matched && !result.log_id) {
        setStatus('denied')
        setData(result)
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('unknown')
        setData(result)
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('idle')
    }
  }, [isAutoScanning])

  const toggleAutoScan = useCallback(() => {
    if (isAutoScanning) {
      clearInterval(scanIntervalRef.current)
      setIsAutoScanning(false)
    } else {
      setIsAutoScanning(true)
      scanIntervalRef.current = setInterval(processFrame, 2000)
    }
  }, [isAutoScanning, processFrame])

  useEffect(() => {
    return () => clearInterval(scanIntervalRef.current)
  }, [])

  const statusConfig = {
    idle: { bg: 'bg-gray-50 dark:bg-gray-900', border: 'border-gray-200', icon: Camera, color: 'text-gray-400', title: 'Entry Gate Ready', msg: 'Camera is active. Click Scan or enable Auto-Scan.' },
    scanning: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300', icon: Camera, color: 'text-blue-600', title: 'Scanning...', msg: 'Processing face recognition...' },
    success: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-400', icon: CheckCircle, color: 'text-green-600', title: 'Entry Granted ✓', msg: '' },
    unknown: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-400', icon: AlertTriangle, color: 'text-yellow-600', title: 'Unknown Visitor', msg: 'Visitor not registered. Please register at reception.' },
    blacklisted: { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-500', icon: XCircle, color: 'text-red-700', title: '⚠ SECURITY ALERT', msg: 'BLACKLISTED VISITOR DETECTED' },
    denied: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-400', icon: XCircle, color: 'text-orange-600', title: 'Entry Denied', msg: '' },
  }
  const cfg = statusConfig[status]

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-7 h-7 text-blue-900" /> Entry Gate
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">BHEL Varanasi — Main Entry Gate Camera</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-gray-500">Scans: {scanCount}</span>
            {lastScan && <span className="text-gray-400">Last: {lastScan}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Camera Feed */}
        <div className="lg:col-span-3 bhel-card p-4">
          <div className="relative">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full rounded-lg"
              videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
              screenshotQuality={0.85}
            />
            {/* Scan overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className={cn(
                'absolute inset-4 border-2 rounded-lg transition-all duration-300',
                status === 'success' ? 'border-green-400 face-detect-box' :
                  status === 'blacklisted' ? 'border-red-500' :
                    status === 'scanning' ? 'border-blue-400' : 'border-white/30'
              )} />
              {(status === 'idle' || status === 'scanning') && (
                <div className="absolute left-0 right-0 h-0.5 bg-green-400/60 scan-line opacity-60" />
              )}
              {isAutoScanning && status !== 'success' && (
                <div className="absolute top-6 right-6 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={processFrame}
              disabled={status === 'scanning'}
              className="flex-1 bhel-gradient text-white py-2.5 rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              {status === 'scanning' ? 'Processing...' : 'Scan Face'}
            </button>
            <button
              onClick={toggleAutoScan}
              className={cn(
                'px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                isAutoScanning
                  ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                  : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
              )}
            >
              {isAutoScanning ? 'Stop Auto' : 'Auto Scan'}
            </button>
          </div>
        </div>

        {/* Status Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className={cn('rounded-xl border-2 p-6 transition-all duration-500', cfg.bg, cfg.border)}>
            <div className="flex items-start gap-3 mb-4">
              <cfg.icon className={cn('w-8 h-8 flex-shrink-0', cfg.color)} />
              <div>
                <h3 className={cn('font-bold text-lg', cfg.color)}>{cfg.title}</h3>
                <p className="text-gray-500 text-sm">{cfg.msg || data.message}</p>
              </div>
            </div>

            {(status === 'success' || status === 'denied') && data.visitor_name && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{data.visitor_name}</p>
                    <p className="text-xs text-gray-500">{data.visitor_id}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-green-600 font-medium">{Math.round((data.confidence || 0) * 100)}%</p>
                    <p className="text-xs text-gray-400">Match</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoBox icon={Building2} label="Department" value={data.department || 'N/A'} />
                  <InfoBox icon={User} label="Host" value={data.host_employee || 'N/A'} />
                  {status === 'success' && (
                    <InfoBox icon={Clock} label="Entry Time" value={data.entry_time || 'Now'} className="col-span-2" />
                  )}
                </div>

                {status === 'success' && (
                  <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                    <p className="text-green-700 dark:text-green-300 font-bold">✓ Entry Logged Successfully</p>
                    <p className="text-green-600 text-xs mt-1">Log ID: {data.log_id}</p>
                  </div>
                )}
              </div>
            )}

            {status === 'blacklisted' && (
              <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 text-center">
                <p className="text-red-800 dark:text-red-300 font-bold text-lg">🚨 DO NOT ALLOW ENTRY</p>
                <p className="text-red-600 text-sm mt-1">{data.visitor_name}</p>
                <p className="text-red-500 text-xs">Notify security immediately</p>
              </div>
            )}

            {status === 'unknown' && (
              <button
                onClick={() => window.location.href = '/dashboard/registration'}
                className="w-full mt-3 bg-blue-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
              >
                Register This Visitor
              </button>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bhel-card p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Gate Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Camera</span>
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Active
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">AI Engine</span>
                <span className="text-green-600 font-medium">Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Auto Scan</span>
                <span className={isAutoScanning ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                  {isAutoScanning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ icon: Icon, label, value, className }: any) {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700', className)}>
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-gray-900 dark:text-white font-medium text-sm truncate">{value}</p>
    </div>
  )
}
