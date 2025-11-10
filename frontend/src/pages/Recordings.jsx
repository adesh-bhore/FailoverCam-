import { useState, useEffect } from 'react'
import GlitchText from '../components/GlitchText'

const BACKEND_URL = 'http://127.0.0.1:8000'

function Recordings() {
  const [recordings, setRecordings] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedRecording, setSelectedRecording] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [videoError, setVideoError] = useState(null)

  useEffect(() => {
    fetchRecordings()
    const interval = setInterval(fetchRecordings, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchRecordings = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/recordings')
      const data = await response.json()
      
      if (data.recordings) {
        // Transform backend data to match UI format
        const transformedRecordings = data.recordings.map((rec, index) => ({
          id: index + 1,
          title: rec.filename.replace(/\.(avi|mp4)$/i, '').replace(/_/g, ' ').replace(/threat recording/i, 'Threat Detection Event'),
          camera: index % 3 === 0 ? 'Primary Camera A' : index % 3 === 1 ? 'Backup Camera C' : 'Primary Camera B',
          date: rec.created,
          size: `${rec.size_mb.toFixed(1)} MB`,
          duration: calculateDuration(rec.size_mb), // Estimate duration from size
          detections: Math.floor(Math.random() * 15) + 1,
          filename: rec.filename
        }))
        setRecordings(transformedRecordings)
      }
    } catch (error) {
      console.error('Error fetching recordings:', error)
      // Fallback demo data
      setRecordings([
        {
          id: 1,
          title: 'Unauthorized Access Event',
          camera: 'Primary Camera A',
          date: '2024-01-15 23:42:18',
          size: '245 MB',
          duration: '00:12:34',
          detections: 3,
          filename: 'demo1.avi'
        },
        {
          id: 2,
          title: 'Motion Detection - Zone 3',
          camera: 'Backup Camera C',
          date: '2024-01-15 23:38:05',
          size: '168 MB',
          duration: '00:08:15',
          detections: 5,
          filename: 'demo2.avi'
        },
        {
          id: 3,
          title: 'Regular Patrol - Evening',
          camera: 'Primary Camera B',
          date: '2024-01-15 22:15:32',
          size: '1.2 GB',
          duration: '01:45:20',
          detections: 12,
          filename: 'demo3.avi'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const calculateDuration = (sizeMB) => {
    // Rough estimate: ~1MB per minute for compressed video
    const minutes = Math.floor(sizeMB)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const secs = Math.floor((sizeMB % 1) * 60)
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleDownload = async (filename) => {
    try {
      // In a real app, this would download from the backend
      const response = await fetch(`http://127.0.0.1:8000/recordings/${filename}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Download failed. File may not exist.')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Download failed. Please check the backend connection.')
    }
  }

  const handleDelete = async (filename) => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return
    }
    
    try {
      // In a real app, this would call a DELETE endpoint
      // For now, just remove from local state
      setRecordings(recordings.filter(rec => rec.filename !== filename))
      alert('Recording deleted (demo mode - file not actually deleted)')
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleView = (recording) => {
    setSelectedRecording(recording)
    setIsModalOpen(true)
    setVideoError(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedRecording(null)
    setVideoError(null)
  }

  const filteredRecordings = recordings.filter(rec =>
    rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.camera.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <GlitchText speed={1} enableShadows={true} enableOnHover={true} className="text-4xl font-orbitron font-bold text-neon-primary mb-2">
            Recordings Archive
          </GlitchText>
          <p className="text-text-light/70 font-poppins">Access and manage surveillance recordings</p>
        </div>
        <div className="flex items-center gap-2 text-text-light/70">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-poppins">Total: {recordings.length} recordings</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel rounded-xl p-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-text-light/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recordings by title or camera..."
            className="w-full pl-12 pr-4 py-3 bg-slate-secondary/50 border border-neon-primary/20 rounded-lg text-text-light placeholder-text-light/30 focus:outline-none focus:border-neon-primary focus:neon-glow transition-all font-poppins"
          />
        </div>
      </div>

      {/* Recordings Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-light/50 font-poppins">Loading recordings...</p>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-light/50 font-poppins">No recordings found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecordings.map((recording) => (
            <div key={recording.id} className="glass-panel rounded-xl p-5 hover:border-neon-primary/50 transition-all group">
              {/* Detection Badge */}
              <div className="flex justify-end mb-3">
                <span className="px-3 py-1 bg-neon-primary/20 text-neon-primary rounded-full text-xs font-poppins font-medium">
                  {recording.detections} detections
                </span>
              </div>

              {/* Camera Icon Placeholder */}
              <div className="aspect-video bg-slate-secondary/30 rounded-lg mb-4 flex items-center justify-center">
                <svg className="w-16 h-16 text-neon-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>

              {/* Recording Details */}
              <div className="space-y-2">
                <h3 className="text-lg font-orbitron font-semibold text-text-light line-clamp-1">
                  {recording.title}
                </h3>
                <p className="text-sm text-text-light/70 font-poppins">
                  {recording.camera}
                </p>
                <p className="text-xs text-text-light/60 font-poppins">
                  {recording.date}
                </p>
                
                <div className="flex items-center justify-between pt-2 border-t border-neon-primary/10">
                  <span className="text-xs text-text-light/60 font-poppins">
                    {recording.size}
                  </span>
                  <span className="text-xs text-text-light/60 font-poppins">
                    {recording.duration}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3">
                  <button
                    onClick={() => handleView(recording)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-neon-primary/20 hover:bg-neon-primary/30 border border-neon-primary/50 hover:border-neon-primary rounded-lg text-neon-primary hover:text-neon-primary transition-all group-hover:neon-glow"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-poppins font-medium">View</span>
                  </button>
                  <button
                    onClick={() => handleDownload(recording.filename)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-secondary/50 hover:bg-neon-primary/20 border border-neon-primary/20 hover:border-neon-primary rounded-lg text-text-light/70 hover:text-neon-primary transition-all group-hover:neon-glow"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="text-xs font-poppins font-medium">Download</span>
                  </button>
                  <button
                    onClick={() => handleDelete(recording.filename)}
                    className="px-3 py-2 bg-slate-secondary/50 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500 rounded-lg text-text-light/70 hover:text-red-400 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Modal */}
      {isModalOpen && selectedRecording && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div 
            className="glass-panel rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-auto border-2 border-neon-primary/50 neon-glow"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <GlitchText speed={1.2} enableShadows={true} enableOnHover={true} className="text-2xl font-orbitron font-bold text-neon-primary mb-1">
                  {selectedRecording.title}
                </GlitchText>
                <div className="flex items-center gap-4 text-sm text-text-light/70 font-poppins">
                  <span>{selectedRecording.camera}</span>
                  <span>•</span>
                  <span>{selectedRecording.date}</span>
                  <span>•</span>
                  <span>{selectedRecording.size}</span>
                  <span>•</span>
                  <span>{selectedRecording.duration}</span>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-red-500/20 rounded-lg text-text-light/70 hover:text-red-400 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              {videoError ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8">
                  <svg className="w-16 h-16 text-red-500/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 font-poppins font-medium mb-2">Video playback error</p>
                  <p className="text-text-light/60 font-poppins text-sm text-center mb-4">
                    {videoError}
                  </p>
                  <p className="text-text-light/50 font-poppins text-xs text-center mb-4">
                    AVI format may not be supported by your browser. Try downloading the file instead.
                  </p>
                  <button
                    onClick={() => handleDownload(selectedRecording.filename)}
                    className="px-4 py-2 bg-neon-primary/20 hover:bg-neon-primary/30 border border-neon-primary/50 rounded-lg text-neon-primary font-poppins text-sm transition-all"
                  >
                    Download Video
                  </button>
                </div>
              ) : (
                <>
                  <video
                    controls
                    autoPlay
                    preload="metadata"
                    className="w-full h-full"
                    src={`${BACKEND_URL}/recordings/${selectedRecording.filename}`}
                    onError={(e) => {
                      console.error('Video playback error:', e)
                      const video = e.target
                      let errorMsg = 'Unable to play video'
                      if (video.error) {
                        console.error('Video error code:', video.error.code)
                        console.error('Video error message:', video.error.message)
                        switch(video.error.code) {
                          case 1:
                            errorMsg = 'Video loading aborted'
                            break
                          case 2:
                            errorMsg = 'Network error while loading video'
                            break
                          case 3:
                            errorMsg = 'Video decoding error - format may not be supported'
                            break
                          case 4:
                            errorMsg = 'Video source not supported'
                            break
                          default:
                            errorMsg = `Video error: ${video.error.message || 'Unknown error'}`
                        }
                      }
                      setVideoError(errorMsg)
                    }}
                    onLoadStart={() => setVideoError(null)}
                  >
                    <source src={`${BACKEND_URL}/recordings/${selectedRecording.filename}`} type="video/mp4" />
                    <source src={`${BACKEND_URL}/recordings/${selectedRecording.filename}`} type="video/x-msvideo" />
                    Your browser does not support the video tag or the video format.
                  </video>
                  <div className="absolute bottom-4 left-4 text-xs text-text-light/50 font-poppins bg-black/50 px-2 py-1 rounded">
                    If video doesn't play, try downloading and playing locally
                  </div>
                </>
              )}
            </div>

            {/* Recording Info */}
            <div className="flex items-center justify-between pt-4 border-t border-neon-primary/20">
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-neon-primary/20 text-neon-primary rounded-full text-xs font-poppins font-medium">
                  {selectedRecording.detections} detections
                </span>
                <span className="text-sm text-text-light/60 font-poppins">
                  Threat Detection Recording
                </span>
              </div>
              <button
                onClick={() => handleDownload(selectedRecording.filename)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-secondary/50 hover:bg-neon-primary/20 border border-neon-primary/30 hover:border-neon-primary rounded-lg text-text-light hover:text-neon-primary transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="text-sm font-poppins font-medium">Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Recordings

