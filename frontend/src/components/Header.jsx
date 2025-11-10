import { useState, useEffect } from 'react'
import GlitchText from './GlitchText'

function Header({ onLogout }) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  return (
    <header className="bg-slate-secondary/40 backdrop-blur-glass border-b-2 border-neon-primary/30 px-6 py-4 flex items-center justify-between relative glass-panel">
      {/* Animated border effect */}
      <div className="absolute inset-0 border-b-2 border-neon-primary/50" style={{
        background: 'linear-gradient(90deg, transparent, rgba(0, 255, 195, 0.3), transparent)',
        animation: 'shimmer 3s infinite'
      }}></div>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 flex items-center justify-center relative">
          <div className="absolute inset-0 bg-neon-primary/30 rounded-full blur-xl animate-pulse"></div>
          <div className="relative w-12 h-12 rounded-full border-2 border-neon-primary flex items-center justify-center neon-glow-intense">
            <svg className="w-7 h-7 text-neon-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.9"/>
            </svg>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div className="flex items-center gap-2" style={{ position: 'relative', overflow: 'hidden', maxHeight: '2.5rem' }}>
            <GlitchText speed={1} enableShadows={true} enableOnHover={true} className="text-2xl font-orbitron font-black text-neon-primary" style={{ display: 'inline-block', lineHeight: '1.5' }}>
              SENTINEL <span style={{ color: 'red' }}>VISION</span> AI
            </GlitchText>
          </div>
          <p className="text-xs text-text-light/60 font-mono mt-0.5 flex items-center gap-2">
            <span className="w-1 h-1 bg-neon-primary rounded-full animate-pulse"></span>
            SECURITY SURVEILLANCE CONSOLE v2.0
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-6 relative z-10">
        <div className="text-right px-4 py-2 bg-black/30 rounded-lg border border-neon-primary/20">
          <div className="text-xl font-orbitron font-bold text-neon-primary cyber-number flex items-center gap-2" style={{textShadow: '0 0 3px rgba(0, 255, 195, 0.4)'}}>
            <span className="w-1.5 h-1.5 bg-neon-primary rounded-full animate-pulse"></span>
            {formatTime(currentTime)}
          </div>
          <div className="text-xs text-text-light/50 font-mono mt-0.5">{formatDate(currentTime)}</div>
        </div>
        <button 
          onClick={onLogout}
          className="w-11 h-11 rounded-lg border-2 border-neon-primary/40 hover:border-neon-primary hover:neon-glow transition-all duration-300 flex items-center justify-center bg-black/20 backdrop-blur-sm"
        >
          <svg className="w-5 h-5 text-neon-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </div>
    </header>
  )
}

export default Header

