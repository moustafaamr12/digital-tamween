import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'خطأ في تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gold-500 rounded-full mb-4 shadow-lg">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">بوابة الأمن الغذائي</h1>
          <p className="text-gold-400 mt-1 text-sm">منظومة دعم القوافل الغذائية الذكية</p>
          <div className="mt-2 h-0.5 w-24 bg-gold-500 mx-auto rounded-full" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-navy-800 font-bold text-lg mb-6 text-center">تسجيل دخول المسؤول الحكومي</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@tamween.gov.eg"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-800 hover:bg-navy-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="animate-spin">⟳</span> جاري التحقق...</>
              ) : (
                'دخول'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-navy-600 text-xs mt-6 opacity-60">
          وزارة التموين والتجارة الداخلية — مصر
        </p>
      </div>
    </div>
  )
}
