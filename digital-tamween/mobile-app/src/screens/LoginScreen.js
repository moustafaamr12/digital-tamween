import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { setAuthToken } from '../api/axios'
import api from '../api/axios'
import { COLORS } from '../config'

const ROLES = [
  { id: 'USER',         label: 'مواطن',        icon: '👤', hint: 'الرقم القومي'  },
  { id: 'OUTLET_OWNER', label: 'منفذ تموين',   icon: '🏪', hint: 'البريد الإلكتروني'  },
  { id: 'ADMIN',        label: 'وزارة التموين', icon: '🏛️', hint: 'البريد الإلكتروني'  },
]

export default function LoginScreen({ navigation }) {
  const [role, setRole]             = useState('USER')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const { login } = useAuth()

  const selected = ROLES.find(r => r.id === role)

  async function handleLogin() {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال جميع البيانات')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { role, identifier: identifier.trim(), password })
      setAuthToken(data.token)
      login(data.user, data.token)
      const dest = data.user.role === 'OUTLET_OWNER' ? 'Outlet' : data.user.role === 'ADMIN' ? 'Admin' : 'User'
      navigation.replace(dest)
    } catch (err) {
      Alert.alert('خطأ', err.response?.data?.error || 'تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.header}>
          <Text style={s.emoji}>🏛️</Text>
          <Text style={s.title}>منظومة التموين الرقمية</Text>
          <Text style={s.subtitle}>وزارة التموين والتجارة الداخلية</Text>
        </View>

        <View style={s.roles}>
          {ROLES.map(r => (
            <TouchableOpacity key={r.id}
              style={[s.roleBtn, role === r.id && s.roleBtnActive, { flex: 1, minWidth: 90 }]}
              onPress={() => { setRole(r.id); setIdentifier('') }}>
              <Text style={s.roleIcon}>{r.icon}</Text>
              <Text style={[s.roleLabel, role === r.id && s.roleLabelActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.form}>
          <Text style={s.label}>{selected.hint}</Text>
          <TextInput style={s.input} value={identifier} onChangeText={setIdentifier}
            placeholder={role === 'USER' ? '29901011234567' : 'example@tamween.gov.eg'}
            keyboardType={role === 'USER' ? 'default' : 'email-address'}
            autoCapitalize="none" textAlign="right" />

          <Text style={[s.label, { marginTop: 16 }]}>كلمة المرور</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" secureTextEntry textAlign="right" />

          <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>تسجيل الدخول</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.primary },
  scroll:          { flexGrow: 1, paddingBottom: 32 },
  header:          { alignItems: 'center', paddingVertical: 40 },
  emoji:           { fontSize: 56 },
  title:           { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 12, textAlign: 'center' },
  subtitle:        { fontSize: 13, color: '#A5D6A7', marginTop: 6, textAlign: 'center' },
  roles:           { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 32, marginBottom: 8 },
  roleBtn:         { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 2, borderColor: 'transparent' },
  roleBtnActive:   { backgroundColor: '#fff', borderColor: COLORS.accent },
  roleIcon:        { fontSize: 28, marginBottom: 4 },
  roleLabel:       { fontSize: 12, color: '#C8E6C9', fontWeight: '600', textAlign: 'center' },
  roleLabelActive: { color: COLORS.primary },
  form:            { backgroundColor: '#fff', borderRadius: 24, marginHorizontal: 16, marginTop: 16, padding: 24 },
  label:           { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, textAlign: 'right' },
  input:           { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: '#FAFAFA' },
  btn:             { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText:         { color: '#fff', fontSize: 17, fontWeight: 'bold' },
})
