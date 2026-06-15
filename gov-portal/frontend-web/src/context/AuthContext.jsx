import { createContext, useContext, useState } from 'react'
import tamween from '../api/tamween'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('gov_user')) } catch { return null }
  })

  async function login(email, password) {
    const { data } = await tamween.post('/auth/login', { role: 'ADMIN', identifier: email, password })
    if (data.user.role !== 'ADMIN') throw new Error('غير مصرح لك بالدخول')
    sessionStorage.setItem('gov_token', data.token)
    sessionStorage.setItem('gov_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  function logout() {
    sessionStorage.removeItem('gov_token')
    sessionStorage.removeItem('gov_user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
