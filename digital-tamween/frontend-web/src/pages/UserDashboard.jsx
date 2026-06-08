import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TABS = ['balance', 'map', 'delivery', 'delivery-status', 'history', 'messages']
const TAB_LABELS = { balance: 'رصيدي', map: 'المنافذ', delivery: 'طلب توصيل', 'delivery-status': 'حالة طلبات التوصيل', history: 'سجل الشراء', messages: 'رسائلي' }

const STATUS_LABELS = { PENDING: 'تم الارسال', CONFIRMED: 'قيد التحضير', OUT_FOR_DELIVERY: 'في الطريق', DELIVERED: 'تم التسليم', CANCELLED: 'ملغي' }
const STATUS_COLORS = { PENDING: 'bg-yellow-100 text-yellow-700', CONFIRMED: 'bg-blue-100 text-blue-700', OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700', DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700' }

function getRemainingMinutes(updatedAt) {
  const dispatchTime = new Date(updatedAt).getTime()
  const estimatedArrival = dispatchTime + 60 * 60 * 1000
  return Math.max(0, Math.round((estimatedArrival - Date.now()) / 60000))
}

export default function UserDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('balance')
  const [profile, setProfile] = useState(null)
  const [outlets, setOutlets] = useState([])
  const [purchases, setPurchases] = useState([])
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryMsg, setDeliveryMsg] = useState('')
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [deliveryOrders, setDeliveryOrders] = useState([])
  const [selectedDelivery, setSelectedDelivery] = useState(null)

  function loadDeliveryOrders() {
    api.get('/user/deliveries').then(r => setDeliveryOrders(r.data)).catch(() => {})
  }

  useEffect(() => {
    api.get('/user/profile').then(r => setProfile(r.data)).catch(() => {})
    api.get('/user/outlets').then(r => setOutlets(r.data)).catch(() => {})
    api.get('/user/purchases').then(r => setPurchases(r.data)).catch(() => {})
    api.get('/user/messages').then(r => setMessages(r.data)).catch(() => {})
    loadDeliveryOrders()
  }, [])

  function handleLogout() { logout(); navigate('/login') }

  function selectOutlet(outlet) {
    setSelectedOutlet(outlet)
    setCartItems((outlet.products || []).map(p => ({
      productId: p.id, name: p.name, unit: p.unit, price: p.pricePerUnit, qty: 0,
    })))
    setDeliveryMsg('')
    setTab('delivery')
  }

  async function submitDelivery(e) {
    e.preventDefault()
    const items = cartItems.filter(i => i.qty > 0)
    if (!items.length) return setDeliveryMsg('error:اختر منتجاً واحداً على الأقل')
    setDeliveryLoading(true)
    setDeliveryMsg('')
    try {
      await api.post('/user/order-delivery', {
        outletId: selectedOutlet.id,
        address: deliveryAddress,
        items: items.map(i => ({ productId: i.productId, quantity: i.qty })),
      })
      setDeliveryMsg('success')
      api.get('/user/profile').then(r => setProfile(r.data)).catch(() => {})
      api.get('/user/purchases').then(r => setPurchases(r.data)).catch(() => {})
    } catch (err) {
      setDeliveryMsg('error:' + (err.response?.data?.error || 'حدث خطأ'))
    }
    setDeliveryLoading(false)
  }

  const remaining = profile?.remainingCredit ?? 0
  const usedPct = profile ? Math.min(100, (profile.usedCredit / profile.monthlyCredit) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-green-800 text-white px-4 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-lg">منظومة التموين الرقمية</h1>
          <p className="text-green-200 text-sm">مرحباً، {profile?.name || user?.name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg">خروج</button>
      </header>

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

        {/* BALANCE */}
        {tab === 'balance' && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">رصيد التموين الشهري</h2>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">الحد الشهري</span>
                <span className="font-semibold">{profile?.monthlyCredit ?? '--'} جنيه</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">المستخدم</span>
                <span className="font-semibold text-red-600">{profile?.usedCredit?.toFixed(2) ?? '--'} جنيه</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-500">المتبقي</span>
                <span className="font-bold text-green-700 text-lg">{remaining.toFixed(2)} جنيه</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-yellow-400' : 'bg-green-500'}`}
                  style={{ width: `${usedPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">{usedPct.toFixed(0)}٪ مستخدم</p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-3">بياناتي</h2>
              {[
                ['الاسم', profile?.name],
                ['رقم البطاقة', profile?.tamweenCardId],
                ['الرقم القومي', profile?.nationalId],
                ['الهاتف', profile?.phone],
                ['العنوان', profile?.address],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-2 border-b last:border-0 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{val || '---'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* MAP */}
        {tab === 'map' && (
          <>
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-4 border-b font-bold text-gray-700">المنافذ التموينية القريبة</div>
              <div style={{ height: 320 }}>
                <MapContainer center={[30.0626, 31.2497]} zoom={11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                  {outlets.map(o => (
                    <Marker key={o.id} position={[o.latitude, o.longitude]}>
                      <Popup>
                        <strong>{o.name}</strong><br />
                        <span style={{ fontSize: 12 }}>{o.address}</span>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {outlets.map(o => (
              <div key={o.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">{o.name}</p>
                  <p className="text-sm text-gray-500">{o.address}</p>
                  <p className="text-xs text-green-600 mt-1">{o.products?.length ?? 0} منتج متاح</p>
                </div>
                <button onClick={() => selectOutlet(o)}
                  className="bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-800 shrink-0">
                  اطلب توصيل
                </button>
              </div>
            ))}
          </>
        )}

        {/* DELIVERY */}
        {tab === 'delivery' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-bold text-gray-700 mb-4">طلب توصيل</h2>
            {!selectedOutlet ? (
              <div className="text-center py-12">
                <p className="text-gray-400">اختر منفذاً من تبويب "المنافذ" أولاً</p>
                <button onClick={() => setTab('map')} className="mt-4 text-green-700 underline text-sm">
                  الذهاب للمنافذ
                </button>
              </div>
            ) : deliveryMsg === 'success' ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-bold text-green-700 text-lg">تم إرسال الطلب بنجاح!</p>
                <button onClick={() => { setDeliveryMsg(''); setSelectedOutlet(null) }}
                  className="mt-4 bg-green-700 text-white px-6 py-2 rounded-xl hover:bg-green-800">
                  طلب آخر
                </button>
              </div>
            ) : (
              <form onSubmit={submitDelivery} className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs text-gray-500">المنفذ المختار</p>
                  <p className="font-bold text-green-800">{selectedOutlet.name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عنوان التوصيل</label>
                  <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="أدخل عنوانك كاملاً" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">اختر المنتجات</label>
                  {cartItems.map((item, i) => (
                    <div key={item.productId} className="flex items-center justify-between border rounded-xl p-3 mb-2">
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.price} جنيه / {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => {
                          const u = [...cartItems]; u[i].qty = Math.max(0, u[i].qty - 1); setCartItems(u)
                        }} className="w-8 h-8 rounded-full border font-bold text-lg flex items-center justify-center">-</button>
                        <span className="w-8 text-center font-bold">{item.qty}</span>
                        <button type="button" onClick={() => {
                          const u = [...cartItems]; u[i].qty++; setCartItems(u)
                        }} className="w-8 h-8 rounded-full bg-green-700 text-white font-bold text-lg flex items-center justify-center">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl p-3 flex justify-between">
                  <span className="text-gray-600 text-sm">الإجمالي (شامل التوصيل 5 جنيه)</span>
                  <span className="font-bold text-green-700">
                    {(cartItems.reduce((s, i) => s + i.price * i.qty, 0) + 5).toFixed(2)} جنيه
                  </span>
                </div>

                {deliveryMsg.startsWith('error:') && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
                    {deliveryMsg.replace('error:', '')}
                  </div>
                )}

                <button type="submit" disabled={deliveryLoading}
                  className="w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">
                  {deliveryLoading ? 'جاري الإرسال...' : 'تأكيد الطلب'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* DELIVERY STATUS */}
        {tab === 'delivery-status' && (
          <>
            {/* Modal */}
            {selectedDelivery && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDelivery(null)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">تفاصيل الطلب</h3>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selectedDelivery.status]}`}>
                      {STATUS_LABELS[selectedDelivery.status]}
                    </span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
                      <p><span className="text-gray-500">المنفذ: </span><span className="font-bold">{selectedDelivery.outletName}</span></p>
                      <p><span className="text-gray-500">العنوان: </span><span className="font-medium">{selectedDelivery.address}</span></p>
                      <p><span className="text-gray-500">التاريخ: </span><span className="font-medium">{new Date(selectedDelivery.createdAt).toLocaleString('ar-EG')}</span></p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">الأصناف:</p>
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

                    {selectedDelivery.status !== 'DELIVERED' && selectedDelivery.extraPayment > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        ⚠️ ستدفع <span className="font-bold">{selectedDelivery.extraPayment.toFixed(2)} جنيه</span> إضافياً عند الاستلام
                      </div>
                    )}
                    {selectedDelivery.status !== 'DELIVERED' && selectedDelivery.extraPayment === 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                        ✅ رصيدك يغطي الطلب بالكامل
                      </div>
                    )}
                    {selectedDelivery.status === 'DELIVERED' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm space-y-1">
                        {selectedDelivery.extraPayment > 0 ? (
                          <>
                            <p className="text-gray-600">من رصيد التموين: <span className="font-bold text-green-700">{(selectedDelivery.totalAmount - selectedDelivery.extraPayment).toFixed(2)} جنيه</span></p>
                            <p className="text-gray-600">مبلغ إضافي دُفع: <span className="font-bold text-blue-700">{selectedDelivery.extraPayment.toFixed(2)} جنيه</span></p>
                            <p className="text-gray-600">طريقة الدفع: <span className="font-bold">{selectedDelivery.extraPaymentMethod === 'CARD' ? '💳 بطاقة بنكية' : '💵 كاش'}</span></p>
                          </>
                        ) : (
                          <p className="text-green-700 font-medium">✅ تم الدفع بالكامل من رصيد التموين</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-700">حالة طلبات التوصيل</h2>
              <button onClick={loadDeliveryOrders} className="text-sm text-green-700 hover:underline">تحديث</button>
            </div>

            {deliveryOrders.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">لا توجد طلبات توصيل بعد</div>
            ) : deliveryOrders.map(d => {
              const remaining = d.status === 'OUT_FOR_DELIVERY' ? getRemainingMinutes(d.updatedAt) : null
              return (
                <div key={d.id} onClick={() => setSelectedDelivery(d)}
                  className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-r-4 border-green-500">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{d.outletName}</p>
                      <p className="text-sm text-gray-500 truncate max-w-[180px]">{d.address}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[d.status]}`}>
                      {STATUS_LABELS[d.status]}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{d.itemCount} صنف</span>
                    <span>{new Date(d.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                  {remaining !== null && (
                    <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 font-medium text-center">
                      {remaining > 0 ? `⏱️ متبقي تقريباً ${remaining} دقيقة للوصول` : '🚚 وصل للتو — في انتظار التسليم'}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <>
            <h2 className="text-lg font-bold text-gray-700">سجل مشترياتي</h2>
            {purchases.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">لا توجد مشتريات بعد</div>
            ) : purchases.map(p => (
              <div key={p.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    p.type === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {p.type === 'DELIVERY' ? '🚚 توصيل' : '🏪 حضوري'}
                  </span>
                  <span className="font-bold text-green-700">{p.totalAmount} جنيه</span>
                </div>
                <p className="text-sm font-medium">{p.outlet?.name}</p>
                <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <div className="mt-2 space-y-1">
                  {p.items?.map((item, i) => (
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

        {/* MESSAGES */}
        {tab === 'messages' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-700">رسائلي</h2>
              <button onClick={() => api.get('/user/messages').then(r => setMessages(r.data)).catch(() => {})}
                className="text-sm text-green-700 hover:underline">تحديث</button>
            </div>
            {messages.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">لا توجد رسائل بعد</div>
            ) : messages.map(m => (
              <div key={m.id} className={`bg-white rounded-xl shadow p-4 border-r-4 ${m.otp ? 'border-green-500' : 'border-gray-200'}`}>
                <p className="text-sm text-gray-700 leading-relaxed">{m.content}</p>
                {m.otp && (
                  <div className="mt-3 bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">رمز OTP</p>
                    <p className="text-3xl font-bold tracking-widest text-green-700">{m.otp}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">{new Date(m.createdAt).toLocaleString('ar-EG')}</p>
              </div>
            ))}
          </>
        )}

      </main>
    </div>
  )
}
