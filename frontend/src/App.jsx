import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Recordings from './pages/Recordings'
import Settings from './pages/Settings'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('authenticated') === 'true'
      setIsAuthenticated(auth)
      setLoading(false)
    }
    
    checkAuth()
    
    // Listen for storage changes
    const handleStorageChange = () => checkAuth()
    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically in case localStorage is changed in same tab
    const interval = setInterval(checkAuth, 100)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return null // or a loading spinner
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

function AuthRoute() {
  // Always show auth page - let AuthPage handle redirect after successful auth
  return <AuthPage />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/auth" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="recordings" element={<Recordings />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

