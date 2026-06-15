import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../api/axios'

export default function QrScan() {
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const [status, setStatus] = useState('scanning') // 'scanning' | 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')
  const [outletName, setOutletName] = useState('')

  useEffect(() => {
    const html5QrCode = new Html5Qrcode('qr-reader')
    scannerRef.current = html5QrCode

    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        // Stop scanning immediately
        try { await html5QrCode.stop() } catch {}

        // Extract outletId from URL in QR: http://host:5173/qr/:outletId
        let outletId = null
        try {
          const url = new URL(decodedText)
          const match = url.pathname.match(/^\/qr\/(.+)$/)
          if (match) outletId = match[1]
        } catch {}

        if (!outletId) {
          setMessage('رمز QR غير صالح — تأكد أنه رمز منفذ تموين')
          setStatus('error')
          return
        }

        setStatus('loading')
        try {
          const { data } = await api.post('/qr/scan', { outletId })
          setOutletName(data.outletName)
          setStatus('success')
        } catch (err) {
          const msg = err.response?.data?.error || 'حدث خطأ — حاول مجدداً'
          if (err.response?.status === 401) {
            setMessage('يجب تسجيل الدخول أولاً')
          } else {
            setMessage(msg)
          }
          setStatus('error')
        }
      },
      () => {}
    ).catch(() => {
      setMessage('تعذّر الوصول للكاميرا — تأكد من منح إذن الكاميرا')
      setStatus('error')
    })

    return () => { html5QrCode.stop().catch(() => {}) }
  }, [])

  function retry() {
    setStatus('scanning')
    setMessage('')
    // Re-mount by navigating to same page
    navigate(0)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4" dir="rtl">

      {/* SCANNING */}
      {status === 'scanning' && (
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center text-white space-y-1">
            <p className="text-3xl">📷</p>
            <h1 className="text-xl font-bold">امسح رمز QR المنفذ</h1>
            <p className="text-gray-400 text-sm">وجّه الكاميرا نحو الرمز الموجود على شاشة المنفذ</p>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border-4 border-green-500">
            <div id="qr-reader" className="w-full" />
          </div>
          <button onClick={() => navigate(-1)}
            className="w-full border border-gray-600 text-gray-400 py-3 rounded-xl hover:bg-gray-800 transition text-sm">
            إلغاء
          </button>
        </div>
      )}

      {/* LOADING */}
      {status === 'loading' && (
        <div className="text-center text-white space-y-4">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-medium">جاري التسجيل في المنفذ...</p>
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center space-y-4" dir="rtl">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-5xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-green-700">تم التسجيل بنجاح!</h2>
            <p className="text-gray-600 text-sm">
              تم التعرف عليك تلقائياً في<br />
              <span className="font-bold text-gray-800 text-base">{outletName}</span>
            </p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 text-sm font-medium">
                أخبر موظف المنفذ — ستظهر بياناتك عنده الآن وسيبدأ إتمام عملية الشراء
              </p>
            </div>
            <button onClick={() => navigate('/user')}
              className="w-full border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 transition text-sm mt-2">
              العودة للرئيسية
            </button>
          </div>
        </div>
      )}

      {/* ERROR */}
      {status === 'error' && (
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white rounded-2xl p-8 text-center space-y-4" dir="rtl">
            <span className="text-5xl">❌</span>
            <p className="text-red-600 font-bold">{message}</p>
            <div className="flex gap-2">
              <button onClick={() => navigate(-1)}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 text-sm">
                رجوع
              </button>
              <button onClick={retry}
                className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 text-sm">
                حاول مجدداً
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
