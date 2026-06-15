import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { COLORS } from '../config'

const TABS = [
  { id: 'balance',         label: 'رصيدي'         },
  { id: 'outlets',         label: 'المنافذ'        },
  { id: 'delivery',        label: 'توصيل'          },
  { id: 'delivery-status', label: 'طلباتي'         },
  { id: 'qr',              label: '📷 QR'          },
  { id: 'history',         label: 'مشترياتي'       },
  { id: 'messages',        label: 'رسائلي'         },
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

export default function UserDashboard({ navigation }) {
  const { user, logout } = useAuth()
  const [tab, setTab]                       = useState('balance')
  const [profile, setProfile]               = useState(null)
  const [outlets, setOutlets]               = useState([])
  const [purchases, setPurchases]           = useState([])
  const [deliveryOrders, setDeliveryOrders] = useState([])
  const [messages, setMessages]             = useState([])
  const [selOutlet, setSelOutlet]           = useState(null)
  const [cart, setCart]                     = useState([])
  const [address, setAddress]               = useState('')
  const [sending, setSending]               = useState(false)
  const [orderDone, setOrderDone]           = useState(false)
  const [expandedOrder, setExpandedOrder]   = useState(null)
  const [refreshing, setRefreshing]         = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [prof, outs, purch, dels, msgs] = await Promise.allSettled([
        api.get('/user/profile'),
        api.get('/user/outlets'),
        api.get('/user/purchases'),
        api.get('/user/deliveries'),
        api.get('/user/messages'),
      ])
      if (prof.status  === 'fulfilled') setProfile(prof.value.data)
      if (outs.status  === 'fulfilled') setOutlets(outs.value.data)
      if (purch.status === 'fulfilled') setPurchases(purch.value.data)
      if (dels.status  === 'fulfilled') setDeliveryOrders(dels.value.data)
      if (msgs.status  === 'fulfilled') setMessages(msgs.value.data || [])
    } catch {}
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (tab === 'balance')         api.get('/user/profile').then(r => setProfile(r.data)).catch(() => {})
    if (tab === 'history')         api.get('/user/purchases').then(r => setPurchases(r.data)).catch(() => {})
    if (tab === 'messages')        api.get('/user/messages').then(r => setMessages(r.data || [])).catch(() => {})
    if (tab === 'delivery-status') api.get('/user/deliveries').then(r => setDeliveryOrders(r.data)).catch(() => {})
  }, [tab])

  async function onRefresh() { setRefreshing(true); await loadAll(); setRefreshing(false) }

  function handleLogout() { logout(); navigation.replace('Login') }

  function pickOutlet(outlet) {
    setSelOutlet(outlet)
    setCart((outlet.products || []).map(p => ({ productId: p.id, name: p.name, unit: p.unit, price: p.pricePerUnit, qty: 0 })))
    setOrderDone(false)
    setTab('delivery')
  }

  async function submitDelivery() {
    const items = cart.filter(i => i.qty > 0)
    if (!items.length) return Alert.alert('تنبيه', 'اختر منتجاً واحداً على الأقل')
    if (!address.trim()) return Alert.alert('تنبيه', 'أدخل عنوان التوصيل')
    setSending(true)
    try {
      await api.post('/user/order-delivery', {
        outletId: selOutlet.id, address,
        items: items.map(i => ({ productId: i.productId, quantity: i.qty })),
      })
      setOrderDone(true)
      loadAll()
    } catch (err) {
      Alert.alert('خطأ', err.response?.data?.error || 'حدث خطأ')
    }
    setSending(false)
  }

  function adjustCart(i, delta) {
    setCart(prev => { const u = [...prev]; u[i] = { ...u[i], qty: Math.max(0, u[i].qty + delta) }; return u })
  }

  async function markMessageRead(id) {
    try {
      await api.patch(`/user/messages/${id}/read`)
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m))
    } catch {}
  }

  const remaining = profile ? profile.remainingCredit : 0
  const pct       = profile ? Math.min(100, (profile.usedCredit / profile.monthlyCredit) * 100) : 0

  const activeDeliveries = deliveryOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
  const unreadMessages   = messages.filter(m => !m.isRead).length

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>منظومة التموين</Text>
          <Text style={s.headerSub}>مرحباً، {profile?.name || user?.name}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* Active delivery banner */}
      {activeDeliveries.length > 0 && (
        <TouchableOpacity style={s.activeBanner} onPress={() => setTab('delivery-status')}>
          <Text style={s.activeBannerText}>
            🚚 لديك {activeDeliveries.length} طلب توصيل نشط — اضغط لمتابعة
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarWrap} contentContainerStyle={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            {t.id === 'messages' && unreadMessages > 0 && (
              <View style={s.badge}><Text style={s.badgeText}>{unreadMessages}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {/* ── BALANCE ────────────────────────────────────────────── */}
        {tab === 'balance' && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>رصيد التموين الشهري</Text>
              <View style={s.row}><Text style={s.muted}>الحد الشهري</Text><Text style={s.val}>{profile?.monthlyCredit ?? '--'} جنيه</Text></View>
              <View style={s.row}><Text style={s.muted}>المستخدم</Text><Text style={[s.val, { color: COLORS.danger }]}>{profile?.usedCredit?.toFixed(2) ?? '--'} جنيه</Text></View>
              <View style={s.row}>
                <Text style={s.muted}>المتبقي</Text>
                <Text style={[s.val, { color: COLORS.primary, fontSize: 20, fontWeight: 'bold' }]}>{remaining.toFixed(2)} جنيه</Text>
              </View>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: pct > 80 ? COLORS.danger : pct > 50 ? COLORS.warning : COLORS.light }]} />
              </View>
              <Text style={[s.muted, { textAlign: 'center', marginTop: 4 }]}>{pct.toFixed(0)}٪ مستخدم</Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>بياناتي</Text>
              {[['الاسم', profile?.name], ['رقم البطاقة', profile?.tamweenCardId], ['الرقم القومي', profile?.nationalId], ['الهاتف', profile?.phone], ['العنوان', profile?.address], ...(profile?.email ? [['البريد الإلكتروني', profile.email]] : [])].map(([label, val]) => (
                <View key={label} style={[s.row, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                  <Text style={s.muted}>{label}</Text>
                  <Text style={s.val}>{val || '---'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── OUTLETS ────────────────────────────────────────────── */}
        {tab === 'outlets' && outlets.map(o => (
          <View key={o.id} style={s.card}>
            <Text style={s.cardTitle}>{o.name}</Text>
            <Text style={s.muted}>{o.address}</Text>
            <Text style={[s.muted, { color: COLORS.light, marginTop: 4 }]}>{o.products?.length ?? 0} منتج متاح</Text>
            <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={() => pickOutlet(o)}>
              <Text style={s.btnText}>اطلب توصيل</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* ── DELIVERY (new order form) ───────────────────────────── */}
        {tab === 'delivery' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>طلب توصيل جديد</Text>
            {!selOutlet ? (
              <>
                <Text style={[s.muted, { textAlign: 'center', marginVertical: 16 }]}>
                  اختر منفذاً من تبويب "المنافذ" أولاً
                </Text>
                <TouchableOpacity style={s.btn} onPress={() => setTab('outlets')}>
                  <Text style={s.btnText}>الذهاب للمنافذ</Text>
                </TouchableOpacity>
              </>
            ) : orderDone ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ fontSize: 48 }}>✅</Text>
                <Text style={[s.cardTitle, { color: COLORS.primary }]}>تم إرسال الطلب!</Text>
                <TouchableOpacity style={[s.btn, { marginTop: 16, width: '100%' }]}
                  onPress={() => { setOrderDone(false); setSelOutlet(null); setTab('delivery-status') }}>
                  <Text style={s.btnText}>متابعة الطلب</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.infoBadge}><Text style={s.infoBadgeText}>{selOutlet.name}</Text></View>

                <Text style={[s.label, { marginTop: 12 }]}>عنوان التوصيل</Text>
                <TextInput style={s.input} value={address} onChangeText={setAddress}
                  placeholder="أدخل عنوانك كاملاً" textAlign="right" />

                <Text style={[s.label, { marginTop: 12 }]}>المنتجات</Text>
                {cart.map((item, i) => (
                  <View key={item.productId} style={s.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.val}>{item.name}</Text>
                      <Text style={s.muted}>{item.price} جنيه / {item.unit}</Text>
                    </View>
                    <View style={s.counter}>
                      <TouchableOpacity style={s.counterBtn} onPress={() => adjustCart(i, -1)}><Text style={s.counterBtnText}>-</Text></TouchableOpacity>
                      <Text style={s.counterVal}>{item.qty}</Text>
                      <TouchableOpacity style={[s.counterBtn, { backgroundColor: COLORS.primary }]} onPress={() => adjustCart(i, 1)}>
                        <Text style={[s.counterBtnText, { color: '#fff' }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={[s.row, { marginTop: 12, backgroundColor: '#F9FBF9', padding: 12, borderRadius: 10 }]}>
                  <Text style={s.muted}>الإجمالي (شامل التوصيل 5 جنيه)</Text>
                  <Text style={[s.val, { color: COLORS.primary, fontWeight: 'bold' }]}>
                    {(cart.reduce((sum, i) => sum + i.price * i.qty, 0) + 5).toFixed(2)} جنيه
                  </Text>
                </View>

                <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={submitDelivery} disabled={sending}>
                  {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تأكيد الطلب</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => setSelOutlet(null)}>
                  <Text style={[s.muted, { color: '#999' }]}>تغيير المنفذ</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── DELIVERY STATUS (tracking) ────────────────────────── */}
        {tab === 'delivery-status' && (
          deliveryOrders.length === 0
            ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 32 }]}>لا توجد طلبات توصيل بعد</Text></View>
            : deliveryOrders.map(order => {
              const sc = STATUS_COLOR[order.status] || STATUS_COLOR.PENDING
              const isExpanded = expandedOrder === order.id
              return (
                <TouchableOpacity key={order.id}
                  style={[s.card, { padding: 0, overflow: 'hidden' }]}
                  onPress={() => setExpandedOrder(isExpanded ? null : order.id)}
                  activeOpacity={0.85}>
                  <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.val, { fontWeight: '700' }]}>{order.outletName}</Text>
                      <Text style={s.muted}>{new Date(order.createdAt).toLocaleDateString('ar-EG')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{STATUS_LABEL[order.status]}</Text>
                      </View>
                      <Text style={[s.muted, { fontSize: 10 }]}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, backgroundColor: '#FAFAFA' }}>
                      <View style={[s.row, { marginBottom: 8 }]}>
                        <Text style={s.muted}>الإجمالي</Text>
                        <Text style={[s.val, { fontWeight: 'bold' }]}>{order.totalAmount} جنيه</Text>
                      </View>
                      <View style={[s.row, { marginBottom: 8 }]}>
                        <Text style={s.muted}>عنوان التوصيل</Text>
                        <Text style={[s.val, { flex: 1, textAlign: 'left' }]} numberOfLines={2}>{order.address}</Text>
                      </View>
                      {order.items?.map((item, i) => (
                        <View key={i} style={[s.row, { paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                          <Text style={s.muted}>{item.product}</Text>
                          <Text style={s.muted}>{item.quantity} {item.unit} × {item.unitPrice} جنيه</Text>
                        </View>
                      ))}
                      {order.status === 'OUT_FOR_DELIVERY' && (
                        <View style={[s.infoBadge, { marginTop: 10 }]}>
                          <Text style={s.infoBadgeText}>🚚 طلبك في الطريق إليك</Text>
                          <Text style={[s.muted, { textAlign: 'center', marginTop: 4 }]}>
                            تحقق من رسائلك للحصول على رمز OTP لتأكيد التسليم
                          </Text>
                        </View>
                      )}
                      {order.status === 'DELIVERED' && (
                        <View style={[s.infoBadge, { backgroundColor: '#F3E5F5', marginTop: 10 }]}>
                          <Text style={[s.infoBadgeText, { color: '#4A148C' }]}>
                            ✅ تم التسليم
                            {order.extraPaymentMethod === 'CARD' ? ' · دُفع بالبطاقة البنكية' : order.extraPaymentMethod === 'CASH' ? ' · دُفع الفرق نقداً' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )
            })
        )}

        {/* ── QR ─────────────────────────────────────────────────── */}
        {tab === 'qr' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>📷 شراء عبر QR Code</Text>
            <TouchableOpacity style={[s.btn, { marginBottom: 20 }]} onPress={() => navigation.navigate('QrScan')}>
              <Text style={s.btnText}>افتح الكاميرا وامسح QR</Text>
            </TouchableOpacity>
            <View style={[s.infoBadge, { backgroundColor: '#F3E5F5' }]}>
              <Text style={[s.infoBadgeText, { color: '#4A148C', fontSize: 14, marginBottom: 10 }]}>كيفية الشراء بالـ QR</Text>
              {[
                'اضغط على "افتح الكاميرا وامسح QR" أعلاه',
                'امسح الـ QR الموجود عند المنفذ',
                'اطلب ما تريده من التاجر وطريقة التحصيل',
                'أعطِ التاجر كلمة السر للمرة الواحدة الموجودة في رسائلك للتأكيد',
              ].map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#4A148C', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{i + 1}</Text>
                  </View>
                  <Text style={[s.muted, { flex: 1, color: '#5c2d91' }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── HISTORY ────────────────────────────────────────────── */}
        {tab === 'history' && (
          purchases.length === 0
            ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 32 }]}>لا توجد مشتريات بعد</Text></View>
            : purchases.map(p => (
              <View key={p.id} style={s.card}>
                <View style={s.row}>
                  <View style={[s.chipBadge, { backgroundColor: p.type === 'DELIVERY' ? '#E3F2FD' : '#F5F5F5' }]}>
                    <Text style={{ color: p.type === 'DELIVERY' ? '#1565C0' : '#616161', fontSize: 12 }}>
                      {p.type === 'DELIVERY' ? '🚚 توصيل' : '🏪 حضوري'}
                    </Text>
                  </View>
                  <Text style={[s.val, { color: COLORS.primary, fontWeight: 'bold' }]}>{p.totalAmount} جنيه</Text>
                </View>
                <Text style={s.val}>{p.outlet?.name}</Text>
                <Text style={s.muted}>{new Date(p.createdAt).toLocaleDateString('ar-EG')}</Text>
                {(() => {
                  const METHOD = { BALANCE: 'رصيد', CASH: 'كاش', CARD: 'بطاقة بنكية' }
                  const extra = p.extraPaymentMethod && p.extraAmount > 0
                  const label = extra
                    ? `${METHOD[p.paymentMethod] || p.paymentMethod} + ${p.extraAmount} جنيه ${METHOD[p.extraPaymentMethod] || p.extraPaymentMethod}`
                    : METHOD[p.paymentMethod] || p.paymentMethod
                  return p.paymentMethod ? (
                    <View style={[s.chipBadge, { backgroundColor: '#E8F5E9', marginTop: 6, alignSelf: 'flex-end' }]}>
                      <Text style={{ color: COLORS.primary, fontSize: 11 }}>{label}</Text>
                    </View>
                  ) : null
                })()}
                {p.items?.map((item, i) => (
                  <View key={i} style={[s.row, { marginTop: 4 }]}>
                    <Text style={[s.muted, { fontSize: 12 }]}>{item.product}</Text>
                    <Text style={[s.muted, { fontSize: 12 }]}>{item.quantity} {item.unit} × {item.unitPrice} جنيه</Text>
                  </View>
                ))}
              </View>
            ))
        )}

        {/* ── MESSAGES ───────────────────────────────────────────── */}
        {tab === 'messages' && (
          messages.length === 0
            ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 32 }]}>لا توجد رسائل</Text></View>
            : messages.map(msg => (
              <View key={msg.id} style={[s.card, { borderRightWidth: 4, borderRightColor: msg.isRead ? COLORS.border : COLORS.primary }]}>
                <View style={s.row}>
                  <View style={[s.chipBadge, { backgroundColor: msg.isRead ? '#F5F5F5' : '#E8F5E9' }]}>
                    <Text style={{ color: msg.isRead ? COLORS.muted : COLORS.primary, fontSize: 11 }}>
                      {msg.isRead ? 'مقروءة' : '● جديدة'}
                    </Text>
                  </View>
                  <Text style={[s.muted, { fontSize: 11 }]}>{new Date(msg.createdAt).toLocaleDateString('ar-EG')}</Text>
                </View>
                <Text style={[s.val, { marginTop: 8, lineHeight: 20 }]}>{msg.content}</Text>
                {!msg.isRead && (
                  <TouchableOpacity onPress={() => markMessageRead(msg.id)} style={{ marginTop: 10 }}>
                    <Text style={[s.muted, { color: COLORS.primary, fontSize: 12, textDecorationLine: 'underline' }]}>
                      تحديد كمقروءة
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:     { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  headerSub:       { color: '#A5D6A7', fontSize: 12, marginTop: 2 },
  logoutBtn:       { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  logoutText:      { color: '#fff', fontSize: 13 },
  activeBanner:    { backgroundColor: '#E8F5E9', borderBottomWidth: 1, borderBottomColor: '#C8E6C9', padding: 10 },
  activeBannerText:{ color: COLORS.primary, textAlign: 'center', fontWeight: '600', fontSize: 13 },
  tabBarWrap:      { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, maxHeight: 44 },
  tabBar:          { flexDirection: 'row', paddingHorizontal: 4 },
  tab:             { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', gap: 4 },
  tabActive:       { borderBottomColor: COLORS.primary },
  tabText:         { fontSize: 12, color: COLORS.muted },
  tabTextActive:   { color: COLORS.primary, fontWeight: '700' },
  badge:           { backgroundColor: COLORS.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:       { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  content:         { flex: 1 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  cardTitle:       { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 14, textAlign: 'right' },
  row:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  muted:           { fontSize: 13, color: COLORS.muted },
  val:             { fontSize: 14, color: COLORS.text },
  progressBg:      { height: 8, backgroundColor: COLORS.border, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill:    { height: 8, borderRadius: 4 },
  btn:             { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText:         { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  label:           { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, textAlign: 'right' },
  input:           { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#FAFAFA', marginBottom: 4 },
  infoBadge:       { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10 },
  infoBadgeText:   { color: COLORS.primary, fontWeight: '600', textAlign: 'center' },
  cartRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  counter:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnText:  { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  counterVal:      { width: 28, textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  chipBadge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:      { fontSize: 11, fontWeight: '700' },
})
