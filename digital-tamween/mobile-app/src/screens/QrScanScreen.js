import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import api from '../api/axios'
import { COLORS } from '../config'

export default function QrScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [status, setStatus] = useState('scanning') // 'scanning' | 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')
  const [outletName, setOutletName] = useState('')
  const scannedRef = useRef(false)

  async function handleScan({ data: decodedText }) {
    if (scannedRef.current) return
    scannedRef.current = true

    let outletId = null
    try {
      const url = new URL(decodedText)
      const match = url.pathname.match(/^\/qr\/(.+)$/)
      if (match) outletId = match[1]
    } catch {}

    if (!outletId) {
      setMessage('رمز QR غير صالح — تأكد أنه رمز منفذ تموين')
      setStatus('error')
      return
    }

    setStatus('loading')
    try {
      const { data } = await api.post('/qr/scan', { outletId })
      setOutletName(data.outletName)
      setStatus('success')
    } catch (err) {
      const msg = err.response?.data?.error || 'حدث خطأ — حاول مجدداً'
      if (err.response?.status === 401) {
        setMessage('يجب تسجيل الدخول أولاً')
      } else {
        setMessage(msg)
      }
      setStatus('error')
    }
  }

  function retry() {
    scannedRef.current = false
    setStatus('scanning')
    setMessage('')
  }

  if (!permission) return <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.emoji}>📷</Text>
          <Text style={s.title}>مطلوب إذن الكاميرا</Text>
          <Text style={s.sub}>نحتاج إلى الكاميرا لمسح رمز QR</Text>
          <TouchableOpacity style={s.btn} onPress={requestPermission}>
            <Text style={s.btnText}>منح الإذن</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backText}>رجوع</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>

      {status === 'scanning' && (
        <>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
          />
          <View style={s.overlay}>
            <View style={s.topArea}>
              <Text style={s.scanTitle}>امسح رمز QR المنفذ</Text>
              <Text style={s.scanSub}>وجّه الكاميرا نحو الرمز الموجود على شاشة المنفذ</Text>
            </View>
            <View style={s.frame} />
            <View style={s.bottomArea}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
                <Text style={s.cancelText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {status === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.light} />
          <Text style={[s.scanTitle, { marginTop: 16 }]}>جاري التسجيل في المنفذ...</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={s.center}>
          <View style={s.resultCard}>
            <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: 12 }}>✅</Text>
            <Text style={s.successTitle}>تم التسجيل بنجاح!</Text>
            <Text style={s.successSub}>
              تم التعرف عليك تلقائياً في{'\n'}
              <Text style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{outletName}</Text>
            </Text>
            <View style={s.infoBadge}>
              <Text style={s.infoText}>
                أخبر موظف المنفذ — ستظهر بياناتك عنده الآن وسيبدأ إتمام عملية الشراء
              </Text>
            </View>
            <TouchableOpacity style={s.backBtn2} onPress={() => navigation.goBack()}>
              <Text style={s.backBtn2Text}>العودة للرئيسية</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'error' && (
        <View style={s.center}>
          <View style={s.resultCard}>
            <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: 12 }}>❌</Text>
            <Text style={s.errorText}>{message}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.backBtn2} onPress={() => navigation.goBack()}>
                <Text style={s.backBtn2Text}>رجوع</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={retry}>
                <Text style={s.btnText}>حاول مجدداً</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#111' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay:      { flex: 1, justifyContent: 'space-between', padding: 24 },
  topArea:      { alignItems: 'center', paddingTop: 48 },
  bottomArea:   { alignItems: 'center', paddingBottom: 32 },
  scanTitle:    { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  scanSub:      { color: '#ccc', fontSize: 13, textAlign: 'center', marginTop: 8 },
  frame:        { alignSelf: 'center', width: 240, height: 240, borderWidth: 3, borderColor: COLORS.light, borderRadius: 16, backgroundColor: 'transparent' },
  cancelBtn:    { borderWidth: 1, borderColor: '#666', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  cancelText:   { color: '#ccc', fontSize: 14 },
  emoji:        { fontSize: 56, marginBottom: 12 },
  title:        { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  sub:          { fontSize: 13, color: '#ccc', textAlign: 'center', marginBottom: 24 },
  btn:          { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  backBtn:      { marginTop: 12, paddingVertical: 12, paddingHorizontal: 32 },
  backText:     { color: '#ccc', fontSize: 14, textAlign: 'center' },
  resultCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  successTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8 },
  successSub:   { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  infoBadge:    { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  infoText:     { color: COLORS.primary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  backBtn2:     { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  backBtn2Text: { color: '#555', fontSize: 14 },
  errorText:    { color: '#D32F2F', fontWeight: 'bold', fontSize: 15, textAlign: 'center', marginBottom: 8 },
})
