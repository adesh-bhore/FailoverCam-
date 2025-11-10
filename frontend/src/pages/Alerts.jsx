import { useState, useEffect } from 'react'
import GlitchText from '../components/GlitchText'

const BACKEND_URL = 'http://127.0.0.1:8000'

function Alerts() {
  const [filter, setFilter] = useState('all')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch alerts from backend
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/alerts`)
        if (response.ok) {
          const data = await response.json()
          setAlerts(data)
        } else {
          console.error('Failed to fetch alerts')
        }
      } catch (error) {
        console.error('Error fetching alerts:', error)
      } finally {
        setLoading(false)
      }
    }

    // Fetch alerts immediately
    fetchAlerts()

    // Poll for new alerts every 2 seconds
    const interval = setInterval(fetchAlerts, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleAcknowledge = async (id) => {
    try {
      const response = await fetch(`${BACKEND_URL}/alerts/acknowledge/${id}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        // Update local state
        setAlerts(alerts.map(alert => 
          alert.id === id ? { ...alert, acknowledged: true, status: 'resolved' } : alert
        ))
      } else {
        console.error('Failed to acknowledge alert')
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error)
    }
  }

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.type === filter)

  const getAlertStyles = (type, status) => {
    if (type === 'critical') {
      return {
        border: 'border-red-500/50',
        glow: 'neon-glow-red',
        iconBg: 'bg-red-500',
        statusBg: status === 'active' ? 'bg-red-500' : 'bg-green-500',
        statusText: 'text-white'
      }
    } else if (type === 'warning') {
      return {
        border: 'border-yellow-500/50',
        glow: '',
        iconBg: 'bg-yellow-500',
        statusBg: status === 'active' ? 'bg-yellow-500' : 'bg-green-500',
        statusText: 'text-white'
      }
    } else {
      return {
        border: 'border-green-500/50',
        glow: '',
        iconBg: 'bg-green-500',
        statusBg: 'bg-green-500',
        statusText: 'text-white'
      }
    }
  }

  const getIcon = (iconType) => {
    if (iconType === 'X') {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )
    } else if (iconType === '!') {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    } else {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <GlitchText speed={1} enableShadows={true} enableOnHover={true} className="text-4xl font-orbitron font-bold text-neon-primary mb-2">
          Security Alerts
        </GlitchText>
        <p className="text-text-light/70 font-poppins">Monitor and manage system alerts</p>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-text-light/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-2 rounded-lg font-poppins text-sm transition-all ${
              filter === 'critical'
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-slate-secondary/50 text-text-light/70 border border-transparent hover:border-red-500/30'
            }`}
          >
            Critical
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg font-poppins text-sm transition-all ${
              filter === 'warning'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'bg-slate-secondary/50 text-text-light/70 border border-transparent hover:border-yellow-500/30'
            }`}
          >
            Warning
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-4 py-2 rounded-lg font-poppins text-sm transition-all ${
              filter === 'info'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-slate-secondary/50 text-text-light/70 border border-transparent hover:border-green-500/30'
            }`}
          >
            Info
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => {
          const styles = getAlertStyles(alert.type, alert.status)
          return (
            <div
              key={alert.id}
              className={`glass-panel rounded-xl p-6 border-2 ${styles.border} ${styles.glow} transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center text-white flex-shrink-0`}>
                  {getIcon(alert.icon)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-xl font-orbitron font-semibold text-text-light mb-2">
                    {alert.title}
                  </h3>
                  <p className="text-text-light/70 font-poppins mb-3">
                    {alert.description}
                  </p>
                  
                  {/* Show detected objects if available */}
                  {alert.detected_objects && alert.detected_objects.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {alert.detected_objects.map((obj, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-poppins font-medium border border-red-500/30"
                        >
                          {obj}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 flex-wrap">
                    {alert.timestamp && (
                      <span className="text-sm text-text-light/60 font-poppins">
                        {alert.timestamp}
                      </span>
                    )}
                    {alert.camera && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-text-light/60 font-poppins">
                          {alert.camera}
                        </span>
                      </div>
                    )}
                    {alert.confidence && (
                      <span className="text-sm text-text-light/60 font-poppins">
                        Confidence: {alert.confidence}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-3">
                  <span className={`px-4 py-2 rounded-lg text-sm font-poppins font-medium ${styles.statusBg} ${styles.statusText} ${
                    alert.status === 'active' ? 'animate-pulse' : ''
                  }`}>
                    {alert.status === 'active' ? 'Active' : 'Resolved'}
                  </span>
                  {alert.status === 'active' && !alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-4 py-2 bg-slate-secondary/50 hover:bg-slate-secondary/70 text-text-light rounded-lg text-sm font-poppins transition-all"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-text-light/50 font-poppins">Loading alerts...</p>
        </div>
      )}

      {!loading && filteredAlerts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-light/50 font-poppins">No alerts found for this filter.</p>
        </div>
      )}
    </div>
  )
}

export default Alerts

