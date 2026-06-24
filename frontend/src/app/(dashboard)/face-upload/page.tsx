'use client'

import { useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'

export default function FaceUploadPage() {
  const webcamRef = useRef<Webcam | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')

  const capture = () => {
    const img = webcamRef.current?.getScreenshot() || null
    setCaptured(img)
  }

  const upload = async () => {
    if (!userId) return toast.error('Enter user ID')
    if (!captured) return toast.error('Capture an image first')
    setLoading(true)
    try {
      const res = await fetch(captured)
      const blob = await res.blob()
      const form = new FormData()
      form.append('photo', blob, 'photo.jpg')
      await adminApi.uploadUserPhoto(userId, form)
      toast.success('Photo uploaded and stored')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Upload failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Admin — Upload / Retake Face Photo</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full h-64 rounded-lg border object-cover"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={capture}
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
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">User ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter target user id (e.g., BHEL-VST-2026-0001)"
            className="w-full px-3 py-2 border rounded mb-3"
          />

          {captured && <img src={captured} alt="captured" className="w-56 h-44 object-cover rounded mb-3" />}

          <div className="flex gap-2">
            <button
              onClick={upload}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {loading ? 'Uploading...' : 'Upload to User'}
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-3">Note: This requires admin privileges. Use this to update staff/visitor face photos.</p>
        </div>
      </div>
    </div>
  )
}
