import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('authenticated')
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-dark-base flex relative">
      <Sidebar currentPath={location.pathname} />
      <div className="flex-1 flex flex-col relative z-10">
        <Header onLogout={handleLogout} />
        <main className="flex-1 p-6 overflow-auto relative z-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout

