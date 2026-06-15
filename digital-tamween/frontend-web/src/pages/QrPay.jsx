import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const api = axios.create({ baseURL: `http://${window.location.hostname}:3000` })

export default function QrPay() {
  const { outletId } = useParams()
  const [outlet, setOutlet] = useState(null)
  const [pageError, setPageError] = useState('')

  const [nationalId, setNationalId] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [citizenName, setCitizenName] = useState('')

  useEffect(() => {
    api.get(`/qr/${outletId}/products`)
      .then(({ data }) => setOutlet(data))
      .catch(() => setPageError('المنفذ غير موجود أو غير نشط'))
  }, [outletId])

  async function sendOtp(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/qr/otp/request', { nationalId: nationalId.trim() })
      setCitizenName(data.userName)
      setOtpSent(true)
    } catch (err) { setError(err.response?.data?.error || 'حدث خطأ') }
    setLoading(false)
  }

  async function authenticate(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await api.post('/qr/authenticate', {
        outletId,
        nationalId: nationalId.trim(),
        otp: otpValue.trim(),
      })
      setDone(true)
    } catch (err) { setError(err.response?.data?.error || 'رمز OTP غير صحيح') }
    setLoading(false)
  }

  if (pageError) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
      <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm mx-4">
        <p className="text-4xl mb-3">❌</p>
        <p className="text-red-600 font-bold">{pageError}</p>
      </div>
    </div>
  )

  if (!outlet) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">جاري التحميل...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-green-800 text-white px-4 py-4 shadow">
        <h1 className="font-bold text-base">🛒 تسجيل الدخول للشراء</h1>
        <p className="text-green-200 text-sm">{outlet.name} — {outlet.address}</p>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">

          {/* Done state */}
          {done && (
            <div className="bg-white rounded-2xl shadow p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-5xl">✅</span>
              </div>
              <h2 className="text-xl font-bold text-green-700">تم التحقق بنجاح!</h2>
              <p className="text-gray-600">مرحباً <span className="font-bold">{citizenName}</span></p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-green-700 text-sm font-medium leading-relaxed">
                  أخبر موظف المنفذ — سيبدأ إتمام عملية الشراء من جهازه الآن
                </p>
              </div>
              <p className="text-xs text-gray-400">يمكنك إغلاق هذه الصفحة</p>
            </div>
          )}

          {/* Auth form */}
          {!done && (
            <div className="bg-white rounded-2xl shadow p-6 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="text-3xl">🪪</span>
                </div>
                <h2 className="font-bold text-gray-800 text-lg">تحقق من هويتك</h2>
                <p className="text-gray-500 text-sm">لإتمام الشراء من <span className="font-medium text-green-700">{outlet.name}</span></p>
              </div>

              {!otpSent ? (
                <form onSubmit={sendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الرقم القومي</label>
                    <input value={nationalId} onChange={e => setNationalId(e.target.value)}
                      placeholder="14 رقم" maxLength={14}
                      className="w-full border rounded-xl px-4 py-3 text-center text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-green-500"
                      required />
                  </div>
                  {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50 text-base">
                    {loading ? 'جاري الإرسال...' : '📨 إرسال رمز التحقق'}
                  </button>
                </form>
              ) : (
                <form onSubmit={authenticate} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-700">
                    ✉️ تم إرسال رمز التحقق لرسائلك في التموين
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">أدخل رمز OTP</label>
                    <input value={otpValue} onChange={e => setOtpValue(e.target.value)}
                      placeholder="× × × × × ×" maxLength={6}
                      className="w-full border-2 rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required />
                  </div>
                  {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setOtpSent(false); setOtpValue(''); setError('') }}
                      className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">
                      رجوع
                    </button>
                    <button type="submit" disabled={loading}
                      className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                      {loading ? '...' : 'تأكيد'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
