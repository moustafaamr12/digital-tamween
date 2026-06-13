import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import tamween from '../api/tamween'
import foodsecurity from '../api/foodsecurity'

// ─── Priority Tier Config ─────────────────────────────────────────────────────
const TIER_LABEL = { CRITICAL: 'حرج', HIGH: 'عالي', MEDIUM: 'متوسط', LOW: 'منخفض' }
const TIER_COLOR = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH:     'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW:      'bg-green-100 text-green-800 border-green-300',
}
const TIER_BAR = { CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-yellow-400', LOW: 'bg-green-500' }
const TIER_RANK_BG = { CRITICAL: 'bg-red-600', HIGH: 'bg-orange-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-600' }

// ─── Static Region Data (generated from 28 outlets across Egypt) ─────────────
const STATIC_REGIONS = [
  { id: 'nv1', name: 'الوادي الجديد (الخارجة، الداخلة، الفرافرة)', governorate: 'الوادي الجديد', population: 225000, outletCount: 3, avgIncome: 1800, povertyRate: 42, score: { totalScore: 87.3, outletScore: 28.5, incomeScore: 23.1, cropScore: 19.8, storeScore: 10.2, distanceScore: 5.7, priorityTier: 'CRITICAL' } },
  { id: 'as2', name: 'أبو سمبل، توشكى، ووادي حلفا الجديدة', governorate: 'أسوان', population: 180000, outletCount: 3, avgIncome: 1650, povertyRate: 45, score: { totalScore: 84.1, outletScore: 27.8, incomeScore: 22.4, cropScore: 18.9, storeScore: 9.8, distanceScore: 5.2, priorityTier: 'CRITICAL' } },
  { id: 'mt2', name: 'سيوة، السلوم، وسيدي براني', governorate: 'مطروح', population: 195000, outletCount: 3, avgIncome: 1920, povertyRate: 38, score: { totalScore: 79.6, outletScore: 26.3, incomeScore: 21.0, cropScore: 18.2, storeScore: 9.1, distanceScore: 5.0, priorityTier: 'CRITICAL' } },
  { id: 'si2', name: 'نخل وبئر العبد (وسط سيناء)', governorate: 'شمال سيناء', population: 145000, outletCount: 2, avgIncome: 2100, povertyRate: 33, score: { totalScore: 72.4, outletScore: 24.5, incomeScore: 19.8, cropScore: 16.7, storeScore: 8.4, distanceScore: 3.0, priorityTier: 'HIGH' } },
  { id: 'ss1', name: 'سانت كاترين، نويبع، وطابا', governorate: 'جنوب سيناء', population: 98000, outletCount: 3, avgIncome: 2350, povertyRate: 28, score: { totalScore: 68.9, outletScore: 22.1, incomeScore: 18.4, cropScore: 15.8, storeScore: 8.1, distanceScore: 4.5, priorityTier: 'HIGH' } },
  { id: 're1', name: 'مرسى علم، القصير، وشلاتين', governorate: 'البحر الأحمر', population: 175000, outletCount: 3, avgIncome: 2500, povertyRate: 25, score: { totalScore: 65.2, outletScore: 20.8, incomeScore: 17.6, cropScore: 15.1, storeScore: 7.7, distanceScore: 4.0, priorityTier: 'HIGH' } },
  { id: 'si1', name: 'العريش ورفح', governorate: 'شمال سيناء', population: 285000, outletCount: 2, avgIncome: 2650, povertyRate: 30, score: { totalScore: 61.7, outletScore: 18.9, incomeScore: 16.9, cropScore: 14.5, storeScore: 8.0, distanceScore: 3.4, priorityTier: 'HIGH' } },
  { id: 'mt1', name: 'مرسى مطروح', governorate: 'مطروح', population: 165000, outletCount: 1, avgIncome: 2800, povertyRate: 22, score: { totalScore: 57.3, outletScore: 17.4, incomeScore: 15.8, cropScore: 13.8, storeScore: 7.1, distanceScore: 3.2, priorityTier: 'HIGH' } },
  { id: 'asy', name: 'أسيوط', governorate: 'أسيوط', population: 420000, outletCount: 1, avgIncome: 2950, povertyRate: 28, score: { totalScore: 51.8, outletScore: 15.8, incomeScore: 14.2, cropScore: 12.9, storeScore: 6.8, distanceScore: 2.1, priorityTier: 'MEDIUM' } },
  { id: 'mns', name: 'المنصورة والدقهلية', governorate: 'الدقهلية', population: 680000, outletCount: 1, avgIncome: 3200, povertyRate: 20, score: { totalScore: 44.3, outletScore: 13.2, incomeScore: 12.7, cropScore: 11.4, storeScore: 5.2, distanceScore: 1.8, priorityTier: 'MEDIUM' } },
  { id: 'alx', name: 'الإسكندرية', governorate: 'الإسكندرية', population: 1850000, outletCount: 1, avgIncome: 4100, povertyRate: 12, score: { totalScore: 31.5, outletScore: 9.0, incomeScore: 8.9, cropScore: 7.8, storeScore: 4.1, distanceScore: 1.7, priorityTier: 'LOW' } },
  { id: 'giz', name: 'الجيزة', governorate: 'الجيزة', population: 2850000, outletCount: 1, avgIncome: 4500, povertyRate: 10, score: { totalScore: 24.8, outletScore: 7.2, incomeScore: 6.9, cropScore: 5.8, storeScore: 3.4, distanceScore: 1.5, priorityTier: 'LOW' } },
  { id: 'cai', name: 'القاهرة', governorate: 'القاهرة', population: 6500000, outletCount: 4, avgIncome: 5200, povertyRate: 8, score: { totalScore: 18.4, outletScore: 5.1, incomeScore: 5.3, cropScore: 4.2, storeScore: 2.5, distanceScore: 1.3, priorityTier: 'LOW' } },
]

// ─── Score Metric Rows ────────────────────────────────────────────────────────
const METRICS = [
  { key: 'outletScore',   label: 'منافذ التموين',    weight: '30%' },
  { key: 'incomeScore',   label: 'مستوى الدخل',      weight: '25%' },
  { key: 'cropScore',     label: 'المحاصيل الزراعية', weight: '23%' },
  { key: 'storeScore',    label: 'عدد المتاجر',      weight: '16%' },
  { key: 'distanceScore', label: 'البُعد الجغرافي',  weight: '6%'  },
]

export default function GovDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Main module: 'tamween' | 'regions' | 'restock'
  const [module, setModule] = useState(null)

  // ── Restock State ───────────────────────────────────────────────────────────
  const [restockOutletId, setRestockOutletId] = useState('')
  const [restockQtys, setRestockQtys] = useState({})
  const [restockNote, setRestockNote] = useState('')
  const [restockLoading, setRestockLoading] = useState(false)
  const [restockMsg, setRestockMsg] = useState('')
  const [pendingRestock, setPendingRestock] = useState(null) // { id, outletName, items }
  const [confirmOtp, setConfirmOtp] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')
  const [restockProducts, setRestockProducts] = useState([])

  // ── Tamween Data State ──────────────────────────────────────────────────────
  const [tamweenTab, setTamweenTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [outlets, setOutlets] = useState([])
  const [users, setUsers] = useState([])
  const [outletSearch, setOutletSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [outletSales, setOutletSales] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPurchases, setUserPurchases] = useState([])

  // ── Regions State ───────────────────────────────────────────────────────────
  const [regions, setRegions] = useState([])
  const [fsStats, setFsStats] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [filterTier, setFilterTier] = useState('ALL')
  const [regionsLoading, setRegionsLoading] = useState(false)

  function handleLogout() { logout(); navigate('/login') }

  // ── Load Tamween Data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (module === 'tamween') { loadStats(); loadOutlets(); loadUsers() }
    if (module === 'regions') { loadRegions(); loadFsStats() }
  }, [module])

  useEffect(() => {
    if (!restockOutletId) { setRestockProducts([]); setRestockQtys({}); return }
    tamween.get(`/admin/outlets/${restockOutletId}`).then(({ data }) => {
      setRestockProducts(data.products || [])
      setRestockQtys({})
    }).catch(() => {})
  }, [restockOutletId])

  async function loadStats() {
    try { const { data } = await tamween.get('/admin/stats'); setStats(data) } catch {}
  }
  async function loadOutlets(search = '') {
    try { const { data } = await tamween.get('/admin/outlets', { params: search ? { search } : {} }); setOutlets(data) } catch {}
  }
  async function loadUsers(search = '') {
    try { const { data } = await tamween.get('/admin/users', { params: search ? { search } : {} }); setUsers(data.data || []) } catch {}
  }
  async function openOutlet(o) {
    setSelectedOutlet(o)
    try { const { data } = await tamween.get(`/admin/outlets/${o.id}/sales`); setOutletSales(data.data || []) } catch { setOutletSales([]) }
  }
  async function openUser(u) {
    setSelectedUser(u)
    try { const { data } = await tamween.get(`/admin/users/${u.id}/purchases`); setUserPurchases(data.data || []) } catch { setUserPurchases([]) }
  }

  // ── Load Regions ────────────────────────────────────────────────────────────
  async function loadRegions() {
    setRegionsLoading(true)
    try {
      const { data } = await foodsecurity.get('/gov/regions')
      setRegions(data)
    } catch {
      setRegions(STATIC_REGIONS)
    } finally {
      setRegionsLoading(false)
    }
  }
  async function loadFsStats() {
    try {
      const { data } = await foodsecurity.get('/gov/stats')
      setFsStats(data)
    } catch {
      setFsStats({
        totalRegions:  STATIC_REGIONS.length,
        criticalCount: STATIC_REGIONS.filter(r => r.score.priorityTier === 'CRITICAL').length,
        highCount:     STATIC_REGIONS.filter(r => r.score.priorityTier === 'HIGH').length,
        alertsCount:   STATIC_REGIONS.filter(r => ['CRITICAL','HIGH'].includes(r.score.priorityTier)).length,
      })
    }
  }

  const filteredRegions = filterTier === 'ALL' ? regions : regions.filter(r => r.score?.priorityTier === filterTier)

  // ── Restock Actions ─────────────────────────────────────────────────────────
  async function initiateRestock() {
    const items = restockProducts
      .filter(p => Number(restockQtys[p.productId]) > 0)
      .map(p => ({ productId: p.productId, quantity: Number(restockQtys[p.productId]) }))
    if (!restockOutletId || !items.length) { setRestockMsg('اختر منفذاً وأدخل كمية صحيحة لصنف واحد على الأقل'); return }
    setRestockLoading(true); setRestockMsg('')
    try {
      const { data } = await tamween.post('/admin/restocks/initiate', { outletId: restockOutletId, items, note: restockNote })
      setPendingRestock(data)
    } catch (e) {
      setRestockMsg(e.response?.data?.error || 'حدث خطأ')
    } finally { setRestockLoading(false) }
  }

  async function doConfirmRestock() {
    if (!confirmOtp.trim()) { setConfirmMsg('أدخل رمز OTP'); return }
    setConfirmLoading(true); setConfirmMsg('')
    try {
      await tamween.post(`/admin/restocks/${pendingRestock.id}/confirm`, { otp: confirmOtp.trim() })
      setConfirmMsg('✅ تمت عملية الشحن بنجاح')
      setPendingRestock(null); setRestockOutletId(''); setRestockQtys({}); setRestockNote(''); setConfirmOtp('')
    } catch (e) {
      setConfirmMsg(e.response?.data?.error || 'رمز OTP غير صحيح')
    } finally { setConfirmLoading(false) }
  }

  // ── Stat Cards for tamween ──────────────────────────────────────────────────
  const statCards = stats ? [
    { label: 'إجمالي المنافذ',  value: stats.totalOutlets,   sub: `${stats.activeOutlets} نشط`,    color: 'bg-navy-700' },
    { label: 'المستفيدون',       value: stats.totalUsers,      sub: 'مواطن مسجل',                    color: 'bg-navy-600' },
    { label: 'عمليات البيع',    value: stats.totalPurchases,  sub: 'إجمالي',                         color: 'bg-gold-500' },
    { label: 'الإيرادات',        value: `${Number(stats.totalRevenue || 0).toFixed(0)} جنيه`, sub: 'إجمالي', color: 'bg-gold-600' },
  ] : []

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-navy-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {module && (
            <button onClick={() => { setModule(null); setSelectedOutlet(null); setSelectedUser(null); setSelectedRegion(null) }}
              className="text-gold-400 hover:text-gold-300 text-sm ml-2">
              ← الرئيسية
            </button>
          )}
          <div className="w-0.5 h-8 bg-gold-500 rounded-full" />
          <div>
            <h1 className="font-bold text-base leading-tight">بوابة الأمن الغذائي الحكومية</h1>
            <p className="text-gold-400 text-xs">مرحباً، {user?.name}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="text-xs border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-navy-900 px-4 py-2 rounded-lg transition font-medium">
          خروج
        </button>
      </header>

      {/* ════════════════════════════════════════════════════════════════════════
          MODULE SELECTOR (Landing)
      ════════════════════════════════════════════════════════════════════════ */}
      {!module && (
        <div className="max-w-4xl mx-auto p-6 mt-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-navy-800">اختر النظام</h2>
            <p className="text-gray-500 text-sm mt-1">منصة متكاملة لإدارة منظومة التموين ودعم المناطق المحتاجة</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Module 1 */}
            <button onClick={() => setModule('tamween')}
              className="bg-white border-2 border-navy-100 hover:border-navy-600 rounded-2xl p-8 text-right shadow-sm hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-navy-800 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                🏪
              </div>
              <h3 className="text-xl font-bold text-navy-800 mb-2">منظومة التموين الرقمي</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                متابعة المنافذ، إحصاءات المبيعات، بيانات المواطنين، شحن المخازن، وتنبيهات المخزون
              </p>
              <div className="mt-4 flex items-center text-navy-600 text-sm font-medium">
                <span>الدخول للنظام</span>
                <span className="mr-2">←</span>
              </div>
            </button>

            {/* Module 2 */}
            <button onClick={() => setModule('regions')}
              className="bg-white border-2 border-navy-100 hover:border-gold-500 rounded-2xl p-8 text-right shadow-sm hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-gold-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-xl font-bold text-navy-800 mb-2">ترتيب المناطق الأكثر احتياجاً</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                نتائج نموذج الذكاء الاصطناعي لتحديد أولويات إرسال القوافل الغذائية
              </p>
              <div className="mt-4 flex items-center text-gold-600 text-sm font-medium">
                <span>عرض الترتيب</span>
                <span className="mr-2">←</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODULE 1: TAMWEEN DATA
      ════════════════════════════════════════════════════════════════════════ */}
      {module === 'tamween' && (
        <>
          <nav className="bg-white border-b flex overflow-x-auto shadow-sm">
            {['stats','outlets','users','restock'].map(t => (
              <button key={t} onClick={() => { setTamweenTab(t); setSelectedOutlet(null); setSelectedUser(null) }}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tamweenTab === t ? 'border-navy-700 text-navy-700' : 'border-transparent text-gray-500 hover:text-navy-700'
                }`}>
                {{ stats: 'الإحصائيات', outlets: 'المنافذ', users: 'المواطنون', restock: '📦 شحن المنافذ' }[t]}
              </button>
            ))}
          </nav>

          <main className="max-w-5xl mx-auto p-4 space-y-4">

            {/* STATS */}
            {tamweenTab === 'stats' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {statCards.map(c => (
                    <div key={c.label} className={`${c.color} text-white rounded-2xl shadow p-5`}>
                      <p className="text-3xl font-bold">{c.value}</p>
                      <p className="font-medium mt-1">{c.label}</p>
                      <p className="text-sm opacity-75">{c.sub}</p>
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
            {tamweenTab === 'outlets' && (
              selectedOutlet ? (
                <div className="space-y-4">
                  <button onClick={() => setSelectedOutlet(null)} className="text-navy-700 underline text-sm">← العودة</button>
                  <div className="bg-white rounded-2xl shadow p-5">
                    <h2 className="text-xl font-bold text-gray-800 mb-1">{selectedOutlet.name}</h2>
                    <p className="text-gray-500 text-sm">{selectedOutlet.address}</p>
                    <p className="text-sm mt-2">رقم الترخيص: <span className="font-medium">{selectedOutlet.licenseNo}</span></p>
                    <p className="text-sm">المالك: <span className="font-medium">{selectedOutlet.owner?.name}</span></p>
                    <div className="mt-3 flex gap-4 text-sm text-gray-600">
                      <span>{selectedOutlet.totalPurchases} عملية بيع</span>
                      <span className={selectedOutlet.isActive ? 'text-green-600' : 'text-red-500'}>
                        {selectedOutlet.isActive ? '● نشط' : '● متوقف'}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-700">المخزون</h3>
                  <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>{['المنتج','الكمية','الوحدة','الحالة'].map(h => <th key={h} className="px-4 py-3 text-right font-medium text-gray-600">{h}</th>)}</tr>
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
                                : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">جيد</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3 className="font-bold text-gray-700">آخر المبيعات</h3>
                  {outletSales.map(s => (
                    <div key={s.id} className="bg-white rounded-xl shadow p-4 flex justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.user?.name}</p>
                        <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <p className="font-bold text-navy-700">{s.totalAmount} جنيه</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <input value={outletSearch} onChange={e => { setOutletSearch(e.target.value); loadOutlets(e.target.value) }}
                    placeholder="ابحث عن منفذ..."
                    className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-navy-600 bg-white" />
                  {outlets.map(o => (
                    <div key={o.id} onClick={() => openOutlet(o)}
                      className="bg-white rounded-xl shadow p-4 cursor-pointer hover:border-navy-400 border border-transparent transition">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-bold">{o.name}</p>
                          <p className="text-sm text-gray-500">{o.address}</p>
                        </div>
                        <p className={`text-xs font-medium ${o.isActive ? 'text-green-600' : 'text-red-500'}`}>
                          {o.isActive ? '● نشط' : '● متوقف'}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )
            )}

            {/* USERS */}
            {tamweenTab === 'users' && (
              selectedUser ? (
                <div className="space-y-4">
                  <button onClick={() => setSelectedUser(null)} className="text-navy-700 underline text-sm">← العودة</button>

                  {/* ── Info Card ── */}
                  <div className="bg-white rounded-2xl shadow p-5 space-y-4">
                    <h2 className="text-xl font-bold">{selectedUser.name}</h2>

                    {/* Personal details grid */}
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">الرقم القومي</span>
                        <span className="font-medium text-navy-800 tracking-wide">{selectedUser.nationalId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">رقم الهاتف</span>
                        <span className="font-medium">{selectedUser.phone || '—'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 w-28 shrink-0">العنوان</span>
                        <span className="font-medium leading-relaxed">{selectedUser.address || '—'}</span>
                      </div>
                      {selectedUser.email && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 w-28 shrink-0">البريد الإلكتروني</span>
                          <span className="font-medium text-navy-700">{selectedUser.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Need/poverty score */}
                    {(() => {
                      const s = selectedUser.needScore ?? 50
                      const tier = s >= 80 ? { label: 'فقر مدقع', bar: 'bg-red-500', badge: 'bg-red-100 text-red-800' }
                                 : s >= 60 ? { label: 'احتياج مرتفع', bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-800' }
                                 : s >= 40 ? { label: 'احتياج متوسط', bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800' }
                                 :           { label: 'مستوى مقبول', bar: 'bg-green-500', badge: 'bg-green-100 text-green-800' }
                      return (
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-gray-500">مؤشر الاحتياج الاجتماعي</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.badge}`}>{tier.label} — {s.toFixed(1)}%</span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2.5">
                            <div className={`${tier.bar} h-2.5 rounded-full transition-all`} style={{ width: `${s}%` }} />
                          </div>
                        </div>
                      )
                    })()}

                    {/* Credit bar */}
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">الحد الشهري: {selectedUser.monthlyCredit} جنيه</span>
                        <span className="text-navy-700 font-bold">متبقي: {selectedUser.remainingCredit?.toFixed(2)} جنيه</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div className="bg-navy-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (selectedUser.usedCredit / selectedUser.monthlyCredit) * 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* ── Purchase History ── */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-700">سجل المشتريات</h3>
                    <span className="text-xs bg-navy-100 text-navy-800 px-2 py-1 rounded-full font-medium">
                      {userPurchases.length} عملية
                    </span>
                  </div>

                  {userPurchases.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">لا توجد مشتريات مسجّلة</div>
                  ) : userPurchases.map(p => (
                    <div key={p.id} className="bg-white rounded-xl shadow p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm text-navy-800">{p.outlet?.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(p.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-navy-700">{p.totalAmount} جنيه</p>
                          <div className="flex gap-1 justify-end mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.type === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                              {p.type === 'DELIVERY' ? 'توصيل' : 'حضوري'}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {p.paymentMethod === 'BALANCE' ? 'رصيد' : p.paymentMethod === 'CASH' ? 'نقدي' : 'بطاقة'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {p.items?.length > 0 && (
                        <div className="border-t pt-2 flex flex-wrap gap-2">
                          {p.items.map(item => (
                            <span key={item.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                              {item.product?.name} × {item.quantity} {item.product?.unit} — {(item.quantity * item.unitPrice).toFixed(2)} جنيه
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <input value={userSearch} onChange={e => { setUserSearch(e.target.value); loadUsers(e.target.value) }}
                    placeholder="ابحث عن مواطن..."
                    className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-navy-600 bg-white" />
                  {users.map(u => {
                    const s = u.needScore ?? 50
                    const dotColor = s >= 80 ? 'bg-red-500' : s >= 60 ? 'bg-orange-400' : s >= 40 ? 'bg-yellow-400' : 'bg-green-500'
                    return (
                      <div key={u.id} onClick={() => openUser(u)}
                        className="bg-white rounded-xl shadow p-4 cursor-pointer hover:border-navy-400 border border-transparent transition">
                        <div className="flex justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold">{u.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5 tracking-wide">{u.nationalId}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{u.address || '—'}</p>
                          </div>
                          <div className="text-left flex flex-col items-end gap-1 mr-2 shrink-0">
                            <p className="font-bold text-navy-700">{u.remainingCredit?.toFixed(2)} جنيه</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                              <span>{u.purchaseCount ?? 0} عملية</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${(u.usedCredit / u.monthlyCredit) > 0.8 ? 'bg-red-500' : 'bg-navy-600'}`}
                            style={{ width: `${Math.min(100, (u.usedCredit / u.monthlyCredit) * 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            )}
            {/* RESTOCK */}
            {tamweenTab === 'restock' && (
              <div className="space-y-4">
                {!pendingRestock && (
                  <div className="bg-white rounded-2xl shadow p-6 space-y-5">

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">اختر المنفذ</label>
                      <select value={restockOutletId} onChange={e => setRestockOutletId(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
                        <option value="">-- اختر المنفذ --</option>
                        {outlets.map(o => (
                          <option key={o.id} value={o.id}>{o.name} — {o.address}</option>
                        ))}
                      </select>
                    </div>

                    {restockProducts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">الأصناف والكميات المضافة</p>
                        {restockProducts.map(p => (
                          <div key={p.productId} className="flex items-center gap-3 border rounded-xl px-4 py-3 hover:bg-gray-50 transition">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800">{p.product.name}</p>
                              <p className="text-xs text-gray-400">{p.product.unit} · مخزون حالي: {p.quantity}</p>
                            </div>
                            <input type="number" min="0"
                              value={restockQtys[p.productId] || ''}
                              onChange={e => setRestockQtys(q => ({ ...q, [p.productId]: e.target.value }))}
                              placeholder="0"
                              className="w-24 border rounded-lg px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-green-600 text-sm font-medium" />
                          </div>
                        ))}
                      </div>
                    )}

                    {restockOutletId && restockProducts.length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-4">لا توجد منتجات مسجّلة في هذا المنفذ</p>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظة (اختياري)</label>
                      <input value={restockNote} onChange={e => setRestockNote(e.target.value)}
                        placeholder="مثال: شحنة رمضانية، شحنة طارئة..."
                        className="w-full border rounded-xl px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-green-600" />
                    </div>

                    {restockMsg && <p className="text-red-600 text-sm text-center font-medium">{restockMsg}</p>}

                    <button onClick={initiateRestock} disabled={restockLoading}
                      className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 text-base">
                      {restockLoading ? 'جاري الإرسال...' : '📨 إرسال رمز التأكيد للمنفذ'}
                    </button>
                  </div>
                )}

                {pendingRestock && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                      <p className="font-bold text-green-800 text-base mb-3">✅ تم إرسال إشعار الشحنة للمنفذ</p>
                      <p className="text-sm text-gray-700 mb-1">المنفذ: <span className="font-bold">{pendingRestock.outletName}</span></p>
                      <div className="bg-white rounded-xl p-4 border border-green-100 mt-3 space-y-1">
                        <p className="text-sm font-medium text-gray-600 mb-2">تفاصيل الشحنة:</p>
                        {pendingRestock.items?.map((item, i) => (
                          <p key={i} className="text-sm text-gray-700">• {item.name}: <span className="font-bold">{item.quantity}</span> {item.unit}</p>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                        تم إرسال رمز OTP لخانة الرسائل عند المنفذ. اطلب من المسئول تزويدك بالرمز لإتمام عملية الشحن.
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow p-6 space-y-4">
                      <p className="font-bold text-gray-800 text-base">أدخل رمز OTP لإتمام الشحن</p>
                      <input value={confirmOtp} onChange={e => setConfirmOtp(e.target.value)}
                        placeholder="× × × × × ×"
                        maxLength={6}
                        className="w-full border-2 rounded-xl px-4 py-4 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />

                      {confirmMsg && (
                        <p className={`text-sm text-center font-medium ${confirmMsg.includes('✅') ? 'text-green-700' : 'text-red-600'}`}>
                          {confirmMsg}
                        </p>
                      )}

                      <div className="flex gap-3">
                        <button onClick={() => { setPendingRestock(null); setConfirmOtp(''); setConfirmMsg('') }}
                          className="flex-1 border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition">
                          إلغاء
                        </button>
                        <button onClick={doConfirmRestock} disabled={confirmLoading}
                          className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
                          {confirmLoading ? 'جاري التأكيد...' : '✅ تأكيد الشحن'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </main>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODULE 2: REGIONS RANKING
      ════════════════════════════════════════════════════════════════════════ */}
      {module === 'regions' && (
        <main className="max-w-5xl mx-auto p-4 space-y-4">

          {/* FS Stats Bar */}
          {fsStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي المناطق',     value: fsStats.totalRegions,  color: 'bg-navy-800' },
                { label: 'مناطق حرجة',         value: fsStats.criticalCount,  color: 'bg-red-600'  },
                { label: 'مناطق عالية الأولوية', value: fsStats.highCount,    color: 'bg-orange-500' },
                { label: 'تنبيهات قائمة',       value: fsStats.alertsCount,   color: 'bg-gold-500' },
              ].map(c => (
                <div key={c.label} className={`${c.color} text-white rounded-xl p-4 shadow`}>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs mt-1 opacity-80">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold text-navy-800">ترتيب المناطق الأكثر احتياجاً</h2>
                <p className="text-xs text-gray-400 mt-0.5">مرتبة من الأشد احتياجاً للأقل — يُحدَّث يومياً بواسطة نموذج الذكاء الاصطناعي</p>
              </div>
              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(tier => (
                  <button key={tier} onClick={() => setFilterTier(tier)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      filterTier === tier
                        ? 'bg-navy-800 text-white border-navy-800'
                        : 'text-gray-600 border-gray-300 hover:border-navy-400'
                    }`}>
                    {tier === 'ALL' ? 'الكل' : TIER_LABEL[tier]}
                  </button>
                ))}
              </div>
            </div>

            {regionsLoading ? (
              <p className="text-center text-gray-400 py-12">جاري تحميل البيانات...</p>
            ) : (
              <div className="space-y-3">
                {filteredRegions.map((region, idx) => {
                  const score = region.score
                  const tier  = score?.priorityTier ?? 'LOW'
                  const globalRank = regions.findIndex(r => r.id === region.id) + 1
                  return (
                    <div key={region.id}
                      className={`border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                        selectedRegion?.id === region.id ? 'border-navy-400 shadow-md' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedRegion(selectedRegion?.id === region.id ? null : region)}>

                      {/* Region Row */}
                      <div className="p-4 flex items-center gap-4">
                        {/* Rank Badge */}
                        <div className={`${TIER_RANK_BG[tier]} text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0`}>
                          {globalRank}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-navy-800">{region.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLOR[tier]}`}>
                              {TIER_LABEL[tier]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {region.governorate} · {region.population?.toLocaleString('ar-EG')} نسمة · {region.outletCount} منفذ تموين
                          </p>
                        </div>

                        {/* Score */}
                        <div className="text-left shrink-0">
                          <p className="text-xl font-bold text-navy-800">{score?.totalScore?.toFixed(1)}</p>
                          <p className="text-xs text-gray-400">/ 100</p>
                        </div>
                      </div>

                      {/* Score Bar */}
                      <div className="px-4 pb-3">
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div className={`${TIER_BAR[tier]} h-1.5 rounded-full transition-all`}
                            style={{ width: `${score?.totalScore ?? 0}%` }} />
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedRegion?.id === region.id && score && (
                        <div className="border-t border-gray-100 bg-slate-50 p-4">
                          <p className="text-xs font-bold text-gray-600 mb-3">تفاصيل درجة الحرمان</p>
                          <div className="space-y-2">
                            {METRICS.map(m => (
                              <div key={m.key} className="flex items-center gap-3">
                                <p className="text-xs text-gray-600 w-36 shrink-0">{m.label} <span className="text-gray-400">({m.weight})</span></p>
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div className="bg-navy-600 h-2 rounded-full" style={{ width: `${score[m.key] ?? 0}%` }} />
                                </div>
                                <p className="text-xs font-bold text-navy-800 w-10 text-left">{(score[m.key] ?? 0).toFixed(1)}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                            <div className="bg-white rounded-lg p-2 border">
                              <p className="text-xs text-gray-400">متوسط الدخل</p>
                              <p className="font-bold text-sm text-navy-800">{region.avgIncome?.toLocaleString('ar-EG')} جنيه</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border">
                              <p className="text-xs text-gray-400">نسبة الفقر</p>
                              <p className="font-bold text-sm text-navy-800">{region.povertyRate}%</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border">
                              <p className="text-xs text-gray-400">منافذ التموين</p>
                              <p className="font-bold text-sm text-navy-800">{region.outletCount}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Weights Legend */}
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-xs font-bold text-gray-600 mb-3">معايير حساب درجة الحرمان</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {METRICS.map(m => (
                <div key={m.key} className="bg-navy-50 rounded-lg p-2 text-center border border-navy-100">
                  <p className="text-lg font-bold text-navy-800">{m.weight}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              درجة الحرمان = مجموع الأوزان المرجّحة لكل معيار (0–100) · تُحسب بدون معيار استنزاف الرصيد (غير عادل)
            </p>
          </div>
        </main>
      )}

    </div>
  )
}
