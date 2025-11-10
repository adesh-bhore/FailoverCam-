import { useNavigate } from 'react-router-dom'

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/alerts', label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { path: '/recordings', label: 'Recordings', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

function Sidebar({ currentPath }) {
  const navigate = useNavigate()

  return (
    <aside className="w-64 bg-slate-secondary/40 backdrop-blur-glass border-r-2 border-neon-primary/30 flex flex-col relative glass-panel">
      {/* Animated vertical line */}
      <div className="absolute top-0 right-0 w-0.5 h-full bg-gradient-to-b from-transparent via-neon-primary/50 to-transparent" style={{
        animation: 'shimmer 3s infinite',
        transform: 'rotate(180deg)'
      }}></div>
      
      <nav className="flex-1 p-4 space-y-2 relative z-10">
        {menuItems.map((item) => {
          const isActive = currentPath === item.path || (item.path === '/dashboard' && (currentPath === '/' || currentPath === '/dashboard'))
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 relative group ${
                isActive
                  ? 'bg-gradient-to-r from-neon-primary/20 to-transparent border-l-4 border-neon-primary text-neon-primary neon-glow shadow-lg'
                  : 'text-text-light/70 hover:text-neon-primary hover:bg-neon-primary/10 border-l-4 border-transparent hover:border-neon-primary/50'
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-neon-primary rounded-r-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-neon-primary/5 rounded-lg"></div>
                </>
              )}
              
              <svg 
                className={`w-5 h-5 relative z-10 transition-all ${isActive ? 'animate-pulse' : 'group-hover:scale-110'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                style={isActive ? {filter: 'drop-shadow(0 0 4px currentColor)'} : {}}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className={`font-orbitron font-semibold text-sm relative z-10 ${isActive ? 'tracking-wider' : ''}`}>
                {item.label.toUpperCase()}
              </span>
              
              {/* Hover effect */}
              {!isActive && (
                <div className="absolute inset-0 bg-neon-primary/0 group-hover:bg-neon-primary/5 rounded-lg transition-all duration-300"></div>
              )}
            </button>
          )
        })}
      </nav>
      
      {/* Bottom status indicator */}
      <div className="p-4 border-t border-neon-primary/20 relative z-10">
        <div className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded-lg border border-neon-primary/20">
          <div className="w-2 h-2 bg-neon-primary rounded-full animate-pulse"></div>
          <span className="text-xs font-mono text-text-light/50">SYSTEM ONLINE</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

