import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { COLORS } from '../config'

const TABS = [
  { id: 'stats',   label: 'الإحصائيات' },
  { id: 'outlets', label: 'المنافذ'    },
  { id: 'users',   label: 'المواطنون'  },
  { id: 'restock', label: 'شحن المنافذ'},
]

export default function AdminDashboard({ navigation }) {
  const { user, logout } = useAuth()
  const [tab, setTab]           = useState('stats')
  const [stats, setStats]       = useState(null)
  const [outlets, setOutlets]   = useState([])
  const [users, setUsers]       = useState([])
  const [outletSearch, setOutletSearch] = useState('')
  const [userSearch, setUserSearch]     = useState('')
  const [selOutlet, setSelOutlet] = useState(null)
  const [outletSales, setOutletSales] = useState([])
  const [selUser, setSelUser]   = useState(null)
  const [userPurchases, setUserPurchases] = useState([])

  // Restock state
  const [restockOutletId, setRestockOutletId] = useState('')
  const [restockProducts, setRestockProducts] = useState([])
  const [restockQtys, setRestockQtys]         = useState({})
  const [restockNote, setRestockNote]         = useState('')
  const [restockLoading, setRestockLoading]   = useState(false)
  const [restockMsg, setRestockMsg]           = useState('')
  const [pendingRestock, setPendingRestock]   = useState(null)
  const [confirmOtp, setConfirmOtp]           = useState('')
  const [confirmLoading, setConfirmLoading]   = useState(false)
  const [confirmMsg, setConfirmMsg]           = useState('')

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
    api.get('/admin/outlets').then(r => setOutlets(r.data)).catch(() => {})
    api.get('/admin/users').then(r => setUsers(r.data?.data || [])).catch(() => {})
  }, [])

  // Load outlet products when restock outlet changes
  useEffect(() => {
    if (!restockOutletId) { setRestockProducts([]); setRestockQtys({}); return }
    api.get(`/admin/outlets/${restockOutletId}/products`)
      .then(r => {
        const prods = r.data || []
        setRestockProducts(prods)
        const q = {}; prods.forEach(p => { q[p.id] = 0 }); setRestockQtys(q)
      })
      .catch(() => setRestockProducts([]))
  }, [restockOutletId])

  async function searchOutlets(q) {
    setOutletSearch(q)
    const { data } = await api.get('/admin/outlets', { params: q ? { search: q } : {} })
    setOutlets(data)
  }

  async function searchUsers(q) {
    setUserSearch(q)
    const { data } = await api.get('/admin/users', { params: q ? { search: q } : {} })
    setUsers(data?.data || [])
  }

  async function openOutlet(outlet) {
    setSelOutlet(outlet)
    const { data } = await api.get(`/admin/outlets/${outlet.id}/sales`)
    setOutletSales(data?.data || [])
  }

  async function openUser(u) {
    setSelUser(u)
    const { data } = await api.get(`/admin/users/${u.id}/purchases`)
    setUserPurchases(data?.data || [])
  }

  async function initiateRestock() {
    const items = Object.entries(restockQtys)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))
    if (!items.length) { setRestockMsg('error:أدخل كميات لمنتج واحد على الأقل'); return }
    if (!restockOutletId) { setRestockMsg('error:اختر منفذاً أولاً'); return }
    setRestockLoading(true); setRestockMsg('')
    try {
      const { data } = await api.post('/admin/restocks/initiate', {
        outletId: restockOutletId,
        items,
        note: restockNote,
      })
      setPendingRestock(data.restockId || data.id)
      setRestockMsg('success:تم إرسال طلب الشحن — تحقق من رسائل المنفذ للحصول على OTP')
    } catch (err) {
      setRestockMsg('error:' + (err.response?.data?.error || 'حدث خطأ'))
    }
    setRestockLoading(false)
  }

  async function doConfirmRestock() {
    if (!confirmOtp.trim()) { setConfirmMsg('error:أدخل رمز OTP'); return }
    setConfirmLoading(true); setConfirmMsg('')
    try {
      await api.post(`/admin/restocks/${pendingRestock}/confirm`, { otp: confirmOtp.trim() })
      setConfirmMsg('success:✅ تم تأكيد الشحن وتحديث المخزون')
      setPendingRestock(null); setConfirmOtp('')
      setRestockOutletId(''); setRestockQtys({}); setRestockNote(''); setRestockProducts([])
    } catch (err) {
      setConfirmMsg('error:' + (err.response?.data?.error || 'رمز OTP غير صحيح'))
    }
    setConfirmLoading(false)
  }

  function handleLogout() { logout(); navigation.replace('Login') }

  const statCards = stats ? [
    { label: 'المنافذ',      value: stats.totalOutlets,    sub: `${stats.activeOutlets} نشط`,  color: '#1565C0', bg: '#E3F2FD' },
    { label: 'المستفيدون',   value: stats.totalUsers,       sub: 'مواطن',                       color: '#2E7D32', bg: '#E8F5E9' },
    { label: 'عمليات البيع', value: stats.totalPurchases,  sub: 'إجمالي',                       color: '#6A1B9A', bg: '#F3E5F5' },
    { label: 'الإيرادات',    value: `${Number(stats.totalRevenue).toFixed(0)}`, sub: 'جنيه',    color: '#E65100', bg: '#FFF3E0' },
  ] : []

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>لوحة وزارة التموين</Text>
          <Text style={s.headerSub}>مرحباً، {user?.name}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarWrap} contentContainerStyle={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]}
            onPress={() => { setTab(t.id); setSelOutlet(null); setSelUser(null) }}>
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* ── STATS ─────────────────────────────────────────── */}
        {tab === 'stats' && (
          <>
            <View style={s.statsGrid}>
              {statCards.map(c => (
                <View key={c.label} style={[s.statCard, { backgroundColor: c.bg }]}>
                  <Text style={[s.statVal, { color: c.color }]}>{c.value}</Text>
                  <Text style={[s.statLabel, { color: c.color }]}>{c.label}</Text>
                  <Text style={[s.statSub, { color: c.color }]}>{c.sub}</Text>
                </View>
              ))}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>⚠️ تنبيهات المخزون المنخفض</Text>
              {outlets.filter(o => o.products?.some(p => p.lowStock)).length === 0 ? (
                <Text style={[s.muted, { textAlign: 'center', padding: 16 }]}>لا توجد تنبيهات ✅</Text>
              ) : outlets.filter(o => o.products?.some(p => p.lowStock)).map(o => (
                <View key={o.id} style={s.alertItem}>
                  <Text style={s.invName}>{o.name}</Text>
                  {o.products?.filter(p => p.lowStock).map((p, i) => (
                    <Text key={i} style={s.alertDetail}>⚠️ {p.name}: {p.quantity} {p.unit} متبقي</Text>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── OUTLETS ─────────────────────────────────────────── */}
        {tab === 'outlets' && (
          selOutlet ? (
            <>
              <TouchableOpacity style={s.backBtn} onPress={() => setSelOutlet(null)}>
                <Text style={s.backText}>← العودة</Text>
              </TouchableOpacity>
              <View style={s.card}>
                <Text style={s.cardTitle}>{selOutlet.name}</Text>
                <Text style={s.muted}>{selOutlet.address}</Text>
                <Text style={s.muted}>المالك: {selOutlet.owner?.name}</Text>
                <View style={[s.row, { marginTop: 10 }]}>
                  <Text style={s.muted}>{selOutlet.totalPurchases} عملية بيع</Text>
                  <Text style={[s.muted, { color: selOutlet.isActive ? COLORS.light : COLORS.danger }]}>
                    {selOutlet.isActive ? '● نشط' : '● متوقف'}
                  </Text>
                </View>
              </View>

              <Text style={[s.cardTitle, { marginBottom: 8 }]}>المخزون</Text>
              {selOutlet.products?.map((p, i) => (
                <View key={i} style={[s.card, { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }]}>
                  <Text style={s.invName}>{p.name}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.invQty, p.lowStock && { color: COLORS.danger }]}>{p.quantity} {p.unit}</Text>
                    {p.lowStock && <Text style={s.lowBadge}>منخفض</Text>}
                  </View>
                </View>
              ))}

              <Text style={[s.cardTitle, { marginBottom: 8 }]}>آخر المبيعات</Text>
              {outletSales.length === 0
                ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 16 }]}>لا توجد مبيعات</Text></View>
                : outletSales.map(sale => (
                  <View key={sale.id} style={s.card}>
                    <View style={s.row}>
                      <Text style={s.muted}>{sale.user?.name}</Text>
                      <Text style={[s.invQty, { color: COLORS.primary, fontSize: 15 }]}>{sale.totalAmount} جنيه</Text>
                    </View>
                    <Text style={s.muted}>{new Date(sale.createdAt).toLocaleDateString('ar-EG')}</Text>
                  </View>
                ))
              }
            </>
          ) : (
            <>
              <TextInput style={[s.input, { marginBottom: 12 }]} value={outletSearch}
                onChangeText={searchOutlets} placeholder="ابحث عن منفذ..." textAlign="right" />
              {outlets.map(o => (
                <TouchableOpacity key={o.id} style={s.card} onPress={() => openOutlet(o)}>
                  <View style={s.row}>
                    <Text style={[s.muted, { color: o.isActive ? COLORS.light : COLORS.danger, fontSize: 11 }]}>
                      {o.isActive ? '● نشط' : '● متوقف'}
                    </Text>
                    <Text style={s.invName}>{o.name}</Text>
                  </View>
                  <Text style={s.muted}>{o.address}</Text>
                  <Text style={s.muted}>المالك: {o.owner?.name} · {o.totalPurchases} بيعة</Text>
                  {o.products?.some(p => p.lowStock) && (
                    <Text style={[s.muted, { color: COLORS.danger, marginTop: 4 }]}>⚠️ مخزون منخفض</Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )
        )}

        {/* ── USERS ─────────────────────────────────────────── */}
        {tab === 'users' && (
          selUser ? (
            <>
              <TouchableOpacity style={s.backBtn} onPress={() => setSelUser(null)}>
                <Text style={s.backText}>← العودة</Text>
              </TouchableOpacity>
              <View style={s.card}>
                <Text style={s.cardTitle}>{selUser.name}</Text>
                <Text style={s.muted}>بطاقة: {selUser.tamweenCardId}</Text>
                <Text style={s.muted}>الرقم القومي: {selUser.nationalId}</Text>
                <View style={[s.row, { marginTop: 10 }]}>
                  <Text style={s.muted}>الحد: {selUser.monthlyCredit} جنيه</Text>
                  <Text style={[s.invQty, { color: COLORS.primary, fontSize: 15 }]}>متبقي: {selUser.remainingCredit?.toFixed(2)} جنيه</Text>
                </View>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${Math.min(100, (selUser.usedCredit / selUser.monthlyCredit) * 100)}%` }]} />
                </View>
              </View>

              <Text style={[s.cardTitle, { marginBottom: 8 }]}>سجل المشتريات</Text>
              {userPurchases.length === 0
                ? <View style={s.card}><Text style={[s.muted, { textAlign: 'center', padding: 16 }]}>لا توجد مشتريات</Text></View>
                : userPurchases.map(p => (
                  <View key={p.id} style={s.card}>
                    <View style={s.row}>
                      <Text style={s.muted}>{p.outlet?.name}</Text>
                      <Text style={[s.invQty, { color: COLORS.primary, fontSize: 15 }]}>{p.totalAmount} جنيه</Text>
                    </View>
                    <Text style={s.muted}>{new Date(p.createdAt).toLocaleDateString('ar-EG')}</Text>
                  </View>
                ))
              }
            </>
          ) : (
            <>
              <TextInput style={[s.input, { marginBottom: 12 }]} value={userSearch}
                onChangeText={searchUsers} placeholder="ابحث عن مواطن..." textAlign="right" />
              {users.map(u => (
                <TouchableOpacity key={u.id} style={s.card} onPress={() => openUser(u)}>
                  <View style={s.row}>
                    <Text style={[s.invQty, { color: COLORS.primary, fontSize: 15 }]}>{u.remainingCredit?.toFixed(2)} جنيه</Text>
                    <Text style={s.invName}>{u.name}</Text>
                  </View>
                  <Text style={s.muted}>بطاقة: {u.tamweenCardId}</Text>
                  <View style={[s.progressBg, { marginTop: 8 }]}>
                    <View style={[s.progressFill, {
                      width: `${Math.min(100, (u.usedCredit / u.monthlyCredit) * 100)}%`,
                      backgroundColor: (u.usedCredit / u.monthlyCredit) > 0.8 ? COLORS.danger : COLORS.light,
                    }]} />
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )
        )}

        {/* ── RESTOCK ───────────────────────────────────────── */}
        {tab === 'restock' && (
          <>
            {/* Confirm step */}
            {pendingRestock && (
              <View style={s.card}>
                <Text style={s.cardTitle}>تأكيد عملية الشحن</Text>
                {restockMsg.startsWith('success:') && (
                  <View style={s.successBox}>
                    <Text style={s.successText}>{restockMsg.replace('success:', '')}</Text>
                  </View>
                )}
                <Text style={[s.muted, { marginVertical: 8 }]}>
                  تم إرسال OTP إلى رسائل المنفذ. أدخل الرمز لتأكيد الشحن:
                </Text>
                <TextInput style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                  value={confirmOtp} onChangeText={setConfirmOtp}
                  placeholder="رمز OTP" keyboardType="numeric" maxLength={6} />
                {confirmMsg.startsWith('error:') && (
                  <Text style={[s.muted, { color: COLORS.danger, marginTop: 4 }]}>{confirmMsg.replace('error:', '')}</Text>
                )}
                {confirmMsg.startsWith('success:') && (
                  <View style={[s.successBox, { marginTop: 8 }]}>
                    <Text style={s.successText}>{confirmMsg.replace('success:', '')}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity style={s.outlineBtn} onPress={() => { setPendingRestock(null); setRestockMsg(''); setConfirmMsg('') }}>
                    <Text style={s.outlineBtnText}>إلغاء</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={doConfirmRestock} disabled={confirmLoading}>
                    {confirmLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>تأكيد الشحن</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!pendingRestock && (
              <View style={s.card}>
                <Text style={s.cardTitle}>شحن منفذ</Text>

                {restockMsg.startsWith('error:') && (
                  <View style={[s.card, { backgroundColor: '#FFEBEE', marginBottom: 8 }]}>
                    <Text style={[s.muted, { color: COLORS.danger }]}>{restockMsg.replace('error:', '')}</Text>
                  </View>
                )}

                <Text style={s.label}>اختر المنفذ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {outlets.map(o => (
                      <TouchableOpacity key={o.id}
                        style={[s.outletChip, restockOutletId === o.id && s.outletChipActive]}
                        onPress={() => setRestockOutletId(o.id)}>
                        <Text style={[s.outletChipText, restockOutletId === o.id && { color: '#fff' }]}>{o.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {restockOutletId && restockProducts.length > 0 && (
                  <>
                    <Text style={s.label}>الكميات المراد شحنها</Text>
                    {restockProducts.map(p => (
                      <View key={p.id} style={s.cartRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.invName}>{p.name}</Text>
                          <Text style={s.muted}>مخزون حالي: {p.quantity} {p.unit}</Text>
                        </View>
                        <View style={s.counter}>
                          <TouchableOpacity style={s.counterBtn} onPress={() => setRestockQtys(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}>
                            <Text style={s.counterBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={s.counterVal}>{restockQtys[p.id] || 0}</Text>
                          <TouchableOpacity style={[s.counterBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                            onPress={() => setRestockQtys(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}>
                            <Text style={[s.counterBtnText, { color: '#fff' }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <Text style={[s.label, { marginTop: 8 }]}>ملاحظة (اختياري)</Text>
                    <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                      value={restockNote} onChangeText={setRestockNote}
                      placeholder="ملاحظة للمنفذ..." textAlign="right" multiline />

                    <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={initiateRestock} disabled={restockLoading}>
                      {restockLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>إرسال طلب الشحن</Text>}
                    </TouchableOpacity>
                  </>
                )}

                {restockOutletId && restockProducts.length === 0 && (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={[s.muted, { marginTop: 8 }]}>جاري تحميل المنتجات...</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:   { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  headerSub:     { color: '#A5D6A7', fontSize: 12, marginTop: 2 },
  logoutBtn:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  logoutText:    { color: '#fff', fontSize: 13 },
  tabBarWrap:    { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, maxHeight: 44 },
  tabBar:        { flexDirection: 'row', paddingHorizontal: 4 },
  tab:           { paddingHorizontal: 16, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: COLORS.primary },
  tabText:       { fontSize: 12, color: COLORS.muted },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  content:       { flex: 1 },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard:      { width: '47%', borderRadius: 16, padding: 16 },
  statVal:       { fontSize: 28, fontWeight: 'bold' },
  statLabel:     { fontSize: 13, fontWeight: '600', marginTop: 4 },
  statSub:       { fontSize: 11, marginTop: 2, opacity: 0.8 },
  card:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  cardTitle:     { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 10, textAlign: 'right' },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted:         { fontSize: 12, color: COLORS.muted, textAlign: 'right' },
  invName:       { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  invQty:        { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  lowBadge:      { fontSize: 10, color: COLORS.danger, backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  alertItem:     { borderWidth: 1, borderColor: '#FFE0B2', borderRadius: 10, padding: 10, marginBottom: 8 },
  alertDetail:   { fontSize: 12, color: COLORS.danger, textAlign: 'right', marginTop: 2 },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  backBtn:       { paddingVertical: 8, marginBottom: 8 },
  backText:      { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  progressBg:    { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill:  { height: 6, backgroundColor: COLORS.light, borderRadius: 3 },
  label:         { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8, textAlign: 'right' },
  btn:           { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText:       { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  outlineBtn:    { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  outlineBtnText:{ color: COLORS.muted, fontWeight: '600', fontSize: 14 },
  successBox:    { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14 },
  successText:   { color: COLORS.primary, fontWeight: '600', textAlign: 'center', fontSize: 13, lineHeight: 22 },
  cartRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  counter:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn:    { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnText:{ fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  counterVal:    { width: 28, textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  outletChip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff' },
  outletChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  outletChipText:{ fontSize: 13, color: COLORS.text, fontWeight: '600' },
})
