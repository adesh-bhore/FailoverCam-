import { useState, useEffect } from 'react'
import GlitchText from '../components/GlitchText'

function Settings() {
  const [cameraConfig, setCameraConfig] = useState({
    primary: { ip: '', port: '8080' },
    backup: { ip: '', port: '8080' }
  })
  const [activeCamera, setActiveCamera] = useState('primary')
  const [settings, setSettings] = useState({
    zoom: 0,
    brightness: 50,
    exposure: 50,
    focus: 50,
    whiteBalance: 50,
    torch: false,
    orientation: 0
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [batteryLevel, setBatteryLevel] = useState(null)
  const [locationSettings, setLocationSettings] = useState({
    primary: { lat: '', lng: '' },
    backup: { lat: '', lng: '' }
  })
  const [showLocationSettings, setShowLocationSettings] = useState(true) // Show by default
  const [needsLocationConfig, setNeedsLocationConfig] = useState(false)
  const [backupCameras, setBackupCameras] = useState([])
  const [showBackupCameraForm, setShowBackupCameraForm] = useState(false)
  const [newBackupCamera, setNewBackupCamera] = useState({
    ip: '',
    port: '8080',
    username: '',
    password: '',
    name: ''
  })
  const [testingCamera, setTestingCamera] = useState(false)

  useEffect(() => {
    fetchCameraConfig()
    fetchCameraLocations()
    fetchBackupCameras()
  }, [])

  const fetchCameraLocations = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/camera/locations')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.cameras) {
          const locations = {}
          let hasNullLocations = false
          data.cameras.forEach(camera => {
            // Ensure we always have a valid object structure
            locations[camera.type] = {
              lat: camera.lat !== null && camera.lat !== undefined ? camera.lat.toString() : '',
              lng: camera.lng !== null && camera.lng !== undefined ? camera.lng.toString() : ''
            }
            if (camera.lat === null || camera.lat === undefined || camera.lng === null || camera.lng === undefined) {
              hasNullLocations = true
            }
          })
          // Merge with existing state to preserve user input
          setLocationSettings(prev => {
            const merged = { ...prev }
            Object.keys(locations).forEach(key => {
              // Preserve user input: only update from API if both values are empty
              // Otherwise, merge API values only where user hasn't entered anything
              merged[key] = {
                lat: prev[key]?.lat && prev[key].lat.trim() !== '' 
                  ? prev[key].lat 
                  : locations[key].lat || '',
                lng: prev[key]?.lng && prev[key].lng.trim() !== '' 
                  ? prev[key].lng 
                  : locations[key].lng || ''
              }
            })
            return merged
          })
          setNeedsLocationConfig(hasNullLocations)
          // Auto-expand location settings if locations need configuration
          if (hasNullLocations) {
            setShowLocationSettings(true)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching camera locations:', error)
      setNeedsLocationConfig(true) // Show config if fetch fails
    }
  }

  useEffect(() => {
    fetchBatteryLevel()
    // Refresh battery level every 30 seconds
    const batteryInterval = setInterval(fetchBatteryLevel, 30000)
    return () => clearInterval(batteryInterval)
  }, [activeCamera])

  const fetchCameraConfig = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/camera/config')
      const data = await response.json()
      if (data.primary && data.backup) {
        setCameraConfig({
          primary: { ip: data.primary.ip, port: data.primary.port || '8080' },
          backup: { ip: data.backup.ip, port: data.backup.port || '8080' }
        })
      }
    } catch (error) {
      console.error('Error fetching camera config:', error)
    }
  }

  const fetchBackupCameras = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/backup-cameras')
      const data = await response.json()
      if (data.success) {
        setBackupCameras(data.backup_cameras || [])
      }
    } catch (error) {
      console.error('Error fetching backup cameras:', error)
    }
  }

  const testBackupCamera = async () => {
    if (!newBackupCamera.ip) {
      setToast({ message: 'Please enter an IP address', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    setTestingCamera(true)
    try {
      const response = await fetch('http://127.0.0.1:8000/backup-cameras/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: newBackupCamera.ip,
          port: newBackupCamera.port || '8080',
          username: newBackupCamera.username || '',
          password: newBackupCamera.password || ''
        })
      })
      const data = await response.json()
      if (data.success) {
        setToast({ message: 'Camera connection test successful!', type: 'success' })
        setTimeout(() => setToast(null), 3000)
      } else {
        setToast({ message: data.error || 'Camera connection test failed', type: 'error' })
        setTimeout(() => setToast(null), 5000)
      }
    } catch (error) {
      console.error('Error testing camera:', error)
      setToast({ message: 'Error testing camera connection', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setTestingCamera(false)
    }
  }

  const addBackupCamera = async () => {
    if (!newBackupCamera.ip) {
      setToast({ message: 'Please enter an IP address', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('http://127.0.0.1:8000/backup-cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: newBackupCamera.ip,
          port: newBackupCamera.port || '8080',
          username: newBackupCamera.username || '',
          password: newBackupCamera.password || '',
          name: newBackupCamera.name || `Backup Camera ${backupCameras.length + 1}`
        })
      })
      const data = await response.json()
      if (data.success) {
        setToast({ message: 'Backup camera added successfully!', type: 'success' })
        setTimeout(() => setToast(null), 3000)
        setNewBackupCamera({ ip: '', port: '8080', username: '', password: '', name: '' })
        setShowBackupCameraForm(false)
        await fetchBackupCameras()
      } else {
        setToast({ message: data.error || 'Failed to add backup camera', type: 'error' })
        setTimeout(() => setToast(null), 5000)
      }
    } catch (error) {
      console.error('Error adding backup camera:', error)
      setToast({ message: 'Error adding backup camera', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  const deleteBackupCamera = async (cameraId) => {
    if (!window.confirm('Are you sure you want to delete this backup camera?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`http://127.0.0.1:8000/backup-cameras/${cameraId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setToast({ message: 'Backup camera deleted successfully!', type: 'success' })
        setTimeout(() => setToast(null), 3000)
        await fetchBackupCameras()
      } else {
        setToast({ message: data.error || 'Failed to delete backup camera', type: 'error' })
        setTimeout(() => setToast(null), 3000)
      }
    } catch (error) {
      console.error('Error deleting backup camera:', error)
      setToast({ message: 'Error deleting backup camera', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  const fetchBatteryLevel = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/camera/${activeCamera}/battery`)
      const data = await response.json()
      if (data.battery !== undefined) {
        setBatteryLevel(data.battery)
      }
    } catch (error) {
      console.error('Error fetching battery level:', error)
      setBatteryLevel(null)
    }
  }

  const updateSetting = async (setting, value) => {
    setLoading(true)
    try {
      const response = await fetch(`http://127.0.0.1:8000/camera/${activeCamera}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting, value })
      })
      const data = await response.json()
      if (data.success) {
        setSettings(prev => ({ ...prev, [setting]: value }))
        setToast({ 
          message: `${setting.charAt(0).toUpperCase() + setting.slice(1)} updated successfully${data.endpoint ? ` (${data.method} ${data.endpoint.split('/').pop()})` : ''}`, 
          type: 'success' 
        })
        setTimeout(() => setToast(null), 3000)
      } else {
        const errorMsg = data.error || 'Failed to update setting'
        const suggestion = data.suggestion || 'Make sure the IP Webcam app has "Remote control" enabled in settings.'
        setToast({ 
          message: `${errorMsg}. ${suggestion}`, 
          type: 'error' 
        })
        setTimeout(() => setToast(null), 5000)
        console.error('Camera setting error:', data)
      }
    } catch (error) {
      console.error('Error updating setting:', error)
      setToast({ message: 'Failed to update setting', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  const toggleTorch = async () => {
    const newValue = !settings.torch
    await updateSetting('torch', newValue)
  }

  const handleSliderChange = (setting, value) => {
    setSettings(prev => ({ ...prev, [setting]: value }))
    // Debounce the API call
    clearTimeout(window[`${setting}Timeout`])
    window[`${setting}Timeout`] = setTimeout(() => {
      updateSetting(setting, value)
    }, 300)
  }

  const resetSettings = async () => {
    const defaultSettings = {
      zoom: 0,
      brightness: 50,
      exposure: 50,
      focus: 50,
      whiteBalance: 50,
      orientation: 0
    }
    setLoading(true)
    try {
      for (const [setting, value] of Object.entries(defaultSettings)) {
        await updateSetting(setting, value)
      }
      setToast({ message: 'Settings reset to default', type: 'success' })
      setTimeout(() => setToast(null), 3000)
    } catch (error) {
      console.error('Error resetting settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveLocation = async (cameraType) => {
    console.log('saveLocation called for:', cameraType, locationSettings)
    const location = locationSettings[cameraType]
    if (!location || !location.lat || !location.lng || location.lat.trim() === '' || location.lng.trim() === '') {
      setToast({ message: 'Please enter both latitude and longitude', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    const lat = parseFloat(location.lat.trim())
    const lng = parseFloat(location.lng.trim())

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setToast({ message: 'Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('http://127.0.0.1:8000/camera/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_type: cameraType,
          lat: lat,
          lng: lng
        })
      })
      const data = await response.json()
      if (data.success) {
        setToast({ message: `${cameraType} camera location saved successfully`, type: 'success' })
        setTimeout(() => setToast(null), 3000)
        // Refresh locations to check if all are configured
        await fetchCameraLocations()
        // Refresh map view
        window.dispatchEvent(new Event('locationUpdated'))
      } else {
        setToast({ message: data.error || 'Failed to save location', type: 'error' })
        setTimeout(() => setToast(null), 3000)
      }
    } catch (error) {
      console.error('Error saving location:', error)
      setToast({ message: 'Failed to save location', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  const useCurrentLocation = (cameraType) => {
    console.log('useCurrentLocation called for:', cameraType)
    if (navigator.geolocation) {
      setToast({ message: 'Getting your location...', type: 'info' })
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Got position:', position.coords)
          const newLocation = {
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6)
          }
          setLocationSettings(prev => {
            const updated = {
              ...prev,
              [cameraType]: newLocation
            }
            console.log('Updated location settings:', updated)
            return updated
          })
          setToast({ message: 'Location retrieved from browser', type: 'success' })
          setTimeout(() => setToast(null), 3000)
        },
        (error) => {
          console.error('Geolocation error:', error)
          setToast({ message: `Failed to get location: ${error.message}. Please enable location services.`, type: 'error' })
          setTimeout(() => setToast(null), 3000)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      setToast({ message: 'Geolocation is not supported by your browser', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    }
  }

  const currentIp = cameraConfig[activeCamera]?.ip || 'N/A'
  const currentPort = cameraConfig[activeCamera]?.port || '8080'

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg font-poppins ${
          toast.type === 'success' 
            ? 'bg-green-500/20 border border-green-500 text-green-400' 
            : 'bg-red-500/20 border border-red-500 text-red-400'
        }`}>
          {toast.message}
        </div>
      )}

      <div>
        <GlitchText speed={1} enableShadows={true} enableOnHover={true} className="text-4xl font-orbitron font-bold text-neon-primary mb-2">
          Camera Settings
        </GlitchText>
        <p className="text-text-light/70 font-poppins">Configure your IP webcam settings</p>
      </div>

      {/* Camera Selection */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <GlitchText speed={1.2} enableShadows={true} enableOnHover={true} className="text-xl font-orbitron font-semibold text-neon-primary">
            Select Camera
          </GlitchText>
          {batteryLevel !== null && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-secondary/50 rounded-lg">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-text-light font-poppins text-sm">
                Battery: <span className="text-neon-primary">{batteryLevel}%</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveCamera('primary')}
            className={`flex-1 px-4 py-3 rounded-lg font-poppins font-medium transition-all ${
              activeCamera === 'primary'
                ? 'bg-neon-primary/20 border-2 border-neon-primary text-neon-primary neon-glow'
                : 'bg-slate-secondary/50 border-2 border-transparent text-text-light/70 hover:border-neon-primary/50'
            }`}
          >
            Primary Camera
            <div className="text-xs mt-1 opacity-70">{currentIp}:{currentPort}</div>
          </button>
          <button
            onClick={() => setActiveCamera('backup')}
            className={`flex-1 px-4 py-3 rounded-lg font-poppins font-medium transition-all ${
              activeCamera === 'backup'
                ? 'bg-neon-primary/20 border-2 border-neon-primary text-neon-primary neon-glow'
                : 'bg-slate-secondary/50 border-2 border-transparent text-text-light/70 hover:border-neon-primary/50'
            }`}
          >
            Backup Camera
            <div className="text-xs mt-1 opacity-70">{cameraConfig.backup?.ip || 'N/A'}:{currentPort}</div>
          </button>
        </div>
      </div>

      {/* Camera Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zoom Control */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
              <h3 className="text-lg font-orbitron font-semibold text-neon-primary">Zoom</h3>
            </div>
            <span className="text-text-light/70 font-poppins text-sm">{settings.zoom}%</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSliderChange('zoom', Math.max(0, settings.zoom - 10))}
              className="px-3 py-2 bg-slate-secondary/50 rounded-lg text-neon-primary hover:bg-neon-primary/20 transition-all"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.zoom}
              onChange={(e) => handleSliderChange('zoom', parseInt(e.target.value))}
              className="flex-1 h-2 bg-slate-secondary/50 rounded-lg appearance-none cursor-pointer accent-neon-primary"
              disabled={loading}
            />
            <button
              onClick={() => handleSliderChange('zoom', Math.min(100, settings.zoom + 10))}
              className="px-3 py-2 bg-slate-secondary/50 rounded-lg text-neon-primary hover:bg-neon-primary/20 transition-all"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Brightness Control */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-lg font-orbitron font-semibold text-neon-primary">Brightness</h3>
            </div>
            <span className="text-text-light/70 font-poppins text-sm">{settings.brightness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.brightness}
            onChange={(e) => handleSliderChange('brightness', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-secondary/50 rounded-lg appearance-none cursor-pointer accent-neon-primary"
            disabled={loading}
          />
        </div>

        {/* Exposure Control */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <h3 className="text-lg font-orbitron font-semibold text-neon-primary">Exposure</h3>
            </div>
            <span className="text-text-light/70 font-poppins text-sm">{settings.exposure}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.exposure}
            onChange={(e) => handleSliderChange('exposure', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-secondary/50 rounded-lg appearance-none cursor-pointer accent-neon-primary"
            disabled={loading}
          />
        </div>

        {/* Focus Control */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h3 className="text-lg font-orbitron font-semibold text-neon-primary">Focus</h3>
            </div>
            <span className="text-text-light/70 font-poppins text-sm">{settings.focus}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.focus}
            onChange={(e) => handleSliderChange('focus', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-secondary/50 rounded-lg appearance-none cursor-pointer accent-neon-primary"
            disabled={loading}
          />
        </div>

        {/* White Balance Control */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <h3 className="text-lg font-orbitron font-semibold text-neon-primary">White Balance</h3>
            </div>
            <span className="text-text-light/70 font-poppins text-sm">{settings.whiteBalance}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.whiteBalance}
            onChange={(e) => handleSliderChange('whiteBalance', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-secondary/50 rounded-lg appearance-none cursor-pointer accent-neon-primary"
            disabled={loading}
          />
        </div>

        {/* Torch/Flash Control */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-lg font-orbitron font-semibold text-neon-primary">Flashlight</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-poppins font-medium ${
              settings.torch 
                ? 'bg-yellow-500/20 text-yellow-400' 
                : 'bg-slate-secondary/50 text-text-light/70'
            }`}>
              {settings.torch ? 'ON' : 'OFF'}
            </span>
          </div>
          <button
            onClick={toggleTorch}
            disabled={loading}
            className={`w-full px-4 py-3 rounded-lg font-poppins font-medium transition-all ${
              settings.torch
                ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400 hover:bg-yellow-500/30'
                : 'bg-slate-secondary/50 border-2 border-neon-primary/50 text-neon-primary hover:bg-neon-primary/20'
            }`}
          >
            {settings.torch ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
          </button>
        </div>
      </div>

      {/* Location Configuration */}
      <div className={`glass-panel rounded-xl p-5 relative cyber-grid ${needsLocationConfig ? 'border-2 border-yellow-400/50' : ''}`}>
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-primary"></div>
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-primary"></div>
        
        {/* Warning banner if locations need configuration */}
        {needsLocationConfig && (
          <div className="mb-4 p-3 bg-yellow-500/20 border-2 border-yellow-400/50 rounded-lg animate-pulse">
            <div className="flex items-center gap-2 text-yellow-400 font-mono text-sm mb-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-orbitron font-bold">LOCATION CONFIGURATION REQUIRED</span>
            </div>
            <p className="text-text-light/80 font-mono text-xs">
              Camera locations are not configured. Please set exact coordinates below to display cameras on the map.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <GlitchText speed={1.2} enableShadows={true} enableOnHover={true} className="text-lg font-orbitron font-bold text-neon-primary">
              CAMERA LOCATION CONFIGURATION
            </GlitchText>
            {needsLocationConfig && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs font-mono rounded border border-yellow-400/50">
                ACTION REQUIRED
              </span>
            )}
          </div>
          <button
            onClick={() => setShowLocationSettings(!showLocationSettings)}
            className="px-3 py-1 bg-neon-primary/20 border border-neon-primary text-neon-primary rounded text-xs font-mono hover:bg-neon-primary/30 transition-all"
          >
            {showLocationSettings ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {showLocationSettings && (
          <div className="space-y-4 relative z-10">
            {['primary', 'backup'].map((cameraType) => (
              <div key={cameraType} className="p-4 bg-black/30 rounded-lg border border-neon-primary/20 relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-orbitron font-bold text-neon-primary uppercase">
                    {cameraType === 'primary' ? 'PRIMARY CAMERA' : 'BACKUP CAMERA'}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      useCurrentLocation(cameraType)
                    }}
                    className="px-2 py-1 bg-yellow-500/20 border border-yellow-400 text-yellow-400 rounded text-xs font-mono hover:bg-yellow-500/30 transition-all z-10 relative cursor-pointer"
                  >
                    USE CURRENT LOC
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-mono text-text-light/70 mb-1" htmlFor={`lat-${cameraType}`}>
                      LATITUDE <span className="text-red-400">*</span>
                    </label>
                    <input
                      id={`lat-${cameraType}`}
                      type="number"
                      step="any"
                      value={locationSettings[cameraType]?.lat ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setLocationSettings(prev => ({
                          ...prev,
                          [cameraType]: { 
                            lat: value, 
                            lng: prev[cameraType]?.lng ?? '' 
                          }
                        }))
                      }}
                      className="w-full px-3 py-2.5 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow transition-all z-10 relative"
                      placeholder="28.6139"
                      min="-90"
                      max="90"
                      autoComplete="off"
                    />
                    <p className="text-xs text-text-light/50 font-mono mt-1">Range: -90 to 90</p>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-text-light/70 mb-1" htmlFor={`lng-${cameraType}`}>
                      LONGITUDE <span className="text-red-400">*</span>
                    </label>
                    <input
                      id={`lng-${cameraType}`}
                      type="number"
                      step="any"
                      value={locationSettings[cameraType]?.lng ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setLocationSettings(prev => ({
                          ...prev,
                          [cameraType]: { 
                            lat: prev[cameraType]?.lat ?? '', 
                            lng: value 
                          }
                        }))
                      }}
                      className="w-full px-3 py-2.5 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow transition-all z-10 relative"
                      placeholder="77.2090"
                      min="-180"
                      max="180"
                      autoComplete="off"
                    />
                    <p className="text-xs text-text-light/50 font-mono mt-1">Range: -180 to 180</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      saveLocation(cameraType)
                    }}
                    disabled={loading || !locationSettings[cameraType]?.lat || !locationSettings[cameraType]?.lng}
                    className="flex-1 px-4 py-2.5 bg-neon-primary/30 border-2 border-neon-primary text-neon-primary rounded font-mono text-sm font-bold hover:bg-neon-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:border-neon-primary/20 z-10 relative cursor-pointer"
                  >
                    {loading ? 'SAVING...' : 'SAVE LOCATION'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      useCurrentLocation(cameraType)
                    }}
                    className="px-4 py-2.5 bg-yellow-500/20 border-2 border-yellow-400 text-yellow-400 rounded font-mono text-xs hover:bg-yellow-500/30 transition-all z-10 relative cursor-pointer"
                  >
                    USE CURRENT
                  </button>
                </div>
                {locationSettings[cameraType]?.lat && locationSettings[cameraType]?.lng && (
                  <div className="mt-2 p-2 bg-neon-primary/10 border border-neon-primary/30 rounded text-xs font-mono text-neon-primary">
                    Current: {locationSettings[cameraType].lat}, {locationSettings[cameraType].lng}
                  </div>
                )}
              </div>
            ))}
            <div className="p-4 bg-slate-900/50 border border-neon-primary/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-2">
                  <p className="text-sm font-orbitron font-bold text-yellow-400 mb-2">HOW TO GET COORDINATES:</p>
                  <ol className="text-xs font-mono text-text-light/80 space-y-1.5 list-decimal list-inside">
                    <li>Open <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="text-neon-primary hover:underline">Google Maps</a></li>
                    <li>Navigate to your camera location</li>
                    <li>Right-click on the exact spot → Click on the coordinates</li>
                    <li>Copy and paste the coordinates above</li>
                    <li>Or click "USE CURRENT" to use your browser's location</li>
                  </ol>
                  <p className="text-xs font-mono text-text-light/60 mt-2 pt-2 border-t border-neon-primary/20">
                    Example: Delhi, India = 28.6139, 77.2090
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backup Camera Management */}
      <div className="glass-panel rounded-xl p-5 relative cyber-grid">
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-primary pointer-events-none"></div>
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-primary pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <GlitchText speed={1.2} enableShadows={true} enableOnHover={true} className="text-lg font-orbitron font-bold text-neon-primary">
              BACKUP CAMERA MANAGEMENT
            </GlitchText>
            <span className="ml-2 px-2 py-0.5 bg-neon-primary/20 text-neon-primary text-xs font-mono rounded border border-neon-primary/50">
              {backupCameras.length} CAMERA{backupCameras.length !== 1 ? 'S' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Add backup button clicked')
              setShowBackupCameraForm(!showBackupCameraForm)
              if (!showBackupCameraForm) {
                setNewBackupCamera({ ip: '', port: '8080', username: '', password: '', name: '' })
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-neon-primary/20 border-2 border-neon-primary text-neon-primary rounded-lg text-xs font-mono font-bold hover:bg-neon-primary/30 hover:border-neon-primary/80 active:bg-neon-primary/40 active:scale-95 transition-all cursor-pointer relative z-20 focus:outline-none focus:ring-2 focus:ring-neon-primary/50"
          >
            {showBackupCameraForm ? 'CANCEL' : '+ ADD BACKUP'}
          </button>
        </div>

        <div className="space-y-4 relative z-10">
          {/* Add Backup Camera Form */}
          {showBackupCameraForm && (
            <div className="p-4 bg-black/30 rounded-lg border border-neon-primary/20 mb-4">
              <h4 className="text-sm font-orbitron font-bold text-neon-primary uppercase mb-3">
                ADD NEW BACKUP CAMERA
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-mono text-text-light/70 mb-1">
                    CAMERA NAME
                  </label>
                  <input
                    type="text"
                    value={newBackupCamera.name}
                    onChange={(e) => setNewBackupCamera({ ...newBackupCamera, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow"
                    placeholder="Backup Camera 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-text-light/70 mb-1">
                    IP ADDRESS <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBackupCamera.ip}
                    onChange={(e) => setNewBackupCamera({ ...newBackupCamera, ip: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-text-light/70 mb-1">
                    PORT <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBackupCamera.port}
                    onChange={(e) => setNewBackupCamera({ ...newBackupCamera, port: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow"
                    placeholder="8080"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-text-light/70 mb-1">
                    USERNAME (Optional)
                  </label>
                  <input
                    type="text"
                    value={newBackupCamera.username}
                    onChange={(e) => setNewBackupCamera({ ...newBackupCamera, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow"
                    placeholder="admin"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-mono text-text-light/70 mb-1">
                    PASSWORD (Optional)
                  </label>
                  <input
                    type="password"
                    value={newBackupCamera.password}
                    onChange={(e) => setNewBackupCamera({ ...newBackupCamera, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/70 border-2 border-neon-primary/40 rounded text-text-light font-mono text-sm focus:outline-none focus:border-neon-primary focus:neon-glow"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={testBackupCamera}
                  disabled={testingCamera || !newBackupCamera.ip}
                  className="px-4 py-2 bg-yellow-500/20 border-2 border-yellow-400 text-yellow-400 rounded font-mono text-sm font-bold hover:bg-yellow-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingCamera ? 'TESTING...' : 'TEST CONNECTION'}
                </button>
                <button
                  onClick={addBackupCamera}
                  disabled={loading || !newBackupCamera.ip}
                  className="flex-1 px-4 py-2 bg-neon-primary/30 border-2 border-neon-primary text-neon-primary rounded font-mono text-sm font-bold hover:bg-neon-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'ADDING...' : 'ADD BACKUP CAMERA'}
                </button>
              </div>
            </div>
          )}

          {/* Backup Cameras List */}
          {backupCameras.length === 0 ? (
            <div className="p-4 bg-slate-900/50 border border-neon-primary/30 rounded-lg text-center">
              <p className="text-text-light/70 font-mono text-sm">
                No backup cameras configured. Click "ADD BACKUP" to add one.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backupCameras.map((camera) => (
                <div key={camera.id} className="p-4 bg-black/30 rounded-lg border border-neon-primary/20 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <h4 className="text-sm font-orbitron font-bold text-neon-primary">
                        {camera.name || `Backup Camera ${camera.id}`}
                      </h4>
                    </div>
                    <p className="text-xs font-mono text-text-light/70">
                      {camera.ip}:{camera.port}
                      {camera.username && ` (${camera.username})`}
                    </p>
                    {camera.added_at && (
                      <p className="text-xs font-mono text-text-light/50 mt-1">
                        Added: {new Date(camera.added_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteBackupCamera(camera.id)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-500/20 border border-red-500 text-red-400 rounded text-xs font-mono hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    DELETE
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-slate-900/50 border border-neon-primary/30 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="space-y-2">
                <p className="text-sm font-orbitron font-bold text-yellow-400 mb-2">HOW BACKUP CAMERAS WORK:</p>
                <ul className="text-xs font-mono text-text-light/80 space-y-1 list-disc list-inside">
                  <li>When the primary camera fails, the system automatically tries backup cameras in order</li>
                  <li>If backup camera 1 fails, it tries backup camera 2, and so on</li>
                  <li>After trying all backups, it loops back to the primary camera</li>
                  <li>Test the connection before adding to ensure it works</li>
                  <li>Cameras with authentication require username and password</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={resetSettings}
          disabled={loading}
          className="px-6 py-3 bg-red-500/20 border-2 border-red-500 text-red-400 rounded-lg font-poppins font-medium hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}

export default Settings

