import { useState, useEffect, useRef } from 'react'
import GlitchText from './GlitchText'

function MapView() {
  const [cameraLocations, setCameraLocations] = useState([])
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markersRef = useRef([])
  const mapInitialized = useRef(false)

  // Check if Leaflet is loaded
  useEffect(() => {
    const checkLeaflet = setInterval(() => {
      if (window.L) {
        clearInterval(checkLeaflet)
        console.log('Leaflet loaded successfully')
      }
    }, 100)
    return () => clearInterval(checkLeaflet)
  }, [])

  useEffect(() => {
    // First, try to get browser's current location
    getCurrentLocation()
    fetchCameraLocations()

    // Listen for location updates from Settings page
    const handleLocationUpdate = () => {
      console.log('Location updated event received, refreshing map...')
      // Force refresh by clearing map and re-fetching
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        mapInitialized.current = false
        markersRef.current = []
      }
      // Small delay to ensure backend has updated
      setTimeout(() => {
        fetchCameraLocations()
      }, 500)
    }
    window.addEventListener('locationUpdated', handleLocationUpdate)
    
    return () => {
      window.removeEventListener('locationUpdated', handleLocationUpdate)
      // Clean up map
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        mapInitialized.current = false
      }
      markersRef.current = []
    }
  }, [])

  useEffect(() => {
    // Wait for Leaflet to load first
    if (!window.L) {
      const checkLeaflet = setInterval(() => {
        if (window.L) {
          clearInterval(checkLeaflet)
          // Trigger re-initialization once Leaflet is loaded
          if (cameraLocations.length > 0 && mapRef.current && !loading) {
            const validLocations = cameraLocations.filter(cam => cam.lat !== null && cam.lng !== null)
            if (validLocations.length > 0) {
              initializeOrUpdateMap()
            }
          }
        }
      }, 100)
      return () => clearInterval(checkLeaflet)
    }

    // Initialize or update map when camera locations are available
    if (cameraLocations.length > 0 && mapRef.current && !loading && window.L) {
      const validLocations = cameraLocations.filter(cam => cam.lat !== null && cam.lng !== null)
      if (validLocations.length > 0) {
        initializeOrUpdateMap()
      }
    }
  }, [cameraLocations, loading])

  const initializeOrUpdateMap = () => {
    if (!window.L || !mapRef.current) {
      console.log('Leaflet not ready or map container not available')
      return
    }

    const validLocations = cameraLocations.filter(cam => 
      cam.lat !== null && cam.lng !== null && 
      typeof cam.lat === 'number' && typeof cam.lng === 'number' &&
      !isNaN(cam.lat) && !isNaN(cam.lng)
    )
    
    if (validLocations.length === 0) {
      console.log('No valid locations to display')
      // If map exists but no valid locations, don't remove it, just log
      return
    }

    // Calculate map center from valid locations
    let center
    if (validLocations.length === 1) {
      center = [validLocations[0].lat, validLocations[0].lng]
    } else {
      const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length
      const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length
      center = [avgLat, avgLng]
    }

    console.log('Valid locations:', validLocations.map(l => ({ name: l.name, lat: l.lat, lng: l.lng })))
    console.log('Calculated center:', center)

    if (!leafletMapRef.current || !mapInitialized.current) {
      // Initialize new map
      console.log('Initializing new map at center:', center)
      initializeLeafletMap(center)
    } else {
      // Update existing map - remove old markers and add new ones
      console.log('Updating existing map with new markers')
      updateMapMarkers()
      // Also update center and zoom to show markers
      if (validLocations.length === 1) {
        leafletMapRef.current.setView([validLocations[0].lat, validLocations[0].lng], 19, { animate: true })
      } else {
        const bounds = window.L.latLngBounds(validLocations.map(loc => [loc.lat, loc.lng]))
        leafletMapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 19, animate: true })
        setTimeout(() => {
          if (leafletMapRef.current) {
            const currentZoom = leafletMapRef.current.getZoom()
            if (currentZoom < 17) {
              const center = bounds.getCenter()
              leafletMapRef.current.setView([center.lat, center.lng], 17, { animate: true })
            }
          }
        }, 300)
      }
    }
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.log('Geolocation error:', error)
        }
      )
    }
  }

  const fetchCameraLocations = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch camera locations with geolocation
      const response = await fetch('http://127.0.0.1:8000/camera/locations')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Fetched camera locations from backend:', data)
      
      if (data.success && data.cameras) {
        // Process camera locations - only use actual coordinates, no fallbacks
        const locations = data.cameras.map(camera => ({
          ...camera,
          lat: camera.lat, // Keep as-is (could be null)
          lng: camera.lng, // Keep as-is (could be null)
          status: camera.type === 'primary' ? 'active' : 'standby',
          signal: Math.floor(Math.random() * 30) + 70,
          needsConfig: camera.lat === null || camera.lng === null
        }))
        
        console.log('Processed locations:', locations)
        setCameraLocations(locations)
        
        // Check if any cameras need manual location configuration
        const needsConfig = locations.some(cam => cam.needsConfig)
        setShowLocationPrompt(needsConfig)
        
        // Update map center only if we have valid coordinates
        const validLocs = locations.filter(loc => loc.lat !== null && loc.lng !== null)
        if (validLocs.length > 0) {
          if (validLocs.length === 1) {
            setMapCenter([validLocs[0].lat, validLocs[0].lng])
            console.log('Set map center to single camera:', validLocs[0].lat, validLocs[0].lng)
          } else {
            const avgLat = validLocs.reduce((sum, loc) => sum + loc.lat, 0) / validLocs.length
            const avgLng = validLocs.reduce((sum, loc) => sum + loc.lng, 0) / validLocs.length
            setMapCenter([avgLat, avgLng])
            console.log('Set map center to average:', avgLat, avgLng)
          }
        } else {
          console.log('No valid coordinates found, map will show default location')
        }
        
        setLoading(false)
      } else {
        throw new Error(data.error || 'Failed to fetch camera locations')
      }
    } catch (error) {
      console.error('Error fetching camera locations:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  const initializeLeafletMap = (center) => {
    if (!window.L || !mapRef.current) {
      console.log('Leaflet not loaded or map container not available')
      return
    }

    const L = window.L
    const validLocations = cameraLocations.filter(cam => cam.lat !== null && cam.lng !== null)
    
    if (validLocations.length === 0) {
      console.log('No valid camera locations to display')
      return
    }

    if (!center) {
      // Calculate center from valid locations
      if (validLocations.length === 1) {
        center = [validLocations[0].lat, validLocations[0].lng]
      } else {
        const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length
        const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length
        center = [avgLat, avgLng]
      }
    }

    console.log('Initializing map with locations:', validLocations)
    console.log('Map center:', center)

    // Esri World Imagery (free satellite tiles, no API key needed)
    const esriWorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 20
    })

    // Determine initial zoom - start close for street view
    let initialZoom = 19 // Default to street level for single camera

    // Initialize map with center and zoom
    leafletMapRef.current = L.map(mapRef.current, {
      center: center,
      zoom: initialZoom,
      layers: [esriWorldImagery],
      zoomControl: true,
      attributionControl: true,
      minZoom: 3,
      maxZoom: 20
    })

    console.log('Map initialized, center:', leafletMapRef.current.getCenter(), 'zoom:', leafletMapRef.current.getZoom())

    // Style the map container
    const mapContainer = mapRef.current
    if (mapContainer) {
      mapContainer.style.zIndex = '1'
    }

    mapInitialized.current = true

    // Update markers and zoom after map is initialized
    setTimeout(() => {
      updateMapMarkers()
      // Ensure proper zoom after markers are added
      const currentZoom = leafletMapRef.current.getZoom()
      if (currentZoom < 17) {
        if (validLocations.length === 1) {
          leafletMapRef.current.setView([validLocations[0].lat, validLocations[0].lng], 19)
        } else {
          const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat, loc.lng]))
          leafletMapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 19 })
        }
      }
    }, 500)
  }

  const updateMapMarkers = () => {
    if (!leafletMapRef.current || !window.L) {
      console.log('Map not initialized or Leaflet not available')
      return
    }

    const L = window.L
    const validLocations = cameraLocations.filter(cam => cam.lat !== null && cam.lng !== null)
    if (validLocations.length === 0) {
      console.log('No valid locations to create markers')
      return
    }

    console.log('Updating markers for', validLocations.length, 'cameras')

    // Remove existing markers
    markersRef.current.forEach(marker => {
      if (marker && leafletMapRef.current) {
        try {
          leafletMapRef.current.removeLayer(marker)
        } catch (e) {
          console.error('Error removing marker:', e)
        }
      }
    })
    markersRef.current = []

    // Create bounds to fit all cameras
    const bounds = L.latLngBounds([])

    // Create markers for each camera
    validLocations.forEach((camera, index) => {
      const isPrimary = camera.type === 'primary'
      const markerColor = isPrimary ? '#00ffc3' : '#ffd700'
      
      console.log(`Creating marker ${index + 1} at ${camera.lat}, ${camera.lng} for ${camera.name}`)
      
      // Validate coordinates
      if (typeof camera.lat !== 'number' || typeof camera.lng !== 'number' || 
          isNaN(camera.lat) || isNaN(camera.lng) ||
          camera.lat < -90 || camera.lat > 90 || camera.lng < -180 || camera.lng > 180) {
        console.error(`Invalid coordinates for ${camera.name}:`, camera.lat, camera.lng)
        return
      }
      
      // Create custom icon with pulsing effect
      const cameraIcon = L.divIcon({
        className: 'custom-camera-marker',
        html: `
          <div style="
            width: 40px;
            height: 40px;
            background: ${markerColor};
            border: 4px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 20px ${markerColor}, 0 0 40px ${markerColor}80;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            cursor: pointer;
          ">
            <div style="
              width: 18px;
              height: 18px;
              background: #fff;
              border-radius: 50%;
              box-shadow: 0 0 8px rgba(0,0,0,0.8);
            "></div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      })

      try {
        const marker = L.marker([camera.lat, camera.lng], {
          icon: cameraIcon,
          title: camera.name,
          riseOnHover: true,
          zIndexOffset: 1000
        })

        marker.addTo(leafletMapRef.current)
        console.log(`✓ Marker added successfully for ${camera.name} at [${camera.lat}, ${camera.lng}]`)

        // Create popup with camera info
        const popupContent = `
        <div style="
          color: #fff;
          font-family: 'Orbitron', 'Courier New', monospace;
          background: rgba(0, 0, 0, 0.95);
          padding: 14px;
          border-radius: 8px;
          border: 2px solid ${markerColor};
          min-width: 240px;
          box-shadow: 0 0 20px ${markerColor}50;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid ${markerColor}30; padding-bottom: 10px;">
            <h3 style="margin: 0; color: ${markerColor}; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              ${camera.name}
            </h3>
            <span style="
              background: ${markerColor}20;
              color: ${markerColor};
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 10px;
              border: 1px solid ${markerColor};
              font-weight: bold;
              letter-spacing: 0.5px;
            ">
              ${camera.status.toUpperCase()}
            </span>
          </div>
          <div style="font-size: 12px; color: #ccc; font-family: 'Courier New', monospace; line-height: 1.9;">
            <div style="margin-bottom: 6px;"><strong style="color: #888;">IP:</strong> <span style="color: ${markerColor}; font-weight: bold;">${camera.ip}</span></div>
            <div style="margin-bottom: 6px;"><strong style="color: #888;">LOC:</strong> <span style="color: ${markerColor}">${camera.city || 'Unknown'}, ${camera.country || 'Unknown'}</span></div>
            <div style="margin-bottom: 10px;"><strong style="color: #888;">COORD:</strong> <span style="color: ${markerColor}; font-weight: bold;">${camera.lat.toFixed(6)}, ${camera.lng.toFixed(6)}</span></div>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid ${markerColor}20;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #888;"><strong>SIGNAL:</strong></span>
                <div style="flex: 1; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; border: 1px solid ${markerColor}30;">
                  <div style="height: 100%; width: ${camera.signal}%; background: ${markerColor}; border-radius: 5px; box-shadow: 0 0 10px ${markerColor}80; transition: width 0.3s;"></div>
                </div>
                <span style="color: ${markerColor}; font-weight: bold; font-size: 11px;">${camera.signal}%</span>
              </div>
            </div>
          </div>
        </div>
        `

        marker.bindPopup(popupContent, {
          className: 'camera-popup',
          maxWidth: 260,
          closeButton: true
        })

        bounds.extend([camera.lat, camera.lng])
        markersRef.current.push(marker)
      } catch (e) {
        console.error(`Error creating marker for ${camera.name}:`, e)
      }
    })

    console.log('All markers created, zooming to fit')

    // Zoom to markers with appropriate level for street view
    if (validLocations.length > 1) {
      // For multiple cameras, calculate distance
      const latRange = Math.max(...validLocations.map(loc => loc.lat)) - Math.min(...validLocations.map(loc => loc.lat))
      const lngRange = Math.max(...validLocations.map(loc => loc.lng)) - Math.min(...validLocations.map(loc => loc.lng))
      const maxRange = Math.max(latRange, lngRange)
      
      console.log('Camera range:', maxRange, 'degrees')
      
      if (maxRange < 0.001) {
        // Very close (<100m) - zoom to street level (zoom 19)
        const center = bounds.getCenter()
        console.log('Zooming to street level (19) at center:', center.lat, center.lng)
        leafletMapRef.current.setView([center.lat, center.lng], 19)
      } else if (maxRange < 0.01) {
        // Close (<1km) - zoom to neighborhood (zoom 18)
        const center = bounds.getCenter()
        console.log('Zooming to neighborhood level (18) at center:', center.lat, center.lng)
        leafletMapRef.current.setView([center.lat, center.lng], 18)
      } else {
        // Fit bounds but ensure minimum zoom for street view
        console.log('Fitting bounds with max zoom 19')
        leafletMapRef.current.fitBounds(bounds, { 
          padding: [60, 60],
          maxZoom: 19
        })
        // Ensure minimum zoom for street detail
        setTimeout(() => {
          const currentZoom = leafletMapRef.current.getZoom()
          console.log('Current zoom after fitBounds:', currentZoom)
          if (currentZoom < 17) {
            const center = bounds.getCenter()
            console.log('Zoom too low, setting to 17 at center:', center.lat, center.lng)
            leafletMapRef.current.setView([center.lat, center.lng], 17)
          }
        }, 300)
      }
    } else if (validLocations.length === 1) {
      // Single camera - zoom to street/house level (zoom 19)
      console.log('Single camera, zooming to street level (19) at:', validLocations[0].lat, validLocations[0].lng)
      leafletMapRef.current.setView([validLocations[0].lat, validLocations[0].lng], 19)
    }

    // Force map to invalidate size and redraw
    setTimeout(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize()
      }
    }, 500)
  }

  const useCurrentLocation = () => {
    if (currentLocation && leafletMapRef.current) {
      // Zoom in close for street/house detail (zoom 19)
      console.log('Using current location:', currentLocation)
      leafletMapRef.current.setView([currentLocation.lat, currentLocation.lng], 19)
    } else if (currentLocation) {
      console.log('Current location available but map not ready:', currentLocation)
    }
  }

  if (loading) {
    return (
      <div className="glass-panel rounded-xl p-4 relative cyber-grid h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-primary/20 border-t-neon-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-light/50 font-mono text-sm">LOADING MAP DATA...</p>
          {error && (
            <p className="text-red-400 text-xs mt-2 font-mono">ERROR: {error}</p>
          )}
        </div>
      </div>
    )
  }

  if (error && cameraLocations.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-5 relative cyber-grid">
        <div className="text-center py-8">
          <div className="text-red-400 text-lg font-orbitron mb-2">CONNECTION ERROR</div>
          <p className="text-text-light/50 font-mono text-sm mb-4">{error}</p>
          <button
            onClick={fetchCameraLocations}
            className="px-4 py-2 bg-neon-primary/20 border border-neon-primary text-neon-primary rounded-lg font-mono text-sm hover:bg-neon-primary/30 transition-all"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-xl p-5 relative">
      {/* Corner brackets */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-primary"></div>
      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-primary"></div>
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-neon-primary"></div>
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-neon-primary"></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-neon-primary rounded-full animate-pulse"></span>
            <GlitchText speed={1} enableShadows={true} enableOnHover={true} className="text-lg font-orbitron font-bold text-neon-primary">
              CAMERA LOCATIONS - SATELLITE VIEW
            </GlitchText>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showLocationPrompt && (
            <button
              onClick={useCurrentLocation}
              className="px-3 py-1 bg-yellow-500/20 border border-yellow-400 text-yellow-400 rounded text-xs font-mono hover:bg-yellow-500/30 transition-all"
            >
              USE CURRENT LOCATION
            </button>
          )}
          <div className="px-3 py-1 bg-black/30 rounded border border-neon-primary/20 text-xs font-mono text-neon-primary/70">
            FREE SATELLITE MAP
          </div>
        </div>
      </div>

      {/* Location Configuration Prompt */}
      {showLocationPrompt && cameraLocations.some(cam => cam.needsConfig) && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 font-mono text-xs mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>CAMERA LOCATIONS NEED CONFIGURATION</span>
          </div>
          <p className="text-text-light/70 font-mono text-xs">
            Set exact coordinates for cameras in Settings to see them on the map.
          </p>
        </div>
      )}

      {/* Leaflet Map Container */}
      <div 
        ref={mapRef}
        className="relative h-96 w-full rounded-lg border-2 border-neon-primary/30 overflow-hidden"
        style={{ minHeight: '384px', zIndex: 1 }}
      ></div>

      {/* Camera list */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {cameraLocations.map((camera) => (
          <div key={camera.id} className={`p-3 rounded-lg border ${camera.type === 'primary' ? 'border-neon-primary bg-neon-primary/5' : 'border-yellow-400/50 bg-yellow-400/5'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-orbitron font-bold ${camera.type === 'primary' ? 'text-neon-primary' : 'text-yellow-400'}`}>
                {camera.name}
              </span>
              <div className={`w-2 h-2 rounded-full ${camera.status === 'active' ? 'bg-neon-primary animate-pulse' : 'bg-yellow-400'}`}></div>
            </div>
            <div className="text-xs font-mono text-text-light/60 space-y-1">
              <div>{camera.ip}</div>
              <div>{camera.lat !== null && camera.lng !== null ? `${camera.lat.toFixed(4)}, ${camera.lng.toFixed(4)}` : 'Not configured'}</div>
              <div className="flex items-center gap-2">
                <span>SIGNAL:</span>
                <div className="flex-1 h-1 bg-slate-700 rounded-full">
                  <div 
                    className={`h-full ${camera.type === 'primary' ? 'bg-neon-primary' : 'bg-yellow-400'}`}
                    style={{width: `${camera.signal}%`}}
                  ></div>
                </div>
                <span className={`text-xs ${camera.type === 'primary' ? 'text-neon-primary' : 'text-yellow-400'}`}>{camera.signal}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaflet popup custom styles */}
      <style>{`
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.95) !important;
          border: 2px solid #00ffc3 !important;
        }
        .leaflet-container {
          background: #1a1a1a !important;
        }
        .custom-camera-marker {
          background: transparent !important;
          border: none !important;
        }
        .custom-camera-marker > div {
          animation: markerPulse 2s ease-in-out infinite;
        }
        @keyframes markerPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.1);
            opacity: 0.9;
          }
        }
        .leaflet-control-zoom {
          border: 1px solid rgba(0, 255, 195, 0.3) !important;
          background: rgba(0, 0, 0, 0.8) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(0, 255, 195, 0.1) !important;
          color: #00ffc3 !important;
          border: 1px solid rgba(0, 255, 195, 0.3) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(0, 255, 195, 0.2) !important;
        }
      `}</style>
    </div>
  )
}

export default MapView
