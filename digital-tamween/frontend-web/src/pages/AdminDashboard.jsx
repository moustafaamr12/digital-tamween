import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { io } from 'socket.io-client'

const TABS = ['stats', 'outlets', 'users']
const TAB_LABELS = { stats: 'الإحصائيات', outlets: 'المنافذ', users: 'المواطنون' }

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [outlets, setOutlets] = useState([])
  const [users, setUsers] = useState([])
  const [outletSearch, setOutletSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [outletSales, setOutletSales] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPurchases, setUserPurchases] = useState([])
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    loadStats()
    loadOutlets()
    loadUsers()

    const socket = io('http://localhost:3000')
    socket.emit('join-admin')
    socket.on('purchase-recorded', ({ totalAmount }) => {
      setNotifications(prev => [`💰 بيع جديد: ${totalAmount} جنيه`, ...prev.slice(0, 4)])
      loadStats()
    })
    socket.on('restock-added', () => {
      setNotifications(prev => ['📦 شحنة جديدة أُضيفت للمخزون', ...prev.slice(0, 4)])
    })

    return () => socket.disconnect()
  }, [])

  async function loadStats() {
    try {
      const { data } = await api.get('/admin/stats')
      setStats(data)
    } catch {}
  }

  async function loadOutlets(search = '') {
    try {
      const { data } = await api.get('/admin/outlets', { params: search ? { search } : {} })
      setOutlets(data)
    } catch {}
  }

  async function loadUsers(search = '') {
    try {
      const { data } = await api.get('/admin/users', { params: search ? { search } : {} })
      setUsers(data.data || [])
    } catch {}
  }

  async function openOutlet(outlet) {
    setSelectedOutlet(outlet)
    try {
      const { data } = await api.get(`/admin/outlets/${outlet.id}/sales`)
      setOutletSales(data.data || [])
    } catch { setOutletSales([]) }
  }

  async function openUser(u) {
    setSelectedUser(u)
    try {
      const { data } = await api.get(`/admin/users/${u.id}/purchases`)
      setUserPurchases(data.data || [])
    } catch { setUserPurchases([]) }
  }

  function handleLogout() { logout(); navigate('/login') }

  const statCards = stats ? [
    { label: 'إجمالي المنافذ',  value: stats.totalOutlets,   sub: `${stats.activeOutlets} نشط`,    color: 'bg-blue-500' },
    { label: 'المستفيدون',       value: stats.totalUsers,      sub: 'مواطن مسجل',                    color: 'bg-green-500' },
    { label: 'عمليات البيع',    value: stats.totalPurchases,  sub: 'إجمالي',                         color: 'bg-purple-500' },
    { label: 'الإيرادات',        value: `${Number(stats.totalRevenue).toFixed(0)} جنيه`, sub: 'إجمالي', color: 'bg-amber-500' },
  ] : []

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-green-800 text-white px-4 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-lg">لوحة مراقبة وزارة التموين</h1>
          <p className="text-green-200 text-sm">مرحباً، {user?.name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg">خروج</button>
      </header>

      {notifications.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 space-y-1">
          {notifications.map((n, i) => <p key={i} className="text-sm text-amber-800">{n}</p>)}
        </div>
      )}

      <nav className="bg-white border-b flex overflow-x-auto shadow-sm">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500 hover:text-green-700'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto p-4 space-y-4">

        {/* STATS */}
        {tab === 'stats' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {statCards.map(c => (
                <div key={c.label} className={`${c.color} text-white rounded-2xl shadow p-5`}>
                  <p className="text-3xl font-bold">{c.value}</p>
                  <p className="font-medium mt-1">{c.label}</p>
                  <p className="text-sm opacity-80">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-bold text-gray-700 mb-3">⚠️ تنبيهات المخزون المنخفض</h2>
              {outlets.filter(o => o.products?.some(p => p.lowStock)).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">لا توجد تنبيهات حالياً ✅</p>
              ) : outlets.filter(o => o.products?.some(p => p.lowStock)).map(o => (
                <div key={o.id} className="border rounded-xl p-3 mb-2">
                  <p className="font-medium text-sm">{o.name}</p>
                  {o.products?.filter(p => p.lowStock).map((p, i) => (
                    <p key={i} className="text-xs text-red-600">⚠️ {p.name}: {p.quantity} {p.unit} متبقي</p>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* OUTLETS */}
        {tab === 'outlets' && (
          selectedOutlet ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedOutlet(null)} className="text-green-700 underline text-sm">
                ← العودة للقائمة
              </button>
              <div className="bg-white rounded-2xl shadow p-5">
                <h2 className="text-xl font-bold text-gray-800 mb-1">{selectedOutlet.name}</h2>
                <p className="text-gray-500 text-sm">{selectedOutlet.address}</p>
                <p className="text-sm mt-2">رقم الترخيص: <span className="font-medium">{selectedOutlet.licenseNo}</span></p>
                <p className="text-sm">المالك: <span className="font-medium">{selectedOutlet.owner?.name}</span> ({selectedOutlet.owner?.email})</p>
                <div className="mt-3 flex gap-4 text-sm text-gray-600">
                  <span>{selectedOutlet.totalPurchases} عملية بيع</span>
                  <span>{selectedOutlet.totalRestocks} شحنة</span>
                  <span className={selectedOutlet.isActive ? 'text-green-600' : 'text-red-500'}>
                    {selectedOutlet.isActive ? '● نشط' : '● متوقف'}
                  </span>
                </div>
              </div>

              <h3 className="font-bold text-gray-700">المخزون</h3>
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['المنتج', 'الكمية', 'الوحدة', 'الحالة'].map(h => (
                        <th key={h} className="px-4 py-3 text-right font-medium text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOutlet.products?.map(p => (
                      <tr key={p.name} className={`border-t ${p.lowStock ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2 font-medium">{p.name}</td>
                        <td className="px-4 py-2">{p.quantity}</td>
                        <td className="px-4 py-2 text-gray-500">{p.unit}</td>
                        <td className="px-4 py-2">
                          {p.lowStock
                            ? <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">منخفض</span>
                            : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">جيد</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="font-bold text-gray-700">آخر المبيعات</h3>
              {outletSales.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">لا توجد مبيعات</div>
              ) : outletSales.map(s => (
                <div key={s.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between">
                    <p className="font-medium text-sm">{s.user?.name} <span className="text-gray-400 text-xs">({s.user?.tamweenCardId})</span></p>
                    <p className="font-bold text-green-700">{s.totalAmount} جنيه</p>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <input value={outletSearch}
                onChange={e => { setOutletSearch(e.target.value); loadOutlets(e.target.value) }}
                placeholder="ابحث عن منفذ بالاسم أو العنوان..."
                className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              {outlets.map(o => (
                <div key={o.id} className="bg-white rounded-xl shadow p-4 cursor-pointer hover:border-green-400 border border-transparent transition"
                  onClick={() => openOutlet(o)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{o.name}</p>
                      <p className="text-sm text-gray-500">{o.address}</p>
                      <p className="text-xs text-gray-400">مالك: {o.owner?.name}</p>
                    </div>
                    <div className="text-left space-y-1">
                      <p className="text-xs text-gray-500">{o.totalPurchases} بيعة</p>
                      <p className={`text-xs font-medium ${o.isActive ? 'text-green-600' : 'text-red-500'}`}>
                        {o.isActive ? '● نشط' : '● متوقف'}
                      </p>
                    </div>
                  </div>
                  {o.products?.some(p => p.lowStock) && (
                    <p className="text-xs text-red-600 mt-2">⚠️ مخزون منخفض في بعض المنتجات</p>
                  )}
                </div>
              ))}
            </>
          )
        )}

        {/* USERS */}
        {tab === 'users' && (
          selectedUser ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedUser(null)} className="text-green-700 underline text-sm">
                ← العودة للقائمة
              </button>
              <div className="bg-white rounded-2xl shadow p-5">
                <h2 className="text-xl font-bold mb-1">{selectedUser.name}</h2>
                <p className="text-sm text-gray-500">بطاقة: {selectedUser.tamweenCardId}</p>
                <p className="text-sm text-gray-500">الرقم القومي: {selectedUser.nationalId}</p>
                <p className="text-sm text-gray-500">الهاتف: {selectedUser.phone || '---'}</p>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-600">الحد الشهري: {selectedUser.monthlyCredit} جنيه</span>
                  <span className="text-green-700 font-bold">متبقي: {selectedUser.remainingCredit?.toFixed(2)} جنيه</span>
                </div>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (selectedUser.usedCredit / selectedUser.monthlyCredit) * 100)}%` }} />
                </div>
              </div>

              <h3 className="font-bold text-gray-700">سجل المشتريات</h3>
              {userPurchases.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">لا توجد مشتريات</div>
              ) : userPurchases.map(p => (
                <div key={p.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{p.outlet?.name}</p>
                    <p className="font-bold text-green-700">{p.totalAmount} جنيه</p>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('ar-EG')}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.type === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.type === 'DELIVERY' ? 'توصيل' : 'حضوري'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <input value={userSearch}
                onChange={e => { setUserSearch(e.target.value); loadUsers(e.target.value) }}
                placeholder="ابحث عن مواطن بالاسم أو البطاقة..."
                className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              {users.map(u => (
                <div key={u.id} className="bg-white rounded-xl shadow p-4 cursor-pointer hover:border-green-400 border border-transparent transition"
                  onClick={() => openUser(u)}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold">{u.name}</p>
                      <p className="text-sm text-gray-500">بطاقة: {u.tamweenCardId}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-500">متبقي</p>
                      <p className="font-bold text-green-700">{u.remainingCredit?.toFixed(2)} جنيه</p>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${
                      (u.usedCredit / u.monthlyCredit) > 0.8 ? 'bg-red-500' : 'bg-green-500'
                    }`} style={{ width: `${Math.min(100, (u.usedCredit / u.monthlyCredit) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </>
          )
        )}

      </main>
    </div>
  )
}
