import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { io } from 'socket.io-client'
import QRCode from 'react-native-qrcode-svg'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { COLORS, API_URL } from '../config'

const TABS = [
  { id: 'inventory',  label: 'المخزون'    },
  { id: 'pos',        label: 'نقطة البيع' },
  { id: 'deliveries', label: 'التوصيل'    },
  { id: 'sales',      label: 'المبيعات'   },
  { id: 'messages',   label: 'الرسائل'    },
]

const STATUS_LABEL = {
  PENDING:          'قيد الانتظار',
  CONFIRMED:        'مؤكد',
  OUT_FOR_DELIVERY: 'في الطريق',
  DELIVERED:        'تم التسليم',
  CANCELLED:        'ملغي',
}
const STATUS_COLOR = {
  PENDING:          { bg: '#FFF3E0', text: '#E65100' },
  CONFIRMED:        { bg: '#E3F2FD', text: '#1565C0' },
  OUT_FOR_DELIVERY: { bg: '#E8F5E9', text: '#1B5E20' },
  DELIVERED:        { bg: '#F3E5F5', text: '#4A148C' },
  CANCELLED:        { bg: '#FFEBEE', text: '#B71C1C' },
}

export default function OutletDashboard({ navigation }) {
  const { user, logout } = useAuth()
  const socketRef = useRef(null)

  const [tab, setTab]               = useState('inventory')
  const [profile, setProfile]       = useState(null)
  const [inventory, setInventory]   = useState([])
  const [alerts, setAlerts]         = useState([])
  const [sales, setSales]           = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [messages, setMessages]     = useState([])
  const [notifications, setNotifications] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  // POS state
  const [posMainMode, setPosMainMode]     = useState(null) // null | 'tamween' | 'guest'
  const [posMethod, setPosMethod]         = useState('otp') // 'otp' | 'card' | 'qr'
  const [posUser, setPosUser]             = useState(null)
  const [posPaymentMode, setPosPaymentMode] = useState(null) // null | 'balance' | 'no-balance'
  const [posCart, setPosCart]             = useState([])
  const [posMsg, setPosMsg]               = useState('')
  const [posLoading, setPosLoading]       = useState(false)

  // OTP method
  const [nationalId, setNationalId]   = useState('')
  const [otpSent, setOtpSent]         = useState(false)
  const [otpValue, setOtpValue]       = useState('')
  const [otpLoading, setOtpLoading]   = useState(false)
  const [otpError, setOtpError]       = useState('')

  // Card method
  const [cardInserted, setCardInserted] = useState(false)
  const [cardPin, setCardPin]           = useState('')
  const [cardError, setCardError]       = useState('')
  const [cardLoading, setCardLoading]   = useState(false)

  // Purchase confirm OTP (for otp/qr methods)
  const [confirmOtpSent, setConfirmOtpSent]   = useState(false)
  const [confirmOtp, setConfirmOtp]           = useState('')
  const [confirmOtpLoading, setConfirmOtpLoading] = useState(false)
  const [confirmOtpError, setConfirmOtpError] = useState('')

  // Bank card for shortfall/no-balance
  const [posCardInserted, setPosCardInserted] = useState(false)
  const [posCardPin, setPosCardPin]           = useState('')
  const [posCardError, setPosCardError]       = useState('')
  const [posCardPaid, setPosCardPaid]         = useState(false)
  const [posCardLoading, setPosCardLoading]   = useState(false)

  // Delivery management
  const [expandedDelivery, setExpandedDelivery] = useState(null)
  const [otpInputs, setOtpInputs]   = useState({})
  const [cardState, setCardState]   = useState({})
  const [statusLoading, setStatusLoading]   = useState({})
  const [confirmLoading, setConfirmLoading] = useState({})

  const loadInventory = useCallback(async () => {
    const { data } = await api.get('/outlet/inventory')
    const prods = data.products || []
    setInventory(prods)
    setAlerts(data.alerts || [])
    setPosCart(prods.map(p => ({ productId: p.productId, name: p.name, unit: p.unit, price: p.pricePerUnit, qty: 0 })))
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [prof, sal, dels, msgs] = await Promise.allSettled([
        api.get('/outlet/profile'),
        api.get('/outlet/sales'),
        api.get('/outlet/deliveries'),
        api.get('/outlet/messages'),
      ])
      if (prof.status === 'fulfilled') setProfile(prof.value.data)
      if (sal.status  === 'fulfilled') setSales(sal.value.data.data || [])
      if (dels.status === 'fulfilled') setDeliveries(dels.value.data)
      if (msgs.status === 'fulfilled') setMessages(msgs.value.data || [])
      await loadInventory()
    } catch {}
  }, [loadInventory])

  useEffect(() => {
    if (tab === 'messages')  api.get('/outlet/messages').then(r => setMessages(r.data || [])).catch(() => {})
    if (tab === 'inventory') loadInventory()
  }, [tab])

  useEffect(() => {
    loadAll()

    const socket = io(API_URL)
    socketRef.current = socket
    if (user?.outletId) socket.emit('join-outlet', user.outletId)

    socket.on('low-stock', ({ product, remaining }) => {
      setNotifications(prev => [`⚠️ مخزون منخفض: ${product} (متبقي: ${remaining})`, ...prev.slice(0, 4)])
      loadInventory()
    })
    socket.on('new-order', ({ totalAmount }) => {
      setNotifications(prev => [`📦 طلب توصيل جديد: ${totalAmount} جنيه`, ...prev.slice(0, 4)])
      api.get('/outlet/deliveries').then(r => setDeliveries(r.data)).catch(() => {})
    })
    socket.on('purchase-recorded', ({ userName, totalAmount }) => {
      setNotifications(prev => [`✅ بيع: ${userName} - ${totalAmount} جنيه`, ...prev.slice(0, 4)])
    })
    socket.on('qr-authenticated', (citizenData) => {
      setPosUser(citizenData)
      setNationalId(citizenData.nationalId || '')
      setNotifications(prev => [`📷 QR: ${citizenData.name} سجّل هويته`, ...prev.slice(0, 4)])
    })

    return () => socket.disconnect()
  }, [])

  async function onRefresh() { setRefreshing(true); await loadAll(); setRefreshing(false) }

  // ── POS helpers ─────────────────────────────────────────────────────────────

  function resetPos() {
    setPosMainMode(null); setPosMethod('otp'); setPosUser(null); setPosMsg(''); setPosPaymentMode(null)
    setNationalId(''); setOtpSent(false); setOtpValue(''); setOtpError(''); setOtpLoading(false)
    setCardInserted(false); setCardPin(''); setCardError(''); setCardLoading(false)
    setConfirmOtpSent(false); setConfirmOtp(''); setConfirmOtpError(''); setConfirmOtpLoading(false)
    setPosCardInserted(false); setPosCardPin(''); setPosCardError(''); setPosCardPaid(false); setPosCardLoading(false)
    setPosCart(prev => prev.map(i => ({ ...i, qty: 0 })))
  }

  function switchMethod(m) {
    setPosMethod(m); setPosUser(null); setNationalId(''); setOtpSent(false)
    setOtpValue(''); setOtpError(''); setCardInserted(false); setCardPin(''); setCardError('')
    setConfirmOtpSent(false); setConfirmOtp(''); setConfirmOtpError('')
  }

  function adjustPosCart(i, delta) {
    setPosCart(prev => { const u = [...prev]; u[i] = { ...u[i], qty: Math.max(0, u[i].qty + delta) }; return u })
  }

  async function sendOtp() {
    setOtpError(''); setOtpLoading(true)
    try {
      await api.post('/pos/otp/request', { nationalId: nationalId.trim() })
      setOtpSent(true)
    } catch (err) { setOtpError(err.response?.data?.error || 'حدث خطأ') }
    setOtpLoading(false)
  }

  async function verifyOtp() {
    setOtpError(''); setOtpLoading(true)
    try {
      const { data } = await api.post('/pos/otp/verify', { nationalId: nationalId.trim(), otp: otpValue.trim() })
      setPosUser(data)
    } catch (err) { setOtpError(err.response?.data?.error || 'رمز OTP غير صحيح') }
    setOtpLoading(false)
  }

  async function verifyCardPin() {
    setCardError(''); setCardLoading(true)
    try {
      const { data } = await api.post('/pos/card/lookup', { cardPin })
      setPosUser(data)
    } catch (err) { setCardError(err.response?.data?.error || 'رمز الكارت غير صحيح') }
    setCardLoading(false)
  }

  async function sendConfirmOtp() {
    const items = posCart.filter(i => i.qty > 0)
    if (!items.length) return Alert.alert('تنبيه', 'اختر منتجاً على الأقل')
    setConfirmOtpLoading(true); setConfirmOtpError('')
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
      setConfirmOtpSent(true)
    } catch (err) {
      setConfirmOtpError(err.response?.data?.error || 'حدث خطأ في إرسال رمز التأكيد')
    }
    setConfirmOtpLoading(false)
  }

  async function recordSale() {
    const items = posCart.filter(i => i.qty > 0)
    if (!items.length) return Alert.alert('تنبيه', 'اختر منتجاً على الأقل')
    setPosLoading(true); setPosMsg('')
    try {
      if (posMainMode === 'guest') {
        const paymentMethod = posCardPaid ? 'CARD' : 'CASH'
        const { data } = await api.post('/pos/guest/purchase', {
          items: items.map(i => ({ productId: i.productId, quantity: i.qty })),
          paymentMethod,
        })
        setPosMsg(`success:عميل غير مسجل — ${data.totalAmount} جنيه — ${paymentMethod === 'CARD' ? 'دُفع ببطاقة بنكية' : 'دُفع كاش'}`)
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
          ? { nationalId: nationalId.trim(), otp: otpValue.trim(), confirmOtp: confirmOtp.trim(), items: baseItems, paymentMethod, shortfallMethod }
          : posMethod === 'qr'
          ? { nationalId: nationalId.trim(), confirmOtp: confirmOtp.trim(), items: baseItems, paymentMethod, shortfallMethod }
          : { cardPin, items: baseItems, paymentMethod, shortfallMethod }
        const { data } = await api.post(endpoint, payload)
        let label = paymentMethod === 'BALANCE'
          ? `متبقي: ${data.user.remainingCredit.toFixed(2)} جنيه`
          : paymentMethod === 'CARD' ? 'دُفع ببطاقة بنكية' : 'دُفع كاش'
        setPosMsg(`success:${data.user.name} — ${data.totalAmount} جنيه — ${label}`)
        resetPos(); loadAll()
      }
    } catch (err) { setPosMsg('error:' + (err.response?.data?.error || 'حدث خطأ')) }
    setPosLoading(false)
  }

  // ── Delivery helpers ─────────────────────────────────────────────────────────

  async function updateStatus(orderId, status) {
    setStatusLoading(prev => ({ ...prev, [orderId]: true }))
    try {
      await api.patch(`/outlet/deliveries/${orderId}`, { status })
      const { data } = await api.get('/outlet/deliveries')
      setDeliveries(data)
      if (status === 'OUT_FOR_DELIVERY') Alert.alert('تم', 'تم إرسال OTP للعميل عبر الرسائل')
    } catch (err) { Alert.alert('خطأ', err.response?.data?.error || 'حدث خطأ') }
    setStatusLoading(prev => ({ ...prev, [orderId]: false }))
  }

  async function confirmDelivery(order) {
    const otp = otpInputs[order.id]?.trim()
    if (!otp) return Alert.alert('تنبيه', 'أدخل رمز OTP')
    const card = cardState[order.id] || {}
    const hasExtra = order.extraPayment > 0
    if (hasExtra && !card.paid) return Alert.alert('تنبيه', 'يجب إتمام دفع المبلغ الإضافي أولاً')
    const paymentMethod = card.paid ? 'CARD' : 'CASH'
    setConfirmLoading(prev => ({ ...prev, [order.id]: true }))
    try {
      await api.post(`/outlet/deliveries/${order.id}/confirm`, { otp, paymentMethod })
      Alert.alert('تم ✅', 'تم تأكيد التسليم وخصم الرصيد')
      setOtpInputs(prev => ({ ...prev, [order.id]: '' }))
      setCardState(prev => ({ ...prev, [order.id]: {} }))
      setExpandedDelivery(null)
      const { data } = await api.get('/outlet/deliveries')
      setDeliveries(data)
    } catch (err) { Alert.alert('خطأ', err.response?.data?.error || 'رمز OTP غير صحيح') }
    setConfirmLoading(prev => ({ ...prev, [order.id]: false }))
  }

  function setCardField(orderId, field, value) {
    setCardState(prev => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), [field]: value } }))
  }

  async function markRead(id) {
    await api.patch(`/outlet/messages/${id}/read`)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m))
  }

  function handleLogout() { logout(); navigation.replace('Login') }

  const activeDeliveries = deliveries.filter(d => d.status !== 'DELIVERED' && d.status !== 'CANCELLED')
  const doneDeliveries   = deliveries.filter(d => d.status === 'DELIVERED' || d.status === 'CANCELLED')
  const cartTotal        = posCart.reduce((s, i) => s + i.price * i.qty, 0)
  const shortfall        = posPaymentMode === 'balance' ? Math.max(0, cartTotal - (posUser?.remainingCredit || 0)) : 0
  const readyItems       = posCart.filter(i => i.qty > 0)

  // QR value - same format as web so citizen mobile/web can scan
  const apiHost = API_URL.replace(/^https?:\/\//, '').split(':')[0]
  const qrValue = `http://${apiHost}:5173/qr/${user?.outletId}`

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{profile?.name || 'لوحة المنفذ'}</Text>
          <Text style={s.headerSub}>{profile?.address || user?.name}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {notifications.length > 0 && (
        <View style={s.notifBanner}>
          {notifications.map((n, i) => <Text key={i} style={s.notifText}>{n}</Text>)}
        </View>
      )}
      {alerts.length > 0 && (
        <View style={s.alertBanner}>
          <Text style={s.alertText}>⚠️ مخزون منخفض في {alerts.length} منتجات</Text>
        </View>
      )}
      {activeDeliveries.length > 0 && (
        <TouchableOpacity style={s.deliveryBanner} onPress={() => setTab('deliveries')}>
          <Text style={s.deliveryBannerText}>🚚 {activeDeliveries.length} طلب توصيل نشط</Text>
        </TouchableOpacity>
      )}

      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {/* ── INVENTORY ───────────────────────────────────────────── */}
        {tab === 'inventory' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>المخزون الحالي</Text>
            {inventory.map(p => (
              <View key={p.id} style={[s.invRow, p.lowStock && { backgroundColor: '#FFF3F3' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.invName}>{p.name}</Text>
                  <Text style={s.muted}>{p.category || ''} · {p.pricePerUnit} جنيه/{p.unit}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.invQty, p.lowStock && { color: COLORS.danger }]}>{p.quantity}</Text>
                  <Text style={[s.muted, { fontSize: 11 }]}>{p.unit}</Text>
                  {p.lowStock && <Text style={s.lowBadge}>منخفض</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── POS ─────────────────────────────────────────────────── */}
        {tab === 'pos' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>نقطة البيع</Text>

            {/* Success */}
            {posMsg.startsWith('success:') && (
              <View style={s.successBox}>
                <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>✅</Text>
                <Text style={s.successText}>{posMsg.replace('success:', '')}</Text>
                <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={() => setPosMsg('')}>
                  <Text style={s.btnText}>عملية جديدة</Text>
                </TouchableOpacity>
              </View>
            )}

            {!posMsg.startsWith('success:') && (
              <>
                {/* Error */}
                {posMsg.startsWith('error:') && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{posMsg.replace('error:', '')}</Text>
                  </View>
                )}

                {/* Main mode selection */}
                {posMainMode === null && (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={[s.modeBtn, { borderColor: COLORS.primary }]} onPress={() => setPosMainMode('tamween')}>
                      <Text style={{ fontSize: 36 }}>🏛️</Text>
                      <Text style={[s.modeBtnTitle, { color: COLORS.primary }]}>أفراد التموين</Text>
                      <Text style={[s.muted, { textAlign: 'center', fontSize: 11 }]}>مسجلون في المنظومة</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.modeBtn, { borderColor: '#E65100' }]} onPress={() => setPosMainMode('guest')}>
                      <Text style={{ fontSize: 36 }}>🛒</Text>
                      <Text style={[s.modeBtnTitle, { color: '#E65100' }]}>غير المسجلين</Text>
                      <Text style={[s.muted, { textAlign: 'center', fontSize: 11 }]}>دفع مباشر</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Tamween mode */}
                {posMainMode === 'tamween' && (
                  <>
                    <TouchableOpacity style={s.backRowBtn} onPress={resetPos}>
                      <Text style={s.backRowText}>← رجوع للقائمة</Text>
                    </TouchableOpacity>

                    {/* Sub-method tabs */}
                    <View style={s.methodBar}>
                      {[['otp', '📱 OTP'], ['card', '💳 بطاقة'], ['qr', '📷 QR']].map(([m, label]) => (
                        <TouchableOpacity key={m} style={[s.methodTab, posMethod === m && s.methodTabActive]} onPress={() => switchMethod(m)}>
                          <Text style={[s.methodTabText, posMethod === m && s.methodTabTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* OTP method – before user */}
                    {posMethod === 'otp' && !posUser && (
                      !otpSent ? (
                        <View style={s.section}>
                          <Text style={s.label}>الرقم القومي للعميل</Text>
                          <TextInput style={s.input} value={nationalId} onChangeText={setNationalId}
                            placeholder="29901011234567" maxLength={14} keyboardType="numeric" textAlign="right" />
                          {otpError ? <Text style={s.errText}>{otpError}</Text> : null}
                          <TouchableOpacity style={s.btn} onPress={sendOtp} disabled={otpLoading}>
                            {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>إرسال OTP للعميل</Text>}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={s.section}>
                          <View style={s.infoBadge}><Text style={s.infoBadgeText}>✉️ تم إرسال OTP للعميل — اطلب منه الرمز</Text></View>
                          <Text style={[s.label, { marginTop: 12 }]}>أدخل رمز OTP</Text>
                          <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 'bold' }]}
                            value={otpValue} onChangeText={setOtpValue} placeholder="123456"
                            maxLength={6} keyboardType="numeric" />
                          {otpError ? <Text style={[s.errText, { color: otpError.includes('✓') ? COLORS.primary : COLORS.danger }]}>{otpError}</Text> : null}
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity style={s.outlineBtn} onPress={() => { setOtpSent(false); setOtpValue(''); setOtpError('') }}>
                              <Text style={s.outlineBtnText}>إعادة الإرسال</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={verifyOtp} disabled={otpLoading}>
                              {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تحقق</Text>}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )
                    )}

                    {/* Card method – before user */}
                    {posMethod === 'card' && !posUser && (
                      !cardInserted ? (
                        <View style={[s.section, { alignItems: 'center' }]}>
                          <View style={s.cardGraphic}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ color: '#fff', fontSize: 10, opacity: 0.8 }}>بطاقة التموين</Text>
                              <Text>📡</Text>
                            </View>
                            <View style={{ width: 36, height: 26, backgroundColor: '#fdd835', borderRadius: 4, marginVertical: 8 }} />
                            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.7, letterSpacing: 3 }}>**** **** ****</Text>
                          </View>
                          <Text style={[s.muted, { marginBottom: 12 }]}>أدخل البطاقة في الجهاز</Text>
                          <TouchableOpacity style={s.btn} onPress={() => setCardInserted(true)}>
                            <Text style={s.btnText}>✓ تم إدخال البطاقة</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={s.section}>
                          <View style={[s.infoBadge, { marginBottom: 12 }]}><Text style={s.infoBadgeText}>✅ تمت قراءة الشريحة — أدخل الرمز السري</Text></View>
                          <Text style={s.label}>الرمز السري</Text>
                          <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                            value={cardPin} onChangeText={setCardPin} placeholder="••••" maxLength={4} secureTextEntry keyboardType="numeric" />
                          {cardError ? <Text style={s.errText}>{cardError}</Text> : null}
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity style={s.outlineBtn} onPress={() => { setCardInserted(false); setCardPin(''); setCardError('') }}>
                              <Text style={s.outlineBtnText}>إلغاء</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={verifyCardPin} disabled={cardLoading}>
                              {cardLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تأكيد</Text>}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )
                    )}

                    {/* QR method – show QR, wait for citizen scan */}
                    {posMethod === 'qr' && !posUser && (
                      <View style={[s.section, { alignItems: 'center' }]}>
                        <View style={s.qrBox}>
                          {user?.outletId ? (
                            <QRCode value={qrValue} size={200} color="#166534" backgroundColor="#ffffff" />
                          ) : (
                            <ActivityIndicator color={COLORS.primary} />
                          )}
                        </View>
                        <Text style={[s.invName, { marginTop: 8 }]}>{profile?.name}</Text>
                        <Text style={s.muted}>{profile?.address}</Text>
                        <View style={[s.waitBadge, { marginTop: 12 }]}>
                          <Text style={s.waitText}>⏳ في انتظار مسح العميل للرمز...</Text>
                          <Text style={[s.muted, { textAlign: 'center', fontSize: 11, marginTop: 4 }]}>
                            بمجرد المسح ستظهر بيانات العميل تلقائياً
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Payment mode selection – after posUser known */}
                    {posUser && !posPaymentMode && (
                      <View style={s.section}>
                        <View style={s.userCard}>
                          <Text style={s.invName}>{posUser.name}</Text>
                          <Text style={s.muted}>بطاقة: {posUser.tamweenCardId}</Text>
                          <View style={[s.row, { marginTop: 8 }]}>
                            <Text style={s.muted}>الرصيد المتبقي</Text>
                            <Text style={[s.invQty, { color: COLORS.primary }]}>{posUser.remainingCredit?.toFixed(2)} جنيه</Text>
                          </View>
                        </View>
                        <Text style={[s.label, { textAlign: 'center', marginVertical: 8 }]}>اختر طريقة الدفع</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity style={[s.modeBtn, { borderColor: COLORS.primary, flex: 1 }]} onPress={() => setPosPaymentMode('balance')}>
                            <Text style={{ fontSize: 28 }}>💰</Text>
                            <Text style={[s.modeBtnTitle, { color: COLORS.primary }]}>بالرصيد</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.modeBtn, { borderColor: '#1565C0', flex: 1 }]} onPress={() => setPosPaymentMode('no-balance')}>
                            <Text style={{ fontSize: 28 }}>💳</Text>
                            <Text style={[s.modeBtnTitle, { color: '#1565C0' }]}>بدون رصيد</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={[s.outlineBtn, { marginTop: 10 }]} onPress={resetPos}>
                          <Text style={s.outlineBtnText}>إلغاء</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Cart + bank card + confirm OTP */}
                    {posUser && posPaymentMode && (
                      <View style={s.section}>
                        {/* User info */}
                        <View style={s.userCard}>
                          <Text style={s.invName}>{posUser.name}</Text>
                          <View style={[s.row, { marginTop: 4 }]}>
                            <Text style={s.muted}>الرصيد المتبقي</Text>
                            <Text style={[s.invQty, { color: COLORS.primary }]}>{posUser.remainingCredit?.toFixed(2)} جنيه</Text>
                          </View>
                          <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center', gap: 8 }}>
                            <View style={[s.chip, { backgroundColor: posPaymentMode === 'balance' ? '#E8F5E9' : '#E3F2FD' }]}>
                              <Text style={{ color: posPaymentMode === 'balance' ? COLORS.primary : '#1565C0', fontSize: 12 }}>
                                {posPaymentMode === 'balance' ? '💰 دفع بالرصيد' : '💳 بدون رصيد'}
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => { setPosPaymentMode(null); setPosCardInserted(false); setPosCardPin(''); setPosCardPaid(false) }}>
                              <Text style={[s.muted, { textDecorationLine: 'underline' }]}>تغيير</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Cart */}
                        <Text style={[s.label, { marginTop: 12 }]}>اختر المنتجات:</Text>
                        {posCart.map((item, i) => (
                          <View key={item.productId} style={s.cartRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.invName}>{item.name}</Text>
                              <Text style={s.muted}>{item.price} جنيه / {item.unit}</Text>
                            </View>
                            <View style={s.counter}>
                              <TouchableOpacity style={s.counterBtn} onPress={() => adjustPosCart(i, -1)}><Text style={s.counterBtnText}>-</Text></TouchableOpacity>
                              <Text style={s.counterVal}>{item.qty}</Text>
                              <TouchableOpacity style={[s.counterBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]} onPress={() => adjustPosCart(i, 1)}>
                                <Text style={[s.counterBtnText, { color: '#fff' }]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}

                        {/* Totals */}
                        <View style={s.totalsBox}>
                          <View style={s.row}>
                            <Text style={s.muted}>الإجمالي</Text>
                            <Text style={[s.invQty, { color: COLORS.primary }]}>{cartTotal.toFixed(2)} جنيه</Text>
                          </View>
                          {posPaymentMode === 'balance' && shortfall > 0 && (
                            <>
                              <View style={[s.row, { marginTop: 4 }]}>
                                <Text style={[s.muted, { color: COLORS.primary }]}>من رصيد التموين</Text>
                                <Text style={[s.muted, { color: COLORS.primary }]}>{(posUser?.remainingCredit || 0).toFixed(2)} جنيه</Text>
                              </View>
                              <View style={[s.row, { marginTop: 4 }]}>
                                <Text style={[s.muted, { color: '#E65100' }]}>الفرق المطلوب</Text>
                                <Text style={[s.invQty, { color: '#E65100', fontSize: 16 }]}>{shortfall.toFixed(2)} جنيه</Text>
                              </View>
                            </>
                          )}
                        </View>

                        {/* Bank card widget for no-balance or shortfall */}
                        {((posPaymentMode === 'no-balance') || (posPaymentMode === 'balance' && shortfall > 0)) && !posCardPaid && (
                          <View style={s.bankCardBox}>
                            <Text style={s.bankCardTitle}>
                              {posPaymentMode === 'no-balance' ? '💳 دفع بالبطاقة البنكية (اختياري)' : `⚠️ الفرق ${shortfall.toFixed(2)} جنيه — دفع ببطاقة`}
                            </Text>
                            {!posCardInserted ? (
                              <>
                                <View style={[s.cardGraphic, { backgroundColor: '#1565C0', marginVertical: 10, alignSelf: 'center' }]}>
                                  <Text style={{ color: '#fff', fontSize: 10, opacity: 0.8 }}>بطاقة بنكية 📡</Text>
                                  <View style={{ width: 32, height: 22, backgroundColor: '#fdd835', borderRadius: 3, marginVertical: 6 }} />
                                  <Text style={{ color: '#fff', fontSize: 10, opacity: 0.7, letterSpacing: 3 }}>**** **** ****</Text>
                                </View>
                                <TouchableOpacity style={[s.btn, { backgroundColor: '#1565C0' }]} onPress={() => setPosCardInserted(true)}>
                                  <Text style={s.btnText}>إدخال البطاقة البنكية</Text>
                                </TouchableOpacity>
                                {posPaymentMode === 'no-balance' && (
                                  <TouchableOpacity style={{ marginTop: 8, alignItems: 'center' }}>
                                    <Text style={[s.muted, { textDecorationLine: 'underline' }]}>تخطي — سيتم الدفع كاش</Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            ) : (
                              <>
                                <View style={[s.infoBadge, { backgroundColor: '#E3F2FD', marginVertical: 8 }]}>
                                  <Text style={[s.infoBadgeText, { color: '#1565C0' }]}>✅ تمت قراءة البطاقة — أدخل الرمز السري</Text>
                                </View>
                                <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                                  value={posCardPin} onChangeText={setPosCardPin}
                                  placeholder="••••••" maxLength={6} secureTextEntry keyboardType="numeric" />
                                {posCardError ? <Text style={s.errText}>{posCardError}</Text> : null}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                  <TouchableOpacity style={s.outlineBtn} onPress={() => { setPosCardInserted(false); setPosCardPin(''); setPosCardError('') }}>
                                    <Text style={s.outlineBtnText}>إلغاء</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#1565C0' }]}
                                    disabled={posCardLoading}
                                    onPress={async () => {
                                      if (posCardPin !== '000000') { setPosCardError('رمز البطاقة غير صحيح'); return }
                                      setPosCardLoading(true)
                                      await new Promise(r => setTimeout(r, 1200))
                                      setPosCardPaid(true); setPosCardLoading(false)
                                    }}>
                                    {posCardLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تأكيد الدفع</Text>}
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}
                          </View>
                        )}

                        {posCardPaid && (
                          <View style={[s.infoBadge, { backgroundColor: '#E3F2FD', marginVertical: 8 }]}>
                            <Text style={[s.infoBadgeText, { color: '#1565C0' }]}>✅ تمت الموافقة على البطاقة البنكية</Text>
                          </View>
                        )}

                        {/* Confirm OTP for otp/qr methods */}
                        {(posMethod === 'otp' || posMethod === 'qr') && readyItems.length > 0 && (
                          <View style={[s.section, { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 12, paddingTop: 12 }]}>
                            {!confirmOtpSent ? (
                              <>
                                {confirmOtpError ? <Text style={s.errText}>{confirmOtpError}</Text> : null}
                                <TouchableOpacity style={[s.btn, { backgroundColor: '#1565C0' }]} onPress={sendConfirmOtp} disabled={confirmOtpLoading}>
                                  {confirmOtpLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>📨 إرسال رمز تأكيد الشراء</Text>}
                                </TouchableOpacity>
                                <Text style={[s.muted, { textAlign: 'center', marginTop: 6, fontSize: 11 }]}>سيصل للعميل رسالة بتفاصيل الفاتورة ورمز التأكيد</Text>
                              </>
                            ) : (
                              <>
                                <View style={[s.infoBadge, { marginBottom: 10 }]}>
                                  <Text style={s.infoBadgeText}>✉️ تم إرسال رمز تأكيد الشراء للعميل</Text>
                                </View>
                                <Text style={s.label}>رمز تأكيد الشراء</Text>
                                <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 'bold', borderColor: '#1565C0' }]}
                                  value={confirmOtp} onChangeText={setConfirmOtp}
                                  placeholder="رمز التأكيد" maxLength={6} keyboardType="numeric" />
                                {confirmOtpError ? <Text style={s.errText}>{confirmOtpError}</Text> : null}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                  <TouchableOpacity style={s.outlineBtn} onPress={() => { setConfirmOtpSent(false); setConfirmOtp(''); setConfirmOtpError('') }}>
                                    <Text style={s.outlineBtnText}>إعادة الإرسال</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={recordSale} disabled={posLoading || !confirmOtp.trim()}>
                                    {posLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>✅ تأكيد وإتمام البيع</Text>}
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}
                          </View>
                        )}

                        {/* Card method: direct submit */}
                        {posMethod === 'card' && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            <TouchableOpacity style={s.outlineBtn} onPress={resetPos}>
                              <Text style={s.outlineBtnText}>إلغاء</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={recordSale} disabled={posLoading}>
                              {posLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تسجيل عملية البيع</Text>}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                {/* Guest mode */}
                {posMainMode === 'guest' && (
                  <View style={s.section}>
                    <TouchableOpacity style={s.backRowBtn} onPress={resetPos}>
                      <Text style={s.backRowText}>← رجوع للقائمة</Text>
                    </TouchableOpacity>
                    <View style={[s.infoBadge, { backgroundColor: '#FFF3E0', marginBottom: 12 }]}>
                      <Text style={[s.infoBadgeText, { color: '#E65100' }]}>🛒 بيع لغير المسجلين — بدون خصم رصيد</Text>
                    </View>

                    {/* Bank card (optional) */}
                    {!posCardPaid ? (
                      <View style={s.bankCardBox}>
                        <Text style={s.bankCardTitle}>💳 دفع بالبطاقة البنكية (اختياري)</Text>
                        {!posCardInserted ? (
                          <>
                            <TouchableOpacity style={[s.btn, { backgroundColor: '#1565C0', marginTop: 8 }]} onPress={() => setPosCardInserted(true)}>
                              <Text style={s.btnText}>إدخال البطاقة البنكية</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ marginTop: 8, alignItems: 'center' }}>
                              <Text style={[s.muted, { textDecorationLine: 'underline' }]}>تخطي — سيتم الدفع كاش</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8, marginTop: 8 }]}
                              value={posCardPin} onChangeText={setPosCardPin}
                              placeholder="••••••" maxLength={6} secureTextEntry keyboardType="numeric" />
                            {posCardError ? <Text style={s.errText}>{posCardError}</Text> : null}
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                              <TouchableOpacity style={s.outlineBtn} onPress={() => { setPosCardInserted(false); setPosCardPin(''); setPosCardError('') }}>
                                <Text style={s.outlineBtnText}>إلغاء</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#1565C0' }]}
                                disabled={posCardLoading}
                                onPress={async () => {
                                  if (posCardPin !== '000000') { setPosCardError('رمز البطاقة غير صحيح'); return }
                                  setPosCardLoading(true)
                                  await new Promise(r => setTimeout(r, 1200))
                                  setPosCardPaid(true); setPosCardLoading(false)
                                }}>
                                {posCardLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تأكيد</Text>}
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    ) : (
                      <View style={[s.infoBadge, { backgroundColor: '#E3F2FD', marginBottom: 12 }]}>
                        <Text style={[s.infoBadgeText, { color: '#1565C0' }]}>✅ سيتم الدفع ببطاقة بنكية</Text>
                      </View>
                    )}

                    {/* Cart */}
                    <Text style={[s.label, { marginTop: 8 }]}>اختر المنتجات:</Text>
                    {posCart.map((item, i) => (
                      <View key={item.productId} style={s.cartRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.invName}>{item.name}</Text>
                          <Text style={s.muted}>{item.price} جنيه / {item.unit}</Text>
                        </View>
                        <View style={s.counter}>
                          <TouchableOpacity style={s.counterBtn} onPress={() => adjustPosCart(i, -1)}><Text style={s.counterBtnText}>-</Text></TouchableOpacity>
                          <Text style={s.counterVal}>{item.qty}</Text>
                          <TouchableOpacity style={[s.counterBtn, { backgroundColor: '#E65100', borderColor: '#E65100' }]} onPress={() => adjustPosCart(i, 1)}>
                            <Text style={[s.counterBtnText, { color: '#fff' }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    <View style={s.totalsBox}>
                      <View style={s.row}>
                        <Text style={s.muted}>الإجمالي</Text>
                        <Text style={[s.invQty, { color: '#E65100' }]}>{cartTotal.toFixed(2)} جنيه</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={[s.btn, { backgroundColor: '#E65100', marginTop: 12 }]} onPress={recordSale} disabled={posLoading}>
                      {posLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تسجيل عملية البيع</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── DELIVERIES ──────────────────────────────────────────── */}
        {tab === 'deliveries' && (
          <>
            {deliveries.length === 0 && (
              <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 32 }]}>لا توجد طلبات توصيل</Text></View>
            )}

            {activeDeliveries.length > 0 && (
              <>
                <Text style={s.sectionLabel}>الطلبات النشطة</Text>
                {activeDeliveries.map(order => {
                  const sc      = STATUS_COLOR[order.status] || STATUS_COLOR.PENDING
                  const isOpen  = expandedDelivery === order.id
                  const card    = cardState[order.id] || {}
                  const hasExtra = order.extraPayment > 0

                  return (
                    <View key={order.id} style={[s.card, { padding: 0, overflow: 'hidden' }]}>
                      <TouchableOpacity style={s.deliveryHeader} onPress={() => setExpandedDelivery(isOpen ? null : order.id)}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.invName}>{order.user?.name}</Text>
                          <Text style={[s.muted, { marginTop: 2 }]}>{order.itemCount} منتجات · {order.totalAmount} جنيه</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                            <Text style={[s.statusText, { color: sc.text }]}>{STATUS_LABEL[order.status]}</Text>
                          </View>
                          <Text style={[s.muted, { fontSize: 11 }]}>{isOpen ? '▲' : '▼'}</Text>
                        </View>
                      </TouchableOpacity>

                      {isOpen && (
                        <View style={s.deliveryBody}>
                          <Text style={s.sectionLabel}>تفاصيل الطلب</Text>
                          <View style={[s.row, { marginBottom: 4 }]}>
                            <Text style={s.muted}>العنوان</Text>
                            <Text style={[s.val, { flex: 1, textAlign: 'left', marginRight: 8 }]} numberOfLines={2}>{order.address}</Text>
                          </View>
                          {order.items?.map((item, i) => (
                            <View key={i} style={[s.row, { paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                              <Text style={s.muted}>{item.product}</Text>
                              <Text style={s.muted}>{item.quantity} {item.unit} × {item.unitPrice} جنيه</Text>
                            </View>
                          ))}
                          <View style={s.totalsBox}>
                            <View style={s.row}>
                              <Text style={[s.muted, { fontWeight: '600' }]}>الإجمالي</Text>
                              <Text style={[s.val, { fontWeight: 'bold', color: COLORS.primary }]}>{order.totalAmount} جنيه</Text>
                            </View>
                            {hasExtra && (
                              <View style={[s.row, { marginTop: 4 }]}>
                                <Text style={[s.muted, { color: '#E65100' }]}>مبلغ إضافي</Text>
                                <Text style={[s.val, { fontWeight: 'bold', color: '#E65100' }]}>{order.extraPayment?.toFixed(2)} جنيه</Text>
                              </View>
                            )}
                          </View>

                          {/* Status actions */}
                          <Text style={[s.sectionLabel, { marginTop: 12 }]}>تحديث الحالة</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            {order.status === 'PENDING' && (
                              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#1565C0' }]}
                                onPress={() => updateStatus(order.id, 'CONFIRMED')} disabled={statusLoading[order.id]}>
                                {statusLoading[order.id] ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionBtnText}>تأكيد الطلب</Text>}
                              </TouchableOpacity>
                            )}
                            {order.status === 'CONFIRMED' && (
                              <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.primary }]}
                                onPress={() => updateStatus(order.id, 'OUT_FOR_DELIVERY')} disabled={statusLoading[order.id]}>
                                {statusLoading[order.id] ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionBtnText}>🚚 خرج للتوصيل (إرسال OTP)</Text>}
                              </TouchableOpacity>
                            )}
                            {order.status !== 'PENDING' && (
                              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#616161', flex: 0, paddingHorizontal: 12 }]}
                                onPress={() => updateStatus(order.id, 'OUT_FOR_DELIVERY')} disabled={statusLoading[order.id]}>
                                <Text style={s.actionBtnText}>إعادة OTP</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* OTP Confirm */}
                          {order.status === 'OUT_FOR_DELIVERY' && (
                            <View style={s.otpBox}>
                              <Text style={s.sectionLabel}>تأكيد التسليم بالـ OTP</Text>

                              {/* Bank card for extra payment */}
                              {hasExtra && (
                                <View style={s.bankCardBox}>
                                  <Text style={[s.muted, { textAlign: 'center', color: '#E65100', fontWeight: '600', marginBottom: 8 }]}>
                                    مطلوب دفع {order.extraPayment?.toFixed(2)} جنيه إضافي
                                  </Text>
                                  {!card.inserted ? (
                                    <TouchableOpacity style={[s.btn, { backgroundColor: '#1565C0' }]} onPress={() => setCardField(order.id, 'inserted', true)}>
                                      <Text style={s.btnText}>💳 إدخال البطاقة البنكية</Text>
                                    </TouchableOpacity>
                                  ) : !card.paid ? (
                                    <>
                                      <View style={[s.infoBadge, { backgroundColor: '#E3F2FD', marginVertical: 8 }]}>
                                        <Text style={[s.infoBadgeText, { color: '#1565C0' }]}>💳 تم إدخال الكارت</Text>
                                      </View>
                                      <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                                        value={card.pin || ''}
                                        onChangeText={v => setCardField(order.id, 'pin', v)}
                                        placeholder="000000" keyboardType="numeric" secureTextEntry maxLength={6} />
                                      <TouchableOpacity style={[s.btn, { backgroundColor: '#2E7D32', marginTop: 8 }]}
                                        onPress={() => {
                                          if ((card.pin || '') === '000000') setCardField(order.id, 'paid', true)
                                          else Alert.alert('خطأ', 'رقم سري غير صحيح')
                                        }}>
                                        <Text style={s.btnText}>تأكيد الدفع</Text>
                                      </TouchableOpacity>
                                    </>
                                  ) : (
                                    <View style={s.successBox}>
                                      <Text style={s.successText}>✅ تم الدفع بالبطاقة البنكية</Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              <Text style={[s.label, { marginTop: hasExtra ? 10 : 0 }]}>رمز OTP</Text>
                              <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                                value={otpInputs[order.id] || ''}
                                onChangeText={v => setOtpInputs(prev => ({ ...prev, [order.id]: v }))}
                                placeholder="أدخل الرمز" keyboardType="numeric" maxLength={6} />
                              <TouchableOpacity style={[s.btn, { marginTop: 8, backgroundColor: '#2E7D32' }]}
                                onPress={() => confirmDelivery(order)} disabled={confirmLoading[order.id]}>
                                {confirmLoading[order.id] ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تأكيد التسليم</Text>}
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })}
              </>
            )}

            {doneDeliveries.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 4 }]}>المُسلَّمة</Text>
                <View style={s.card}>
                  {doneDeliveries.map(order => (
                    <View key={order.id} style={[s.row, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.invName}>{order.user?.name}</Text>
                        <Text style={s.muted}>{order.totalAmount} جنيه · {new Date(order.createdAt).toLocaleDateString('ar-EG')}</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[order.status]?.bg }]}>
                        <Text style={[s.statusText, { color: STATUS_COLOR[order.status]?.text }]}>{STATUS_LABEL[order.status]}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── SALES ───────────────────────────────────────────────── */}
        {tab === 'sales' && (
          sales.length === 0
            ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 32 }]}>لا توجد مبيعات بعد</Text></View>
            : sales.map(sale => (
              <View key={sale.id} style={s.card}>
                <View style={s.row}>
                  <View style={[s.chip, { backgroundColor: sale.type === 'DELIVERY' ? '#E3F2FD' : '#F5F5F5' }]}>
                    <Text style={{ fontSize: 12, color: sale.type === 'DELIVERY' ? '#1565C0' : '#616161' }}>
                      {sale.type === 'DELIVERY' ? '🚚 توصيل' : '🏪 حضوري'}
                    </Text>
                  </View>
                  <Text style={[s.invQty, { color: COLORS.primary }]}>{sale.totalAmount} جنيه</Text>
                </View>
                {sale.user
                  ? <Text style={s.invName}>{sale.user.name} ({sale.user.tamweenCardId})</Text>
                  : <Text style={[s.invName, { color: COLORS.muted }]}>غير مسجل</Text>
                }
                {(() => {
                  const METHOD = { BALANCE: 'رصيد', CASH: 'كاش', CARD: 'بطاقة بنكية' }
                  const extra = sale.extraPaymentMethod && sale.extraAmount > 0
                  const label = extra
                    ? `${METHOD[sale.paymentMethod] || sale.paymentMethod} + ${sale.extraAmount} جنيه ${METHOD[sale.extraPaymentMethod] || sale.extraPaymentMethod}`
                    : METHOD[sale.paymentMethod] || sale.paymentMethod
                  return sale.paymentMethod ? (
                    <View style={[s.chip, { backgroundColor: '#E8F5E9', marginTop: 4, alignSelf: 'flex-start' }]}>
                      <Text style={{ color: COLORS.primary, fontSize: 11 }}>{label}</Text>
                    </View>
                  ) : null
                })()}
                <Text style={s.muted}>{new Date(sale.createdAt).toLocaleDateString('ar-EG')}</Text>
              </View>
            ))
        )}

        {/* ── MESSAGES ────────────────────────────────────────────── */}
        {tab === 'messages' && (
          <>
            <View style={[s.row, { marginBottom: 8 }]}>
              <Text style={s.cardTitle}>رسائل الوزارة</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {messages.some(m => !m.isRead) && (
                  <TouchableOpacity onPress={() => {
                    const unread = messages.filter(m => !m.isRead)
                    Promise.all(unread.map(m => api.patch(`/outlet/messages/${m.id}/read`))).then(() =>
                      setMessages(prev => prev.map(m => ({ ...m, isRead: true })))
                    ).catch(() => {})
                  }}>
                    <Text style={[s.muted, { color: COLORS.primary, textDecorationLine: 'underline' }]}>تحديد الكل كمقروءة</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => api.get('/outlet/messages').then(r => setMessages(r.data)).catch(() => {})}>
                  <Text style={[s.muted, { textDecorationLine: 'underline' }]}>تحديث</Text>
                </TouchableOpacity>
              </View>
            </View>
            {messages.length === 0
              ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 32 }]}>لا توجد رسائل</Text></View>
              : messages.map(msg => (
                <View key={msg.id} style={[s.card, { borderRightWidth: 4, borderRightColor: msg.isRead ? COLORS.border : COLORS.primary }]}>
                  <View style={s.row}>
                    <View style={[s.chip, { backgroundColor: msg.isRead ? '#F5F5F5' : '#E8F5E9' }]}>
                      <Text style={{ color: msg.isRead ? COLORS.muted : COLORS.primary, fontSize: 11 }}>
                        {msg.isRead ? 'مقروءة' : '● جديدة'}
                      </Text>
                    </View>
                    <Text style={[s.muted, { fontSize: 11 }]}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</Text>
                  </View>
                  <Text style={[s.val, { marginTop: 8, lineHeight: 20 }]}>{msg.content}</Text>
                  {!msg.isRead && (
                    <TouchableOpacity onPress={() => markRead(msg.id)} style={{ marginTop: 8 }}>
                      <Text style={[s.muted, { color: COLORS.primary, fontSize: 12, textDecorationLine: 'underline' }]}>تحديد كمقروءة</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            }
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: COLORS.bg },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:       { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  headerSub:         { color: '#A5D6A7', fontSize: 12, marginTop: 2 },
  logoutBtn:         { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  logoutText:        { color: '#fff', fontSize: 13 },
  notifBanner:       { backgroundColor: '#FFF8E1', padding: 8, borderBottomWidth: 1, borderBottomColor: '#FFE082', paddingHorizontal: 14 },
  notifText:         { color: '#E65100', fontSize: 12 },
  alertBanner:       { backgroundColor: '#FFF3E0', padding: 8, borderBottomWidth: 1, borderBottomColor: '#FFE0B2' },
  alertText:         { color: COLORS.warning, fontWeight: '600', textAlign: 'center', fontSize: 12 },
  deliveryBanner:    { backgroundColor: '#E8F5E9', padding: 8, borderBottomWidth: 1, borderBottomColor: '#C8E6C9' },
  deliveryBannerText:{ color: COLORS.primary, textAlign: 'center', fontWeight: '600', fontSize: 12 },
  tabBar:            { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:               { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:         { borderBottomColor: COLORS.primary },
  tabText:           { fontSize: 11, color: COLORS.muted },
  tabTextActive:     { color: COLORS.primary, fontWeight: '700' },
  content:           { flex: 1 },
  card:              { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  cardTitle:         { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 14, textAlign: 'right' },
  invRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 4 },
  invName:           { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  invQty:            { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  muted:             { fontSize: 12, color: COLORS.muted, textAlign: 'right' },
  val:               { fontSize: 13, color: COLORS.text },
  lowBadge:          { fontSize: 10, color: COLORS.danger, backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2 },
  row:               { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:             { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8, textAlign: 'right' },
  input:             { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#FAFAFA', marginBottom: 4 },
  btn:               { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText:           { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  outlineBtn:        { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  outlineBtnText:    { color: COLORS.muted, fontWeight: '600', fontSize: 14 },
  infoBadge:         { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10 },
  infoBadgeText:     { color: COLORS.primary, fontWeight: '600', textAlign: 'center', fontSize: 13 },
  successBox:        { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16 },
  successText:       { color: COLORS.primary, fontWeight: '600', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  errorBox:          { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10, marginBottom: 8 },
  errText:           { color: COLORS.danger, fontSize: 12, textAlign: 'center', marginTop: 4 },
  errorText:         { color: COLORS.danger, fontWeight: '600', textAlign: 'center', fontSize: 13 },
  modeBtn:           { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 16, borderWidth: 2, backgroundColor: '#fff', gap: 6 },
  modeBtnTitle:      { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  section:           { marginTop: 12 },
  methodBar:         { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 4, marginBottom: 12 },
  methodTab:         { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  methodTabActive:   { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  methodTabText:     { fontSize: 11, color: COLORS.muted },
  methodTabTextActive: { color: COLORS.primary, fontWeight: '700' },
  backRowBtn:        { backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12, alignSelf: 'flex-start' },
  backRowText:       { color: COLORS.muted, fontWeight: '600', fontSize: 13 },
  userCard:          { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardGraphic:       { width: 160, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  qrBox:             { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 3, borderColor: COLORS.primary, marginBottom: 8 },
  waitBadge:         { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, width: '100%' },
  waitText:          { color: '#E65100', fontWeight: 'bold', textAlign: 'center' },
  cartRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  counter:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn:        { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnText:    { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  counterVal:        { width: 28, textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  totalsBox:         { backgroundColor: '#F9FBF9', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 8 },
  bankCardBox:       { backgroundColor: '#F5F9FF', borderWidth: 1.5, borderColor: '#BBDEFB', borderRadius: 14, padding: 14, marginVertical: 8 },
  bankCardTitle:     { fontWeight: 'bold', color: '#1565C0', textAlign: 'center', fontSize: 13, marginBottom: 4 },
  chip:              { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  deliveryHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  deliveryBody:      { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, backgroundColor: '#FAFAFA' },
  sectionLabel:      { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 8, textAlign: 'right' },
  statusBadge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:        { fontSize: 11, fontWeight: '700' },
  actionBtn:         { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  actionBtnText:     { color: '#fff', fontWeight: '700', fontSize: 12 },
  otpBox:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: COLORS.border, marginTop: 10 },
})
