import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const ROLES = [
  { id: 'USER',         label: 'مواطن',          icon: '👤', hint: 'الرقم القومي' },
  { id: 'OUTLET_OWNER', label: 'منفذ تموين',      icon: '🏪', hint: 'البريد الإلكتروني' },
]

export default function Login() {
  const [role, setRole] = useState('USER')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const selected = ROLES.find(r => r.id === role)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { role, identifier, password })
      login(data.user, data.token)
      const routes = { USER: '/user', OUTLET_OWNER: '/outlet', ADMIN: '/admin' }
      navigate(routes[data.user.role])
    } catch (err) {
      setError(err.response?.data?.error || 'بيانات الدخول غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-700 to-green-500 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-green-800 text-white text-center py-8 px-6">
          <div className="text-6xl mb-3">🏛️</div>
          <h1 className="text-2xl font-bold">منظومة التموين الرقمية</h1>
          <p className="text-green-200 text-sm mt-1">وزارة التموين والتجارة الداخلية</p>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {ROLES.map(r => (
              <button key={r.id}
                onClick={() => { setRole(r.id); setIdentifier(''); setError('') }}
                className={`p-3 rounded-xl border-2 text-center transition-all text-sm ${
                  role === r.id
                    ? 'border-green-600 bg-green-50 text-green-800 font-bold'
                    : 'border-gray-200 text-gray-500 hover:border-green-300'
                }`}
              >
                <div className="text-2xl mb-1">{r.icon}</div>
                <div>{r.label}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{selected.hint}</label>
              <input
                type={role === 'USER' ? 'text' : 'email'}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder={role === 'USER' ? '29901011234567' : 'example@tamween.gov.eg'}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-lg">
              {loading ? '...جاري الدخول' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
