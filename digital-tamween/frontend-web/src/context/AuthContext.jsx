import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user')) } catch { return null }
  })
  const [token, setToken] = useState(() => sessionStorage.getItem('token'))

  function login(userData, jwt) {
    setUser(userData)
    setToken(jwt)
    sessionStorage.setItem('token', jwt)
    sessionStorage.setItem('user', JSON.stringify(userData))
  }

  function logout() {
    setUser(null)
    setToken(null)
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
