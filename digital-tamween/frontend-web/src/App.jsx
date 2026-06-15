import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import UserDashboard from './pages/UserDashboard'
import OutletDashboard from './pages/OutletDashboard'
import QrScan from './pages/QrScan'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/user" element={
            <ProtectedRoute role="USER"><UserDashboard /></ProtectedRoute>
          } />
          <Route path="/outlet" element={
            <ProtectedRoute role="OUTLET_OWNER"><OutletDashboard /></ProtectedRoute>
          } />
          <Route path="/scan" element={<QrScan />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
