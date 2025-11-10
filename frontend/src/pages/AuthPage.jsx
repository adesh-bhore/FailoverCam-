import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import GlitchText from '../components/GlitchText'
import FuzzyText from '../components/FuzzyText';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'success'
    ? 'bg-green-500/20 border-green-500/50 text-green-400'
    : 'bg-red-500/20 border-red-500/50 text-red-400'

  const icon = type === 'success' ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )

  const glowClass = type === 'success' ? 'neon-glow' : 'neon-glow-red'

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor} backdrop-blur-glass shadow-lg ${glowClass} animate-slide-in`}>
      {icon}
      <span className="font-poppins font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-current/70 hover:text-current"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function AuthPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('camera')
  const [formData, setFormData] = useState({
    cameraName: 'Primary Camera A',
    ipAddress: '192.168.1.100',
    port: '8080',
    authKey: ''
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setToast(null)

    // Step 1: Check authentication key
    const AUTH_KEY = "2004"

    if (formData.authKey !== AUTH_KEY) {
      setToast({ message: 'Invalid authentication key. Please check your credentials.', type: 'error' })
      setLoading(false)
      return
    }

    // Step 2: Authentication successful, now check stream reachability via backend
    setToast({ message: 'Authentication successful! Checking stream reachability...', type: 'success' })

    try {
      // Use backend endpoint to check camera authentication
      const response = await fetch('http://127.0.0.1:8000/camera/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip: formData.ipAddress,
          port: formData.port,
          username: formData.username || '',
          password: formData.password || ''
        })
      })

      const data = await response.json()

      if (data.success) {
        setToast({ message: 'Stream reachability confirmed! Redirecting to dashboard...', type: 'success' })
        setTimeout(() => {
          localStorage.setItem('authenticated', 'true')
          localStorage.setItem('navigationSource', 'auth') // Track that user came from auth
          navigate('/dashboard')
        }, 1500)
      } else {
        setToast({ message: data.error || 'Stream is not reachable. Please check camera IP address and port.', type: 'error' })
        setLoading(false)
      }
    } catch (error) {
      console.error('Stream check error:', error)
      setToast({ message: `Stream check failed: ${error.message}`, type: 'error' })
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center p-4 relative overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Lottie Animation - Top Left */}
      <div className="absolute top-4 left-16 z-20">
        <DotLottieReact
          src="https://lottie.host/73bbf837-c03d-4ce6-8e03-7542e50a4100/J3Xd7n9SHf.lottie"
          loop
          autoplay
          style={{ width: 200, height: 150 }}
        />
      </div>

      {/* Lottie Animation - Top Right */}
      <div className="absolute top-4 right-16 z-20">
        <DotLottieReact
          src="https://lottie.host/73bbf837-c03d-4ce6-8e03-7542e50a4100/J3Xd7n9SHf.lottie"
          loop
          autoplay
          style={{ width: 200, height: 150 }}
        />
      </div>

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 195, 0.1) 2px, rgba(0, 255, 195, 0.1) 4px)'
        }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-[-80px]">
            <DotLottieReact
              src="https://lottie.host/989d2438-c670-4136-8993-028d3c0ce076/rTCR9Tcjj6.lottie"
              loop
              autoplay
              style={{ width: 170, height: 200 }}
            />
          </div>
          <div className="flex justify-center w-full">
            <FuzzyText
              baseIntensity={0.2}
              hoverIntensity={0.5}
              enableHover={true}
              fontSize="2.5rem"
              fontWeight={900}
              fontFamily="orbitron"
              color="#00ffc3"
              className="text-neon-primary neon-glow mb-2 text-center px-4 font-bold"
            >
              Sentinel <span style={{ color: "#ff0000" }}>Vision</span> AI
            </FuzzyText>
          </div>
          <p className="text-text-light/70 font-poppins mt-3">Security Authentication Portal</p>
        </div>

        {/* Auth Form Card */}
        <div className="glass-panel rounded-2xl p-8 neon-glow border-2 border-neon-primary/30">
          {/* Only Camera Auth Tab */}
          <div className="flex gap-2 mb-6">
            <button
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-neon-primary/20 text-neon-primary border border-neon-primary neon-glow cursor-default"
              disabled
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="font-poppins font-medium">Camera Auth</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-poppins text-text-light/80 mb-2">Camera Name</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-neon-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="cameraName"
                  value={formData.cameraName}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-secondary/50 border border-neon-primary/20 rounded-lg text-text-light focus:outline-none focus:border-neon-primary focus:neon-glow transition-all"
                  placeholder="Primary Camera A"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-poppins text-text-light/80 mb-2">Camera IP Address</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-neon-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="ipAddress"
                  value={formData.ipAddress}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-secondary/50 border border-neon-primary/20 rounded-lg text-text-light focus:outline-none focus:border-neon-primary focus:neon-glow transition-all"
                  placeholder="192.168.1.100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-poppins text-text-light/80 mb-2">Port (Optional)</label>
              <input
                type="text"
                name="port"
                value={formData.port}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-secondary/50 border border-neon-primary/20 rounded-lg text-text-light focus:outline-none focus:border-neon-primary focus:neon-glow transition-all"
                placeholder="8080"
              />
            </div>

            <div>
              <label className="block text-sm font-poppins text-text-light/80 mb-3">Authentication Key</label>

              {/* Locker Keypad */}
              <div className="glass-panel rounded-xl p-6 border-2 border-neon-primary/30">
                {/* Display Screen */}
                <div className="bg-dark-base rounded-lg p-4 mb-4 border-2 border-neon-primary/20">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs font-orbitron text-neon-primary/70">SECURE ACCESS</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 min-h-[50px] flex-wrap">
                    {formData.authKey.length === 0 ? (
                      <div className="text-text-light/30 font-mono text-sm">Enter authentication key...</div>
                    ) : (
                      formData.authKey.split('').map((char, index) => (
                        <div
                          key={index}
                          className="w-10 h-10 rounded-lg bg-neon-primary/20 border-2 border-neon-primary/50 flex items-center justify-center text-neon-primary font-mono font-bold text-xl neon-glow transition-all duration-200"
                        >
                          {char}
                        </div>
                      ))
                    )}
                    {formData.authKey.length > 0 && formData.authKey.length < 20 && (
                      <div className="w-10 h-10 rounded-lg bg-slate-secondary/30 border-2 border-neon-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-neon-primary animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Keypad */}
                <div className="space-y-2">
                  {/* Row 1-3 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          if (formData.authKey.length < 20) {
                            setFormData({ ...formData, authKey: formData.authKey + num })
                          }
                        }}
                        className="h-12 rounded-lg bg-slate-secondary/70 hover:bg-neon-primary/20 border border-neon-primary/30 hover:border-neon-primary hover:neon-glow text-neon-primary font-orbitron font-bold text-lg transition-all duration-200 active:scale-95"
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  {/* Bottom Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.authKey.length < 20) {
                          setFormData({ ...formData, authKey: formData.authKey + '@' })
                        }
                      }}
                      className="h-12 rounded-lg bg-slate-secondary/70 hover:bg-neon-primary/20 border border-neon-primary/30 hover:border-neon-primary hover:neon-glow text-neon-primary font-orbitron font-bold text-lg transition-all duration-200 active:scale-95"
                    >
                      @
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.authKey.length < 20) {
                          setFormData({ ...formData, authKey: formData.authKey + '0' })
                        }
                      }}
                      className="h-12 rounded-lg bg-slate-secondary/70 hover:bg-neon-primary/20 border border-neon-primary/30 hover:border-neon-primary hover:neon-glow text-neon-primary font-orbitron font-bold text-lg transition-all duration-200 active:scale-95"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, authKey: formData.authKey.slice(0, -1) })
                      }}
                      className="h-12 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 text-red-400 font-poppins font-bold transition-all duration-200 active:scale-95 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-secondary/70 hover:bg-neon-primary/20 border border-neon-primary/30 hover:border-neon-primary hover:neon-glow rounded-lg text-text-light font-poppins font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect Camera Feed'}
            </button>
          </form>

          {/* Test Mode Button */}
          <div className="mt-4 pt-4 border-t border-neon-primary/20">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('authenticated', 'true')
                localStorage.setItem('navigationSource', 'test') // Track that user came from test mode
                navigate('/dashboard')
              }}
              className="w-full py-3 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 hover:border-yellow-500 hover:neon-glow rounded-lg text-yellow-400 font-poppins font-medium transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Test Mode
            </button>
            <p className="text-xs text-text-light/50 text-center mt-2 font-poppins">
              Skip authentication and go to dashboard
            </p>
          </div>

          <p className="text-xs text-text-light/50 text-center mt-6 font-poppins">
            Supports RTSP, HTTP, and WebRTC protocols
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage

