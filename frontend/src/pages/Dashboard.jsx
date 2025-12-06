import { useState, useEffect } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import LogTerminal from '../components/LogTerminal'
import NetworkHealth from '../components/NetworkHealth'
import MapView from '../components/MapView'
import GlitchText from '../components/GlitchText'
import VoiceAnnouncer from '../components/VoiceAnnouncer'

function Dashboard() {
  const [detections, setDetections] = useState([
    { type: 'Person', time: '14:42:15', confidence: 95, severity: 'warning' },
    { type: 'Vehicle', time: '14:41:03', confidence: 87, severity: 'info' },
    { type: 'Suspicious Object', time: '14:38:22', confidence: 78, severity: 'critical' },
  ])
  const [activeFeed, setActiveFeed] = useState('primary')
  const [fps, setFps] = useState(0)
  const [streamKey, setStreamKey] = useState(0) // Force image reload when stream becomes available
  const [streamAvailable, setStreamAvailable] = useState(false)
  const [navigationSource, setNavigationSource] = useState(null) // Track how user navigated here
  const [streamStarting, setStreamStarting] = useState(false)
  const [streamStopping, setStreamStopping] = useState(false)
  const [streamThreadsStarted, setStreamThreadsStarted] = useState(false)
  const [lastAlertId, setLastAlertId] = useState(0) // Track last alert for voice announcements

  useEffect(() => {
    // Check navigation source from localStorage
    const source = localStorage.getItem('navigationSource')
    setNavigationSource(source)

    // Check if stream threads are already started
    const checkStreamStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/stream/status')
        const data = await response.json()
        setStreamThreadsStarted(data.threads_started || false)
      } catch (error) {
        console.error('Error checking stream status:', error)
      }
    }
    checkStreamStatus()

    // Periodically check stream status
    const statusInterval = setInterval(checkStreamStatus, 5000)

    return () => {
      clearInterval(statusInterval)
    }
  }, [])

  useEffect(() => {
    // Fetch active feed status
    const fetchFeedStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/status')
        const data = await response.json()
        if (data.active_feed) {
          const newFeed = data.active_feed
          if (newFeed !== activeFeed) {
            // Feed changed, force stream reload
            setActiveFeed(newFeed)
            setStreamKey(prev => prev + 1)
            console.log(`Feed changed to ${newFeed}, refreshing stream`)
          } else {
            setActiveFeed(newFeed)
          }
        }
      } catch (error) {
        console.error('Error fetching feed status:', error)
      }
    }

    // Fetch health data for FPS and detect stream availability
    const fetchHealth = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/health')
        const data = await response.json()
        if (data.fps) {
          const currentFps = Math.round(data.fps)
          setFps(currentFps)

          // If FPS > 0, stream is available
          if (currentFps > 0 && !streamAvailable) {
            setStreamAvailable(true)
            // Force image reload by updating streamKey
            setStreamKey(prev => prev + 1)
            console.log('Stream is now available, refreshing video feed')
          } else if (currentFps === 0 && streamAvailable) {
            // Stream went down
            setStreamAvailable(false)
          }
        }
      } catch (error) {
        console.error('Error fetching health:', error)
        setStreamAvailable(false)
      }
    }

    // Initial fetch
    fetchFeedStatus()
    fetchHealth()

    // Set up intervals
    const statusInterval = setInterval(fetchFeedStatus, 3000)
    const healthInterval = setInterval(fetchHealth, 2000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(healthInterval)
    }
  }, [streamAvailable])

  // Monitor alerts for voice announcements during camera failover
  useEffect(() => {
    const fetchAlertsForVoice = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/alerts')
        const alerts = await response.json()

        // Check for new alerts with voice messages
        if (alerts.length > 0) {
          const latestAlert = alerts[0] // Alerts are returned newest first

          // If this is a new alert and it has a voice message, speak it
          if (latestAlert.id > lastAlertId && latestAlert.speak_message) {
            console.log('🔊 Voice alert triggered:', latestAlert.speak_message)
            VoiceAnnouncer.speak(latestAlert.speak_message)
            setLastAlertId(latestAlert.id)
          }
        }
      } catch (error) {
        console.error('Error fetching alerts for voice:', error)
      }
    }

    // Initial fetch
    fetchAlertsForVoice()

    // Check for new voice alerts every 2 seconds
    const alertsInterval = setInterval(fetchAlertsForVoice, 2000)

    return () => clearInterval(alertsInterval)
  }, [lastAlertId])

  return (
    <div className="space-y-6 relative z-10">
      {/* Header with glitch effect */}
      <div className="relative">
        <GlitchText speed={1} enableShadows={true} enableOnHover={true} className="text-5xl font-orbitron font-black text-neon-primary mb-2 relative z-10">
          DASHBOARD
        </GlitchText>
        <p className="text-text-light/70 font-poppins text-sm mt-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-neon-primary rounded-full animate-pulse"></span>
          Real-time surveillance monitoring system
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Camera Feed with enhanced effects */}
          <div className="glass-panel rounded-xl p-5 border-2 border-neon-primary neon-glow-intense relative overflow-hidden cyber-grid hologram-effect">
            {/* Corner brackets */}
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-neon-primary"></div>
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-neon-primary"></div>
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-neon-primary"></div>
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-neon-primary"></div>

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div>
                <h3 className="text-xl font-orbitron font-bold text-neon-primary flex items-center gap-2" style={{ textShadow: '0 0 3px rgba(0, 255, 195, 0.4)' }}>
                  <span className="w-2 h-2 bg-neon-primary rounded-full animate-pulse"></span>
                  {activeFeed === 'primary' ? 'PRIMARY CAMERA A' : 'BACKUP CAMERA B'}
                </h3>
                <p className="text-xs text-text-light/50 font-mono mt-1">SYSTEM_ID: {activeFeed.toUpperCase()}_001</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-lg text-xs font-orbitron font-bold uppercase tracking-wider ${activeFeed === 'primary'
                  ? 'bg-neon-primary/30 text-neon-primary border border-neon-primary neon-glow'
                  : 'bg-yellow-500/30 text-yellow-400 border border-yellow-400 neon-glow-yellow'
                  }`}>
                  {activeFeed === 'primary' ? 'PRIMARY' : 'BACKUP'}
                </span>
                <span className="px-4 py-2 bg-neon-primary/30 text-neon-primary rounded-lg text-xs font-orbitron font-bold uppercase tracking-wider border border-neon-primary neon-glow flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-neon-primary rounded-full animate-pulse"></span>
                  ACTIVE
                </span>
              </div>
            </div>

            <div className="aspect-video bg-slate-900/50 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden scan-line border border-neon-primary/50">
              {/* Grid overlay */}
              <div className="absolute inset-0 cyber-grid opacity-30"></div>

              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-neon-primary/50"></div>
              <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-neon-primary/50"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 border-b-4 border-l-4 border-neon-primary/50"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-neon-primary/50"></div>

              {streamAvailable || fps > 0 ? (
                <>
                  <img
                    src="http://127.0.0.1:8000/ai_feed"
                    alt={`${activeFeed === 'primary' ? 'Primary' : 'Backup'} Camera Feed`}
                    className="w-full h-full object-cover relative z-10"
                    key={`${activeFeed}-${streamKey}`}
                    onError={(e) => {
                      console.error('Stream image error, will retry...')
                      setTimeout(() => {
                        setStreamKey(prev => prev + 1)
                      }, 2000)
                    }}
                    onLoad={() => {
                      if (!streamAvailable) {
                        setStreamAvailable(true)
                      }
                    }}
                  />
                  {/* Overlay stats */}
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded border border-neon-primary/50 z-20">
                    <span className="text-xs font-mono text-neon-primary">LIVE</span>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded border border-neon-primary/50 z-20">
                    <span className="text-xs font-mono text-neon-primary">{new Date().toLocaleTimeString()}</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <div className="relative">
                    <svg className="w-20 h-20 text-neon-primary/30 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 border-4 border-neon-primary/20 border-t-neon-primary rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <p className="text-text-light/70 font-orbitron text-sm mb-1">INITIALIZING STREAM...</p>
                  <p className="text-text-light/40 font-mono text-xs">Establishing connection to camera feed</p>
                  <div className="mt-4 flex gap-1">
                    <div className="w-2 h-2 bg-neon-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-neon-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-neon-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm relative z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-text-light/50 font-mono text-xs">FPS:</span>
                  <span className="text-neon-primary font-orbitron font-bold cyber-number text-lg">{fps || 0}</span>
                </div>
                <div className="w-px h-4 bg-neon-primary/30"></div>
                <div className="flex items-center gap-2">
                  <span className="text-text-light/50 font-mono text-xs">LATENCY:</span>
                  <span className="text-neon-primary font-orbitron font-bold cyber-number">--ms</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded border border-neon-primary/30">
                  <span className="text-text-light/50 font-mono text-xs">DETECTIONS:</span>
                  <span className="text-neon-primary font-orbitron font-bold cyber-number">12</span>
                </div>
                {/* Watch Stream Button - Only enabled for users who came through auth */}
                <button
                  onClick={async () => {
                    if (streamThreadsStarted) {
                      return // Already started
                    }
                    setStreamStarting(true)
                    try {
                      const response = await fetch('http://127.0.0.1:8000/stream/start', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        }
                      })
                      const data = await response.json()
                      if (data.success) {
                        setStreamThreadsStarted(true)
                        // Refresh stream status after a short delay
                        setTimeout(() => {
                          setStreamKey(prev => prev + 1)
                        }, 2000)
                      }
                    } catch (error) {
                      console.error('Error starting stream:', error)
                    } finally {
                      setStreamStarting(false)
                    }
                  }}
                  disabled={navigationSource !== 'auth' || streamThreadsStarted || streamStarting || streamStopping}
                  className={`px-4 py-2 rounded-lg text-xs font-orbitron font-bold uppercase tracking-wider border transition-all duration-300 flex items-center gap-2 ${navigationSource !== 'auth' || streamThreadsStarted
                    ? 'bg-slate-secondary/30 text-text-light/50 border-neon-primary/20 cursor-not-allowed'
                    : streamStarting
                      ? 'bg-yellow-500/30 text-yellow-400 border-yellow-400 neon-glow-yellow'
                      : 'bg-neon-primary/30 text-neon-primary border-neon-primary neon-glow hover:bg-neon-primary/40 cursor-pointer'
                    }`}
                >
                  {streamThreadsStarted ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      STREAM ACTIVE
                    </>
                  ) : streamStarting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      STARTING...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      WATCH STREAM
                    </>
                  )}
                </button>
                {/* Stop Stream Button - Only enabled when threads are started */}
                <button
                  onClick={async () => {
                    if (!streamThreadsStarted) {
                      return // Not started
                    }
                    setStreamStopping(true)
                    try {
                      const response = await fetch('http://127.0.0.1:8000/stream/stop', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        }
                      })
                      const data = await response.json()
                      if (data.success) {
                        setStreamThreadsStarted(false)
                        setStreamAvailable(false)
                        // Reset stream key to clear the video feed
                        setStreamKey(prev => prev + 1)
                      }
                    } catch (error) {
                      console.error('Error stopping stream:', error)
                    } finally {
                      setStreamStopping(false)
                    }
                  }}
                  disabled={!streamThreadsStarted || streamStopping || streamStarting}
                  className={`px-4 py-2 rounded-lg text-xs font-orbitron font-bold uppercase tracking-wider border transition-all duration-300 flex items-center gap-2 ${!streamThreadsStarted
                    ? 'bg-slate-secondary/30 text-text-light/50 border-neon-primary/20 cursor-not-allowed'
                    : streamStopping
                      ? 'bg-orange-500/30 text-orange-400 border-orange-400 neon-glow-orange'
                      : 'bg-red-500/30 text-red-400 border-red-400 neon-glow-red hover:bg-red-500/40 cursor-pointer'
                    }`}
                >
                  {streamStopping ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      STOPPING...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      STOP STREAM
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* System Terminal */}
          <div className="glass-panel rounded-xl p-4 relative cyber-grid data-stream">
            <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <GlitchText speed={1.5} enableShadows={true} enableOnHover={true} className="text-xs font-mono text-text-light/50">
                SYSTEM LOGS
              </GlitchText>
            </div>
            <LogTerminal />
          </div>

          {/* Map View */}
          <MapView />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* System Status Card */}
          <div className="glass-panel rounded-xl p-5 relative cyber-grid hologram-effect">
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-primary"></div>
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-primary"></div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-neon-primary rounded-full animate-pulse"></span>
              <GlitchText speed={1.2} enableShadows={true} enableOnHover={true} className="text-lg font-orbitron font-bold text-neon-primary">
                SYSTEM STATUS
              </GlitchText>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-black/30 rounded border border-neon-primary/20">
                <span className="text-text-light/70 font-mono text-xs">AI ENGINE</span>
                <span className="text-neon-primary font-orbitron font-bold text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-neon-primary rounded-full animate-pulse"></span>
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/30 rounded border border-neon-primary/20">
                <span className="text-text-light/70 font-mono text-xs">THREAT DETECTION</span>
                <span className="text-neon-primary font-orbitron font-bold text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-neon-primary rounded-full animate-pulse"></span>
                  ENABLED
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/30 rounded border border-neon-primary/20">
                <span className="text-text-light/70 font-mono text-xs">RECORDING</span>
                <span className="text-red-400 font-orbitron font-bold text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                  STANDBY
                </span>
              </div>
            </div>
          </div>

          {/* Feed Status */}
          <div className="glass-panel rounded-xl p-4 relative cyber-grid">
            <DotLottieReact
              src="https://lottie.host/e526a0d6-1020-4e86-af17-651afcae34c2/sNyhCrZleE.lottie"
              loop
              autoplay
            />
          </div>

          {/* Network Health */}
          <div className="glass-panel rounded-xl p-4 relative cyber-grid data-stream">
            <NetworkHealth />
          </div>

          {/* Quick Stats */}
          <div className="glass-panel rounded-xl p-5 relative cyber-grid">
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-primary"></div>
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-primary"></div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-neon-primary rounded-full animate-pulse"></span>
              <GlitchText speed={1.2} enableShadows={true} enableOnHover={true} className="text-lg font-orbitron font-bold text-neon-primary">
                QUICK STATS
              </GlitchText>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-neon-primary/10 to-transparent rounded border border-neon-primary/20">
                <div className="text-text-light/50 font-mono text-xs mb-1">TOTAL DETECTIONS</div>
                <div className="text-3xl font-orbitron font-black text-neon-primary cyber-number">122</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-red-500/10 to-transparent rounded border border-red-500/20">
                <div className="text-text-light/50 font-mono text-xs mb-1">THREATS DETECTED</div>
                <div className="text-3xl font-orbitron font-black text-red-400 cyber-number">20</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-yellow-500/10 to-transparent rounded border border-yellow-500/20">
                <div className="text-text-light/50 font-mono text-xs mb-1">UPTIME</div>
                <div className="text-2xl font-orbitron font-black text-yellow-400 cyber-number">99.8%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
