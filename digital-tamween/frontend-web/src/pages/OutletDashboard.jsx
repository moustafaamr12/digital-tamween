import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { io } from 'socket.io-client'
import { QRCodeSVG } from 'qrcode.react'

const TABS = ['inventory', 'pos', 'deliveries', 'sales', 'messages']
const TAB_LABELS = { inventory: 'المخزون', pos: 'نقطة البيع', deliveries: 'طلبات التوصيل', sales: 'المبيعات', messages: 'الرسائل' }

const STATUS_LABELS = { PENDING: 'تم الارسال', CONFIRMED: 'قيد التحضير', OUT_FOR_DELIVERY: 'في الطريق', DELIVERED: 'تم التسليم', CANCELLED: 'ملغي' }
const STATUS_COLORS = { PENDING: 'bg-yellow-100 text-yellow-700', CONFIRMED: 'bg-blue-100 text-blue-700', OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700', DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700' }

export default function OutletDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('inventory')
  const [profile, setProfile] = useState(null)
  const [inventory, setInventory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [sales, setSales] = useState([])
  const [restocks, setRestocks] = useState([])
  const [notifications, setNotifications] = useState([])

  // POS shared
  const [posMainMode, setPosMainMode] = useState(null) // null | 'tamween' | 'guest'
  const [posMethod, setPosMethod] = useState('otp')    // 'otp' | 'card'  (within tamween)
  const [posUser, setPosUser] = useState(null)
  const [posPaymentMode, setPosPaymentMode] = useState(null) // null | 'balance' | 'no-balance'
  const [posCart, setPosCart] = useState([])
  const [posMsg, setPosMsg] = useState('')
  const [posLoading, setPosLoading] = useState(false)

  // OTP confirmation (purchase summary OTP — OTP method only)
  const [posConfirmOtpSent, setPosConfirmOtpSent] = useState(false)
  const [posConfirmOtp, setPosConfirmOtp] = useState('')
  const [posConfirmLoading, setPosConfirmLoading] = useState(false)
  const [posConfirmError, setPosConfirmError] = useState('')

  // POS bank card (for no-balance payments)
  const [posCardInserted, setPosCardInserted] = useState(false)
  const [posCardPin, setPosCardPin] = useState('')
  const [posCardError, setPosCardError] = useState('')
  const [posCardPaid, setPosCardPaid] = useState(false)
  const [posCardLoading, setPosCardLoading] = useState(false)

  // OTP method
  const [nationalId, setNationalId] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpDisplay, setOtpDisplay] = useState('')

  // Card method
  const [cardInserted, setCardInserted] = useState(false)
  const [cardPin, setCardPin] = useState('')
  const [cardError, setCardError] = useState('')
  const [cardLoading, setCardLoading] = useState(false)

  const [restockNote, setRestockNote] = useState('')
  const [restockItems, setRestockItems] = useState([])
  const [restockMsg, setRestockMsg] = useState('')
  const [outletMessages, setOutletMessages] = useState([])

  // Delivery management
  const [deliveries, setDeliveries] = useState([])
  const [selectedDelivery, setSelectedDelivery] = useState(null)
  const [deliveryOtp, setDeliveryOtp] = useState('')
  const [deliveryOtpError, setDeliveryOtpError] = useState('')
  const [deliveryActionLoading, setDeliveryActionLoading] = useState(false)

  // Visa payment for extra amount
  const [visaCardInserted, setVisaCardInserted] = useState(false)
  const [visaPin, setVisaPin] = useState('')
  const [visaError, setVisaError] = useState('')
  const [visaPaid, setVisaPaid] = useState(false)
  const [visaLoading, setVisaLoading] = useState(false)

  useEffect(() => {
    loadAll()

    const socket = io('http://localhost:3000')
    if (user?.outletId) socket.emit('join-outlet', user.outletId)

    socket.on('low-stock', ({ product, remaining }) => {
      setNotifications(prev => [`⚠️ مخزون منخفض: ${product} (متبقي: ${remaining})`, ...prev.slice(0, 4)])
      loadInventory()
    })
    socket.on('new-order', ({ totalAmount }) => {
      setNotifications(prev => [`📦 طلب توصيل جديد: ${totalAmount} جنيه`, ...prev.slice(0, 4)])
      loadDeliveries()
    })
    socket.on('purchase-recorded', ({ userName, totalAmount }) => {
      setNotifications(prev => [`✅ بيع: ${userName} - ${totalAmount} جنيه`, ...prev.slice(0, 4)])
    })

    socket.on('qr-authenticated', (citizenData) => {
      setPosUser(citizenData)
      setNationalId(citizenData.nationalId)
      setNotifications(prev => [`📷 QR: ${citizenData.name} سجّل هويته`, ...prev.slice(0, 4)])
    })

    return () => socket.disconnect()
  }, [])

  async function loadInventory() {
    const { data } = await api.get('/outlet/inventory')
    setInventory(data.products || [])
    setAlerts(data.alerts || [])
    const items = (data.products || [])
    setRestockItems(items.map(p => ({ productId: p.productId, name: p.name, unit: p.unit, qty: 0 })))
    setPosCart(items.map(p => ({ productId: p.productId, name: p.name, unit: p.unit, price: p.pricePerUnit, qty: 0 })))
  }

  async function loadDeliveries() {
    try {
      const { data } = await api.get('/outlet/deliveries')
      setDeliveries(data)
    } catch {}
  }

  async function updateDeliveryStatus(id, status) {
    setDeliveryActionLoading(true)
    try {
      await api.patch(`/outlet/deliveries/${id}`, { status })
      await loadDeliveries()
      setSelectedDelivery(prev => prev ? { ...prev, status } : null)
    } catch {}
    setDeliveryActionLoading(false)
  }

  async function confirmDeliveryOtp(id) {
    setDeliveryOtpError('')
    setDeliveryActionLoading(true)
    try {
      await api.post(`/outlet/deliveries/${id}/confirm`, {
        otp: deliveryOtp,
        paymentMethod: visaPaid ? 'CARD' : 'CASH',
      })
      await loadDeliveries()
      setSelectedDelivery(null)
      setDeliveryOtp('')
      setVisaCardInserted(false); setVisaPin(''); setVisaError(''); setVisaPaid(false)
    } catch (err) {
      setDeliveryOtpError(err.response?.data?.error || 'رمز OTP غير صحيح')
    }
    setDeliveryActionLoading(false)
  }

  async function loadAll() {
    const [prof, sal, rst, msgs] = await Promise.allSettled([
      api.get('/outlet/profile'),
      api.get('/outlet/sales'),
      api.get('/outlet/restocks'),
      api.get('/outlet/messages'),
    ])
    if (prof.status === 'fulfilled') setProfile(prof.value.data)
    if (sal.status === 'fulfilled') setSales(sal.value.data.data || [])
    if (rst.status === 'fulfilled') setRestocks(rst.value.data.data || [])
    if (msgs.status === 'fulfilled') setOutletMessages(msgs.value.data || [])
    await loadInventory()
    await loadDeliveries()
  }

  async function markRead(id) {
    await api.patch(`/outlet/messages/${id}/read`)
    setOutletMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m))
  }

  function resetPos() {
    setPosMainMode(null); setPosMethod('otp'); setPosUser(null); setPosMsg('')
    setNationalId(''); setOtpSent(false); setOtpValue(''); setOtpError(''); setOtpDisplay('')
    setCardInserted(false); setCardPin(''); setCardError('')
    setPosCart(prev => prev.map(i => ({ ...i, qty: 0 })))
    setPosPaymentMode(null); setPosCardInserted(false); setPosCardPin(''); setPosCardError(''); setPosCardPaid(false)
    setPosConfirmOtpSent(false); setPosConfirmOtp(''); setPosConfirmError('')
  }

  function switchSubMethod(m) {
    setPosMethod(m); setPosUser(null); setNationalId(''); setOtpSent(false)
    setOtpValue(''); setOtpError(''); setCardInserted(false); setCardPin(''); setCardError('')
  }

  async function sendPurchaseConfirmOtp(items) {
    setPosConfirmLoading(true); setPosConfirmError('')
    try {
      const cartTotal = posCart.reduce((s, i) => s + i.price * i.qty, 0)
      const shortfall = posPaymentMode === 'balance' ? Math.max(0, cartTotal - (posUser?.remainingCredit || 0)) : 0
      const paymentMethod = posPaymentMode === 'balance' ? 'BALANCE' : (posCardPaid ? 'CARD' : 'CASH')
      const shortfallMethod = shortfall > 0 ? (posCardPaid ? 'CARD' : 'CASH') : null
      await api.post('/pos/otp/confirm-send', {
        nationalId: nationalId.trim(),
        items: items.map(i => ({ productId: i.productId, quantity: i.qty })),
        paymentMethod,
        shortfallMethod,
      })
      setPosConfirmOtpSent(true)
    } catch (err) {
      setPosConfirmError(err.response?.data?.error || 'حدث خطأ في إرسال رمز التأكيد')
    }
    setPosConfirmLoading(false)
  }

  // OTP flow
  async function sendOtp(e) {
    e.preventDefault()
    setOtpError(''); setOtpLoading(true)
    try {
      const { data } = await api.post('/pos/otp/request', { nationalId: nationalId.trim() })
      setOtpDisplay(data.otp)
      setOtpSent(true)
    } catch (err) { setOtpError(err.response?.data?.error || 'حدث خطأ') }
    setOtpLoading(false)
  }

  async function resendOtp() {
    setOtpError(''); setOtpValue(''); setOtpLoading(true)
    try {
      const { data } = await api.post('/pos/otp/request', { nationalId: nationalId.trim() })
      setOtpDisplay(data.otp)
      setOtpError('تم إعادة إرسال OTP بنجاح ✓')
    } catch (err) { setOtpError(err.response?.data?.error || 'حدث خطأ في إعادة الإرسال') }
    setOtpLoading(false)
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setOtpError(''); setOtpLoading(true)
    try {
      const { data } = await api.post('/pos/otp/verify', { nationalId: nationalId.trim(), otp: otpValue.trim() })
      setPosUser(data)
    } catch (err) { setOtpError(err.response?.data?.error || 'رمز OTP غير صحيح') }
    setOtpLoading(false)
  }

  // Card flow
  async function verifyPin(e) {
    e.preventDefault()
    setCardError(''); setCardLoading(true)
    try {
      const { data } = await api.post('/pos/card/lookup', { cardPin })
      setPosUser(data)
    } catch (err) { setCardError(err.response?.data?.error || 'رمز الكارت غير صحيح') }
    setCardLoading(false)
  }

  // Shared sale
  async function recordSale(e) {
    e.preventDefault()
    const items = posCart.filter(i => i.qty > 0)
    if (!items.length) return setPosMsg('error:اختر منتجاً واحداً على الأقل')
    setPosLoading(true); setPosMsg('')
    try {
      if (posMainMode === 'guest') {
        const paymentMethod = posCardPaid ? 'CARD' : 'CASH'
        const { data } = await api.post('/pos/guest/purchase', {
          items: items.map(i => ({ productId: i.productId, quantity: i.qty })),
          paymentMethod,
        })
        const payLabel = paymentMethod === 'CARD' ? 'دُفع ببطاقة بنكية' : 'دُفع كاش'
        setPosMsg(`success:عميل غير مسجل — ${data.totalAmount} جنيه — ${payLabel}`)
        resetPos(); loadAll()
      } else {
        const cartTotal = posCart.reduce((s, i) => s + i.price * i.qty, 0)
        const shortfall = posPaymentMode === 'balance' ? Math.max(0, cartTotal - (posUser?.remainingCredit || 0)) : 0
        const paymentMethod = posPaymentMode === 'balance' ? 'BALANCE' : (posCardPaid ? 'CARD' : 'CASH')
        const shortfallMethod = shortfall > 0 ? (posCardPaid ? 'CARD' : 'CASH') : null
        const endpoint = posMethod === 'otp' ? '/pos/otp/purchase'
          : posMethod === 'qr' ? '/pos/qr-complete'
          : '/pos/card/purchase'
        const baseItems = items.map(i => ({ productId: i.productId, quantity: i.qty }))
        const payload = posMethod === 'otp'
          ? { nationalId: nationalId.trim(), otp: otpValue.trim(), confirmOtp: posConfirmOtp.trim(), items: baseItems, paymentMethod, shortfallMethod }
          : posMethod === 'qr'
          ? { nationalId: nationalId.trim(), confirmOtp: posConfirmOtp.trim(), items: baseItems, paymentMethod, shortfallMethod }
          : { cardPin, items: baseItems, paymentMethod, shortfallMethod }
        const { data } = await api.post(endpoint, payload)
        let payLabel
        if (paymentMethod === 'BALANCE' && data.shortfall > 0) {
          const sfLabel = data.shortfallMethod === 'CARD' ? 'ببطاقة بنكية' : 'كاش'
          payLabel = `${data.balanceDeducted.toFixed(2)} جنيه من الرصيد + ${data.shortfall.toFixed(2)} جنيه ${sfLabel} — متبقي: ${data.user.remainingCredit.toFixed(2)} جنيه`
        } else if (paymentMethod === 'BALANCE') {
          payLabel = `متبقي: ${data.user.remainingCredit.toFixed(2)} جنيه`
        } else {
          payLabel = paymentMethod === 'CARD' ? 'دُفع ببطاقة بنكية' : 'دُفع كاش'
        }
        setPosMsg(`success:${data.user.name} — ${data.totalAmount} جنيه — ${payLabel}`)
        resetPos(); loadAll()
      }
    } catch (err) { setPosMsg('error:' + (err.response?.data?.error || 'حدث خطأ')) }
    setPosLoading(false)
  }

  async function submitRestock(e) {
    e.preventDefault()
    const items = restockItems.filter(i => i.qty > 0)
    if (!items.length) return setRestockMsg('error:أدخل كميات صحيحة')
    setRestockMsg('')
    try {
      await api.post('/outlet/restocks', {
        note: restockNote,
        items: items.map(i => ({ productId: i.productId, quantity: i.qty })),
      })
      setRestockMsg('success')
      setRestockNote('')
      setRestockItems(prev => prev.map(i => ({ ...i, qty: 0 })))
      loadAll()
    } catch (err) {
      setRestockMsg('error:' + (err.response?.data?.error || 'حدث خطأ'))
    }
  }

  function handleLogout() { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-green-800 text-white px-4 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-lg">{profile?.name || 'لوحة المنفذ'}</h1>
          <p className="text-green-200 text-sm">{profile?.address || user?.name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg">خروج</button>
      </header>

      {notifications.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 space-y-1">
          {notifications.map((n, i) => <p key={i} className="text-sm text-amber-800">{n}</p>)}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <p className="text-sm font-bold text-red-700">⚠️ مخزون منخفض في {alerts.length} منتجات</p>
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

      <main className="max-w-3xl mx-auto p-4 space-y-4">

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-4 border-b font-bold text-gray-700">المخزون الحالي</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['المنتج', 'الفئة', 'الكمية', 'الوحدة', 'السعر', 'الحالة'].map(h => (
                      <th key={h} className="px-4 py-3 text-right font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(p => (
                    <tr key={p.id} className={`border-t ${p.lowStock ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.category || '---'}</td>
                      <td className="px-4 py-3 font-bold">{p.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                      <td className="px-4 py-3">{p.pricePerUnit} جنيه</td>
                      <td className="px-4 py-3">
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
          </div>
        )}

        {/* POS */}
        {tab === 'pos' && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-700">نقطة البيع</h2>

            {/* success message */}
            {posMsg.startsWith('success:') && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-center space-y-3">
                <p className="text-2xl">✅</p>
                <p className="font-bold">{posMsg.replace('success:', '')}</p>
                <button onClick={resetPos} className="bg-green-700 text-white px-6 py-2 rounded-xl font-medium hover:bg-green-800">
                  عملية جديدة
                </button>
              </div>
            )}

            {!posMsg.startsWith('success:') && (
              <>
                {/* ── MAIN SELECTION: Tamween vs Guest ── */}
                {posMainMode === null && (
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <button onClick={() => setPosMainMode('tamween')}
                      className="p-6 border-2 border-green-600 bg-green-50 rounded-2xl flex flex-col items-center gap-3 hover:bg-green-100 transition-colors text-center">
                      <span className="text-5xl">🏛️</span>
                      <span className="font-bold text-green-800 text-base">أفراد التموين</span>
                      <span className="text-xs text-green-600">مسجلون في منظومة التموين</span>
                    </button>
                    <button onClick={() => setPosMainMode('guest')}
                      className="p-6 border-2 border-orange-500 bg-orange-50 rounded-2xl flex flex-col items-center gap-3 hover:bg-orange-100 transition-colors text-center">
                      <span className="text-5xl">🛒</span>
                      <span className="font-bold text-orange-800 text-base">غير المسجلين</span>
                      <span className="text-xs text-orange-600">دفع مباشر — كاش أو بطاقة</span>
                    </button>
                  </div>
                )}

                {/* ── TAMWEEN: sub-method selector ── */}
                {posMainMode === 'tamween' && (
                  <div className="space-y-3">
                    <button onClick={resetPos}
                      className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-colors">
                      ← رجوع للقائمة الرئيسية
                    </button>
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                      <button onClick={() => switchSubMethod('otp')}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${posMethod === 'otp' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>
                        📱 رقم قومي + OTP
                      </button>
                      <button onClick={() => switchSubMethod('card')}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${posMethod === 'card' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>
                        💳 بطاقة التموين
                      </button>
                      <button onClick={() => switchSubMethod('qr')}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${posMethod === 'qr' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>
                        📷 QR Code
                      </button>
                    </div>
                  </div>
                )}

                {/* ── OTP METHOD ── */}
                {posMainMode === 'tamween' && posMethod === 'otp' && !posUser && (
                  <div className="space-y-4">
                    {!otpSent ? (
                      <form onSubmit={sendOtp} className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">الرقم القومي للعميل</label>
                        <input value={nationalId} onChange={e => setNationalId(e.target.value)}
                          placeholder="29901011234567" maxLength={14}
                          className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-500" required />
                        {otpError && <p className="text-red-600 text-sm text-center">{otpError}</p>}
                        <button type="submit" disabled={otpLoading}
                          className="w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                          {otpLoading ? 'جاري الإرسال...' : 'إرسال OTP للعميل'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={verifyOtp} className="space-y-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-700">
                          ✉️ تم إرسال OTP للعميل — اطلب منه الرمز
                        </div>
                        <label className="block text-sm font-medium text-gray-700">أدخل رمز OTP</label>
                        <input value={otpValue} onChange={e => setOtpValue(e.target.value)}
                          placeholder="123456" maxLength={6}
                          className="w-full border rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-green-500" required />
                        {otpError && (
                          <p className={`text-sm text-center ${otpError.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                            {otpError}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button type="button" onClick={resendOtp} disabled={otpLoading}
                            className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50">
                            {otpLoading ? 'جاري الإرسال...' : 'إعادة الإرسال'}
                          </button>
                          <button type="submit" disabled={otpLoading}
                            className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                            {otpLoading ? 'جاري التحقق...' : 'تحقق'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ── CARD METHOD ── */}
                {posMainMode === 'tamween' && posMethod === 'card' && !posUser && (
                  <div className="space-y-4">
                    {!cardInserted ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-5">
                        <div className="w-48 h-28 bg-gradient-to-br from-green-700 to-green-500 rounded-2xl shadow-lg flex flex-col justify-between p-4 text-white select-none">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-medium opacity-80">بطاقة التموين</span>
                            <span className="text-lg">📡</span>
                          </div>
                          <div className="w-10 h-7 bg-yellow-300 rounded opacity-90" />
                          <div className="text-xs tracking-widest opacity-80">**** **** **** ****</div>
                        </div>
                        <p className="text-gray-500 text-sm">أدخل البطاقة في الجهاز</p>
                        <button onClick={() => setCardInserted(true)}
                          className="bg-green-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-800 text-sm">
                          ✓ تم إدخال البطاقة
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={verifyPin} className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700">
                          ✅ تمت قراءة الشريحة — أدخل الرمز السري
                        </div>
                        <label className="block text-sm font-medium text-gray-700 text-center">الرمز السري (4 أرقام)</label>
                        <input value={cardPin} onChange={e => setCardPin(e.target.value)}
                          placeholder="••••" maxLength={4} type="password"
                          className="w-full border rounded-xl px-4 py-4 text-center text-3xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-green-500" required />
                        {cardError && <p className="text-red-600 text-sm text-center">{cardError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setCardInserted(false); setCardPin(''); setCardError('') }}
                            className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">
                            إلغاء
                          </button>
                          <button type="submit" disabled={cardLoading}
                            className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                            {cardLoading ? 'جاري التحقق...' : 'تأكيد'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ── QR METHOD: show QR and wait for citizen to scan ── */}
                {posMainMode === 'tamween' && posMethod === 'qr' && !posUser && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-4 py-2">
                      <div className="bg-white p-4 rounded-2xl shadow-lg border-4 border-green-600">
                        {user?.outletId ? (
                          <QRCodeSVG
                            value={`http://${window.location.hostname}:5173/qr/${user.outletId}`}
                            size={210}
                            bgColor="#ffffff"
                            fgColor="#166534"
                            level="H"
                          />
                        ) : (
                          <div className="w-52 h-52 flex items-center justify-center text-gray-400 text-sm">جاري التحميل...</div>
                        )}
                      </div>
                      <div className="text-center space-y-1">
                        <p className="font-bold text-gray-800">{profile?.name}</p>
                        <p className="text-xs text-gray-500">{profile?.address}</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="animate-pulse text-lg">⏳</span>
                        <p className="font-bold text-amber-800 text-sm">في انتظار مسح العميل للرمز...</p>
                      </div>
                      <p className="text-xs text-amber-600">بمجرد مسح العميل للرمز وتأكيد هويته ستبدأ عملية البيع تلقائياً</p>
                    </div>
                  </div>
                )}

                {/* ── GUEST METHOD: no auth, direct cart ── */}
                {posMainMode === 'guest' && (
                  <div className="space-y-4">
                    <button onClick={resetPos}
                      className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-colors">
                      ← رجوع للقائمة الرئيسية
                    </button>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-2 text-center text-sm text-orange-700 font-medium">
                      🛒 بيع لغير المسجلين — بدون خصم من رصيد التموين
                    </div>

                    {/* bank card widget */}
                    {!posCardPaid ? (
                      <div className="border-2 border-blue-200 bg-blue-50 rounded-2xl p-4 space-y-3">
                        <p className="font-bold text-blue-800 text-center text-sm">دفع بالبطاقة البنكية (اختياري)</p>
                        {!posCardInserted ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-44 bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl shadow-lg flex flex-col justify-between p-4 text-white select-none" style={{height:'6.5rem'}}>
                              <div className="flex justify-between items-start">
                                <span className="text-xs opacity-80">بطاقة بنكية</span>
                                <span className="text-lg">📡</span>
                              </div>
                              <div className="w-9 h-6 bg-yellow-300 rounded opacity-90" />
                              <div className="text-xs tracking-widest opacity-70">**** **** **** ****</div>
                            </div>
                            <button onClick={() => setPosCardInserted(true)}
                              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 text-sm">
                              إدخال البطاقة البنكية
                            </button>
                            <button className="text-sm text-gray-500 underline hover:text-gray-700">
                              تخطي — سيتم الدفع كاش
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-blue-100 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-800">
                              ✅ تمت قراءة البطاقة — أدخل الرمز السري
                            </div>
                            <input value={posCardPin} onChange={e => setPosCardPin(e.target.value)}
                              placeholder="••••••" maxLength={6} type="password"
                              className="w-full border rounded-xl px-4 py-4 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {posCardError && <p className="text-red-600 text-sm text-center">{posCardError}</p>}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setPosCardInserted(false); setPosCardPin(''); setPosCardError('') }}
                                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">
                                إلغاء
                              </button>
                              <button type="button" disabled={posCardLoading}
                                onClick={async () => {
                                  if (posCardPin !== '000000') { setPosCardError('رمز البطاقة غير صحيح'); return }
                                  setPosCardLoading(true)
                                  await new Promise(r => setTimeout(r, 1200))
                                  setPosCardPaid(true); setPosCardLoading(false)
                                }}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                                {posCardLoading ? 'جاري المعالجة...' : 'تأكيد الدفع'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-300 rounded-xl p-3 text-center text-blue-800 text-sm font-bold">
                        ✅ تمت الموافقة على البطاقة البنكية — سيتم الدفع ببطاقة بنكية
                      </div>
                    )}

                    <form onSubmit={recordSale} className="space-y-3">
                      <h3 className="font-medium text-gray-700">اختر المنتجات:</h3>
                      {posCart.map((item, i) => (
                        <div key={item.productId} className="flex items-center justify-between border rounded-xl p-3">
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.price} جنيه / {item.unit}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => { const u = [...posCart]; u[i].qty = Math.max(0, u[i].qty - 1); setPosCart(u) }}
                              className="w-8 h-8 rounded-full border font-bold text-lg flex items-center justify-center">-</button>
                            <span className="w-8 text-center font-bold">{item.qty}</span>
                            <button type="button" onClick={() => { const u = [...posCart]; u[i].qty++; setPosCart(u) }}
                              className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-lg flex items-center justify-center">+</button>
                          </div>
                        </div>
                      ))}
                      <div className="bg-gray-50 rounded-xl p-3 flex justify-between">
                        <span className="text-gray-600">الإجمالي</span>
                        <span className="font-bold text-orange-600">{posCart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)} جنيه</span>
                      </div>
                      {posMsg.startsWith('error:') && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
                          {posMsg.replace('error:', '')}
                        </div>
                      )}
                      <button type="submit" disabled={posLoading}
                        className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50">
                        {posLoading ? 'جاري التسجيل...' : 'تسجيل عملية البيع'}
                      </button>
                    </form>
                  </div>
                )}

                {/* ── SHARED: payment mode selection (tamween users only) ── */}
                {posMainMode === 'tamween' && posUser && !posPaymentMode && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-bold text-green-900">{posUser.name}</p>
                          <p className="text-sm text-gray-500">بطاقة: {posUser.tamweenCardId}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-500">الرصيد المتبقي</p>
                          <p className="font-bold text-green-700 text-xl">{posUser.remainingCredit?.toFixed(2)} جنيه</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-center font-bold text-gray-700 text-base">اختر طريقة الدفع</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setPosPaymentMode('balance')}
                        className="p-5 border-2 border-green-600 bg-green-50 rounded-2xl flex flex-col items-center gap-2 hover:bg-green-100 transition-colors">
                        <span className="text-4xl">💰</span>
                        <span className="font-bold text-green-800 text-sm">الدفع بالرصيد</span>
                        <span className="text-xs text-green-600 text-center">خصم من رصيد التموين</span>
                      </button>
                      <button onClick={() => setPosPaymentMode('no-balance')}
                        className="p-5 border-2 border-blue-500 bg-blue-50 rounded-2xl flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors">
                        <span className="text-4xl">💳</span>
                        <span className="font-bold text-blue-800 text-sm">الدفع بدون الرصيد</span>
                        <span className="text-xs text-blue-600 text-center">كاش أو بطاقة بنكية</span>
                      </button>
                    </div>
                    <button onClick={resetPos}
                      className="w-full border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">
                      إلغاء
                    </button>
                  </div>
                )}

                {/* ── SHARED: user info + optional bank card + cart (tamween users) ── */}
                {posMainMode === 'tamween' && posUser && posPaymentMode && (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-bold text-green-900">{posUser.name}</p>
                          <p className="text-sm text-gray-500">بطاقة: {posUser.tamweenCardId}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-500">الرصيد المتبقي</p>
                          <p className="font-bold text-green-700 text-xl">{posUser.remainingCredit?.toFixed(2)} جنيه</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${posPaymentMode === 'balance' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {posPaymentMode === 'balance' ? '💰 دفع بالرصيد' : '💳 دفع بدون رصيد'}
                        </span>
                        <button onClick={() => { setPosPaymentMode(null); setPosCardInserted(false); setPosCardPin(''); setPosCardError(''); setPosCardPaid(false) }}
                          className="text-xs text-gray-400 underline hover:text-gray-600">تغيير</button>
                      </div>
                    </div>

                    {/* bank card widget — only for no-balance mode */}
                    {posPaymentMode === 'no-balance' && !posCardPaid && (
                      <div className="border-2 border-blue-200 bg-blue-50 rounded-2xl p-4 space-y-3">
                        <p className="font-bold text-blue-800 text-center text-sm">دفع بالبطاقة البنكية (اختياري)</p>
                        {!posCardInserted ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-44 h-26 bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl shadow-lg flex flex-col justify-between p-4 text-white select-none" style={{height:'6.5rem'}}>
                              <div className="flex justify-between items-start">
                                <span className="text-xs opacity-80">بطاقة بنكية</span>
                                <span className="text-lg">📡</span>
                              </div>
                              <div className="w-9 h-6 bg-yellow-300 rounded opacity-90" />
                              <div className="text-xs tracking-widest opacity-70">**** **** **** ****</div>
                            </div>
                            <button onClick={() => setPosCardInserted(true)}
                              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 text-sm">
                              إدخال البطاقة البنكية
                            </button>
                            <button onClick={() => setPosPaymentMode('no-balance')}
                              className="text-sm text-gray-500 underline hover:text-gray-700">
                              تخطي — سيتم الدفع كاش
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-blue-100 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-800">
                              ✅ تمت قراءة البطاقة — أدخل الرمز السري
                            </div>
                            <input value={posCardPin} onChange={e => setPosCardPin(e.target.value)}
                              placeholder="••••••" maxLength={6} type="password"
                              className="w-full border rounded-xl px-4 py-4 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {posCardError && <p className="text-red-600 text-sm text-center">{posCardError}</p>}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setPosCardInserted(false); setPosCardPin(''); setPosCardError('') }}
                                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">
                                إلغاء
                              </button>
                              <button type="button" disabled={posCardLoading}
                                onClick={async () => {
                                  if (posCardPin !== '000000') { setPosCardError('رمز البطاقة غير صحيح'); return }
                                  setPosCardLoading(true)
                                  await new Promise(r => setTimeout(r, 1200))
                                  setPosCardPaid(true); setPosCardLoading(false)
                                }}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                                {posCardLoading ? 'جاري المعالجة...' : 'تأكيد الدفع'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {posPaymentMode === 'no-balance' && posCardPaid && (
                      <div className="bg-blue-50 border border-blue-300 rounded-xl p-3 text-center text-blue-800 text-sm font-bold">
                        ✅ تمت الموافقة على البطاقة البنكية — سيتم الدفع ببطاقة بنكية
                      </div>
                    )}

                    <form onSubmit={recordSale} className="space-y-3">
                      <h3 className="font-medium text-gray-700">اختر المنتجات:</h3>
                      {posCart.map((item, i) => (
                        <div key={item.productId} className="flex items-center justify-between border rounded-xl p-3">
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.price} جنيه / {item.unit}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => { const u = [...posCart]; u[i].qty = Math.max(0, u[i].qty - 1); setPosCart(u) }}
                              className="w-8 h-8 rounded-full border font-bold text-lg flex items-center justify-center">-</button>
                            <span className="w-8 text-center font-bold">{item.qty}</span>
                            <button type="button" onClick={() => { const u = [...posCart]; u[i].qty++; setPosCart(u) }}
                              className="w-8 h-8 rounded-full bg-green-700 text-white font-bold text-lg flex items-center justify-center">+</button>
                          </div>
                        </div>
                      ))}
                      {(() => {
                        const cartTotal = posCart.reduce((s, i) => s + i.price * i.qty, 0)
                        const shortfall = posPaymentMode === 'balance' ? Math.max(0, cartTotal - (posUser?.remainingCredit || 0)) : 0
                        const balanceUsed = posPaymentMode === 'balance' ? Math.min(posUser?.remainingCredit || 0, cartTotal) : cartTotal
                        return (
                          <>
                            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-600">الإجمالي</span>
                                <span className="font-bold text-green-700">{cartTotal.toFixed(2)} جنيه</span>
                              </div>
                              {posPaymentMode === 'balance' && shortfall > 0 && (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-green-600">من رصيد التموين</span>
                                    <span className="font-medium text-green-700">{balanceUsed.toFixed(2)} جنيه</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-amber-600">الفرق المطلوب</span>
                                    <span className="font-bold text-amber-700">{shortfall.toFixed(2)} جنيه</span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* shortfall bank card widget */}
                            {posPaymentMode === 'balance' && shortfall > 0 && (
                              <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl p-4 space-y-3">
                                <p className="font-bold text-amber-800 text-center text-sm">
                                  ⚠️ الرصيد غير كافٍ — الفرق {shortfall.toFixed(2)} جنيه
                                </p>
                                {!posCardPaid ? (
                                  <>
                                    {!posCardInserted ? (
                                      <div className="flex flex-col items-center gap-3">
                                        <div className="w-44 bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl shadow-lg flex flex-col justify-between p-4 text-white select-none" style={{height:'6.5rem'}}>
                                          <div className="flex justify-between items-start">
                                            <span className="text-xs opacity-80">بطاقة بنكية</span>
                                            <span className="text-lg">📡</span>
                                          </div>
                                          <div className="w-9 h-6 bg-yellow-300 rounded opacity-90" />
                                          <div className="text-xs tracking-widest opacity-70">**** **** **** ****</div>
                                        </div>
                                        <button type="button" onClick={() => setPosCardInserted(true)}
                                          className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 text-sm">
                                          دفع الفرق ببطاقة بنكية
                                        </button>
                                        <p className="text-xs text-gray-500 text-center">أو سيتم دفع الفرق كاش عند التأكيد</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="bg-blue-100 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-800">
                                          ✅ تمت قراءة البطاقة — أدخل الرمز السري
                                        </div>
                                        <input value={posCardPin} onChange={e => setPosCardPin(e.target.value)}
                                          placeholder="••••••" maxLength={6} type="password"
                                          className="w-full border rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        {posCardError && <p className="text-red-600 text-sm text-center">{posCardError}</p>}
                                        <div className="flex gap-2">
                                          <button type="button" onClick={() => { setPosCardInserted(false); setPosCardPin(''); setPosCardError('') }}
                                            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl font-medium text-sm">
                                            إلغاء
                                          </button>
                                          <button type="button" disabled={posCardLoading}
                                            onClick={async () => {
                                              if (posCardPin !== '000000') { setPosCardError('رمز البطاقة غير صحيح'); return }
                                              setPosCardLoading(true)
                                              await new Promise(r => setTimeout(r, 1200))
                                              setPosCardPaid(true); setPosCardLoading(false)
                                            }}
                                            className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 text-sm">
                                            {posCardLoading ? 'جاري المعالجة...' : 'تأكيد'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="bg-blue-50 border border-blue-300 rounded-xl p-3 text-center text-blue-800 text-sm font-bold">
                                    ✅ الفرق {shortfall.toFixed(2)} جنيه سيُدفع ببطاقة بنكية
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )
                      })()}

                      {posMsg.startsWith('error:') && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
                          {posMsg.replace('error:', '')}
                        </div>
                      )}

                      {/* OTP & QR methods: confirmation OTP step before submit */}
                      {(posMethod === 'otp' || posMethod === 'qr') && (() => {
                        const readyItems = posCart.filter(i => i.qty > 0)
                        if (!readyItems.length) return null
                        return (
                          <div className="border-t pt-3 space-y-3">
                            {!posConfirmOtpSent ? (
                              <>
                                {posConfirmError && <p className="text-red-600 text-sm text-center">{posConfirmError}</p>}
                                <button type="button" disabled={posConfirmLoading}
                                  onClick={() => sendPurchaseConfirmOtp(readyItems)}
                                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                                  {posConfirmLoading ? 'جاري الإرسال...' : '📨 إرسال رمز تأكيد الشراء للعميل'}
                                </button>
                                <p className="text-xs text-gray-400 text-center">سيصل للعميل رسالة بتفاصيل الفاتورة ورمز التأكيد</p>
                              </>
                            ) : (
                              <>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-700">
                                  ✉️ تم إرسال رمز تأكيد الشراء للعميل — اطلب منه الرمز
                                </div>
                                <input value={posConfirmOtp} onChange={e => setPosConfirmOtp(e.target.value)}
                                  placeholder="رمز تأكيد الشراء" maxLength={6}
                                  className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                {posConfirmError && <p className="text-red-600 text-sm text-center">{posConfirmError}</p>}
                                <div className="flex gap-2">
                                  <button type="button"
                                    onClick={() => { setPosConfirmOtpSent(false); setPosConfirmOtp(''); setPosConfirmError('') }}
                                    className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 text-sm">
                                    إعادة الإرسال
                                  </button>
                                  <button type="submit" disabled={posLoading || !posConfirmOtp.trim()}
                                    className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                                    {posLoading ? 'جاري التسجيل...' : '✅ تأكيد وإتمام البيع'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })()}

                      {/* Card method: direct submit */}
                      {posMethod === 'card' && (
                        <div className="flex gap-2">
                          <button type="button" onClick={resetPos}
                            className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">
                            إلغاء
                          </button>
                          <button type="submit" disabled={posLoading}
                            className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                            {posLoading ? 'جاري التسجيل...' : 'تسجيل عملية البيع'}
                          </button>
                        </div>
                      )}

                    </form>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* DELIVERIES */}
        {tab === 'deliveries' && (
          <>
            {/* Modal */}
            {selectedDelivery && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedDelivery(null); setDeliveryOtp(''); setDeliveryOtpError(''); setVisaCardInserted(false); setVisaPin(''); setVisaError(''); setVisaPaid(false) }}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">تفاصيل الطلب</h3>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selectedDelivery.status]}`}>
                      {STATUS_LABELS[selectedDelivery.status]}
                    </span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
                      <p><span className="text-gray-500">العميل: </span><span className="font-bold">{selectedDelivery.user?.name}</span></p>
                      <p><span className="text-gray-500">البطاقة: </span><span className="font-medium">{selectedDelivery.user?.tamweenCardId}</span></p>
                      <p><span className="text-gray-500">العنوان: </span><span className="font-medium">{selectedDelivery.address}</span></p>
                      <p><span className="text-gray-500">الوقت: </span><span className="font-medium">{new Date(selectedDelivery.createdAt).toLocaleString('ar-EG')}</span></p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">الأصناف المطلوبة:</p>
                      <div className="space-y-2">
                        {selectedDelivery.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm border rounded-lg px-3 py-2">
                            <span className="font-medium">{item.product}</span>
                            <span className="text-gray-500">{item.quantity} {item.unit} × {item.unitPrice} جنيه = <span className="text-green-700 font-bold">{(item.quantity * item.unitPrice).toFixed(2)} جنيه</span></span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">رسوم التوصيل</span>
                        <span className="font-medium">{selectedDelivery.deliveryFee} جنيه</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                        <span>الإجمالي</span>
                        <span className="text-green-700">{selectedDelivery.totalAmount} جنيه</span>
                      </div>
                    </div>

                    {selectedDelivery.extraPayment > 0 && selectedDelivery.status !== 'DELIVERED' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        ⚠️ رصيد العميل لا يغطي الطلب بالكامل — سيدفع <span className="font-bold">{selectedDelivery.extraPayment.toFixed(2)} جنيه</span> إضافياً
                      </div>
                    )}
                    {selectedDelivery.status === 'DELIVERED' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm space-y-1">
                        {selectedDelivery.extraPayment > 0 ? (
                          <>
                            <p className="text-gray-600">المبلغ من رصيد التموين: <span className="font-bold text-green-700">{(selectedDelivery.totalAmount - selectedDelivery.extraPayment).toFixed(2)} جنيه</span></p>
                            <p className="text-gray-600">المبلغ الإضافي المدفوع: <span className="font-bold text-blue-700">{selectedDelivery.extraPayment.toFixed(2)} جنيه</span></p>
                            <p className="text-gray-600">طريقة الدفع الإضافي: <span className="font-bold">{selectedDelivery.extraPaymentMethod === 'CARD' ? '💳 بطاقة بنكية' : '💵 كاش'}</span></p>
                          </>
                        ) : (
                          <p className="text-green-700 font-medium">✅ تم الدفع بالكامل من رصيد التموين</p>
                        )}
                      </div>
                    )}
                    {selectedDelivery.extraPayment === 0 && selectedDelivery.status !== 'DELIVERED' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                        ✅ رصيد العميل يغطي الطلب بالكامل
                      </div>
                    )}

                    {selectedDelivery.status === 'PENDING' && (
                      <button onClick={() => updateDeliveryStatus(selectedDelivery.id, 'CONFIRMED')} disabled={deliveryActionLoading}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                        {deliveryActionLoading ? 'جاري...' : '📦 بدء التحضير'}
                      </button>
                    )}

                    {selectedDelivery.status === 'CONFIRMED' && (
                      <button onClick={() => updateDeliveryStatus(selectedDelivery.id, 'OUT_FOR_DELIVERY')} disabled={deliveryActionLoading}
                        className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50">
                        {deliveryActionLoading ? 'جاري...' : '🚚 خرج للتوصيل'}
                      </button>
                    )}

                    {selectedDelivery.status === 'OUT_FOR_DELIVERY' && (
                      <div className="space-y-3">

                        {/* ── OTP always visible ── */}
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-600 font-medium">رمز OTP لتأكيد التسليم</p>
                          <button onClick={() => updateDeliveryStatus(selectedDelivery.id, 'OUT_FOR_DELIVERY')}
                            className="text-xs text-blue-600 hover:underline">
                            إعادة إرسال OTP
                          </button>
                        </div>
                        <input value={deliveryOtp} onChange={e => setDeliveryOtp(e.target.value)}
                          placeholder="أدخل رمز OTP" maxLength={6}
                          className="w-full border-2 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-green-500" />

                        {/* ── Optional bank card payment (only shown if extra amount exists) ── */}
                        {selectedDelivery.extraPayment > 0 && (
                          <div className="border-2 border-blue-200 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-bold text-blue-700 text-center">💳 دفع المبلغ الإضافي بالبطاقة البنكية (اختياري — الكاش مقبول)</p>
                            <p className="text-xs text-center text-gray-500">المبلغ الإضافي: <span className="font-bold text-blue-700">{selectedDelivery.extraPayment.toFixed(2)} جنيه</span></p>

                            {!visaPaid ? (
                              !visaCardInserted ? (
                                <div className="flex flex-col items-center space-y-3">
                                  <div className="w-44 bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl shadow-lg flex flex-col justify-between p-4 text-white select-none" style={{height: 104}}>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-medium opacity-80">BANK CARD</span>
                                      <span className="text-base">📡</span>
                                    </div>
                                    <div className="w-8 h-6 bg-yellow-300 rounded opacity-90" />
                                    <div className="text-xs tracking-widest opacity-70">**** **** **** ****</div>
                                  </div>
                                  <p className="text-sm text-gray-500">اطلب من العميل إدخال البطاقة البنكية</p>
                                  <button onClick={() => setVisaCardInserted(true)}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 text-sm w-full">
                                    ✓ تم إدخال الكارت
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-center text-sm text-blue-700">
                                    ✅ تمت قراءة الشريحة — أدخل كلمة المرور
                                  </div>
                                  <input value={visaPin} onChange={e => setVisaPin(e.target.value)}
                                    placeholder="••••••" maxLength={6} type="password"
                                    className="w-full border-2 rounded-xl px-4 py-3 text-center text-3xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                  {visaError && <p className="text-red-600 text-sm text-center">{visaError}</p>}
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => { setVisaCardInserted(false); setVisaPin(''); setVisaError('') }}
                                      className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
                                      إلغاء
                                    </button>
                                    <button disabled={visaLoading || !visaPin} onClick={() => {
                                      if (visaPin !== '000000') { setVisaError('كلمة المرور غير صحيحة'); return }
                                      setVisaLoading(true)
                                      setTimeout(() => { setVisaPaid(true); setVisaLoading(false) }, 1200)
                                    }} className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 text-sm">
                                      {visaLoading ? 'جاري الدفع...' : 'تأكيد الدفع'}
                                    </button>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="bg-green-50 border border-green-300 rounded-xl p-3 text-center text-sm text-green-700 font-bold">
                                ✅ تم دفع {selectedDelivery.extraPayment.toFixed(2)} جنيه بالبطاقة البنكية
                              </div>
                            )}
                          </div>
                        )}

                        {deliveryOtpError && <p className="text-red-600 text-sm text-center">{deliveryOtpError}</p>}
                        <button onClick={() => confirmDeliveryOtp(selectedDelivery.id)} disabled={deliveryActionLoading || !deliveryOtp}
                          className="w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                          {deliveryActionLoading ? 'جاري التأكيد...' : `✅ تأكيد التسليم ${selectedDelivery.extraPayment > 0 ? (visaPaid ? '(بطاقة بنكية)' : '(كاش)') : ''}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-700">طلبات التوصيل</h2>
            {deliveries.filter(d => d.status !== 'DELIVERED').length === 0 && deliveries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">لا توجد طلبات توصيل بعد</div>
            ) : (
              <>
                {deliveries.filter(d => d.status !== 'DELIVERED').length > 0 && (
                  <>
                    <p className="text-sm text-gray-500 font-medium">الطلبات النشطة</p>
                    {deliveries.filter(d => d.status !== 'DELIVERED').map(d => (
                      <div key={d.id} onClick={() => { setSelectedDelivery(d); setDeliveryOtp(''); setDeliveryOtpError('') }}
                        className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-r-4 border-green-500">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-800">{d.user?.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">{d.address}</p>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                            {STATUS_LABELS[d.status]}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>{d.itemCount} صنف</span>
                          <span className="font-bold text-green-700">{d.totalAmount} جنيه</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {deliveries.filter(d => d.status === 'DELIVERED').length > 0 && (
                  <>
                    <p className="text-sm text-gray-500 font-medium mt-2">المُسلَّمة</p>
                    {deliveries.filter(d => d.status === 'DELIVERED').map(d => (
                      <div key={d.id} onClick={() => { setSelectedDelivery(d); setDeliveryOtp(''); setDeliveryOtpError('') }}
                        className="bg-white rounded-xl shadow p-4 cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-800">{d.user?.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">{d.address}</p>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                            {STATUS_LABELS[d.status]}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>{d.itemCount} صنف</span>
                          <span className="font-bold text-green-700">{d.totalAmount} جنيه</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* SALES */}
        {tab === 'sales' && (
          <>
            <h2 className="text-lg font-bold text-gray-700">سجل المبيعات</h2>
            {sales.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">لا توجد مبيعات بعد</div>
            ) : sales.map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      s.type === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {s.type === 'DELIVERY' ? '🚚 توصيل' : '🏪 حضوري'}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-green-50 text-green-700">
                      {(() => {
                        const METHOD = { BALANCE: 'رصيد', CASH: 'كاش', CARD: 'بطاقة بنكية' }
                        const extra = s.extraPaymentMethod && s.extraAmount > 0
                        if (!extra) return METHOD[s.paymentMethod] || s.paymentMethod
                        return `${METHOD[s.paymentMethod]} + ${s.extraAmount} جنيه ${METHOD[s.extraPaymentMethod] || s.extraPaymentMethod}`
                      })()}
                    </span>
                  </div>
                  <span className="font-bold text-green-700">{s.totalAmount} جنيه</span>
                </div>
                <p className="text-sm font-medium">
                  {s.user ? <>{s.user.name} <span className="text-gray-400">({s.user.tamweenCardId})</span></> : <span className="text-gray-400">غير مسجل</span>}
                </p>
                <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</p>
                <div className="mt-2 space-y-1">
                  {s.items?.map((item, i) => (
                    <div key={i} className="text-xs text-gray-500 flex justify-between">
                      <span>{item.product}</span>
                      <span>{item.quantity} {item.unit} × {item.unitPrice} جنيه</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* RESTOCKS */}
        {tab === 'messages' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-700">رسائل الوزارة</h2>
              <button onClick={() => api.get('/outlet/messages').then(r => setOutletMessages(r.data))}
                className="text-sm text-green-700 hover:underline">تحديث</button>
            </div>
            {outletMessages.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">لا توجد رسائل</div>
            ) : outletMessages.map(msg => (
              <div key={msg.id} className={`bg-white rounded-2xl shadow p-4 border-r-4 ${msg.isRead ? 'border-gray-200' : 'border-green-600'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${msg.isRead ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                    {msg.isRead ? 'مقروءة' : '● جديدة'}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString('ar-EG')}</span>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                {!msg.isRead && (
                  <button onClick={() => markRead(msg.id)}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline">
                    تحديد كمقروءة
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
