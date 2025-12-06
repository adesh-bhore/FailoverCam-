# Voice Alerts Implementation - Quick Test Guide

## Testing Voice Announcements

### Quick Test (Recommended)

Since you have the frontend dev server already running, let's test the voice alerts:

**Option 1: Test with Backend Running**

1. **Start Backend** (in new terminal):
   ```bash
   cd d:\AI-CP\esp-stream-backend
   python main.py
   ```

2. **Open Browser**: Go to `http://localhost:5173`

3. **Authenticate**: Login with your primary camera

4. **Go to Dashboard**: Click "Watch Stream" button

5. **Trigger Failover**:
   - **Stop your primary camera** (close IP Webcam app or disconnect WiFi)
   - **Wait 5-10 seconds**
   - **Expected**: Voice will announce: *"Adesh Attention !! Camera failover detected, switching to backup"*

**Option 2: Test Voice Without Failover**

Open browser console (F12) and type:
```javascript
// Import the voice announcer (if you're on Dashboard page)
const testVoice = () => {
  const utterance = new SpeechSynthesisUtterance("Adesh Attention !! Camera failover detected, switching to backup")
  utterance.lang = 'en-US'
  window.speechSynthesis.speak(utterance)
}
testVoice()
```

### Voice Settings Location

The VoiceAnnouncer is enabled by default. You can:
- **Disable**: `localStorage.setItem('voiceAlertsEnabled', 'false')`
- **Enable**: `localStorage.setItem('voiceAlertsEnabled', 'true')`
- **Check status**: `localStorage.getItem('voiceAlertsEnabled')`

Run these commands in browser console (F12) on any page.

### What Was Implemented

**Backend Changes:**
- ✅ Added `speak_message` parameter to `add_alert()` function
- ✅ Added voice alerts in `handle_blackout_failover()` (blackout detection)
- ✅ Added voice alerts in `failover_watcher()` (connection failure)

**Frontend Changes:**
- ✅ Created `VoiceAnnouncer.js` utility (Web Speech API)
- ✅ Integrated into `Dashboard.jsx` to monitor alerts
- ✅ Automatically speaks when failover alert detected

**Message**: "Adesh Attention !! Camera failover detected, switching to backup"

### Troubleshooting

**No voice?**
1. Check browser volume is not muted
2. Check system volume
3. Open browser console (F12) - look for "🔊 Voice alert triggered:" message
4. Try the manual test in Option 2 above
5. Some browsers block audio on first load - interact with page first (click something)

**Browser Compatibility:**
- ✅ Chrome/Edge (Best support)
- ✅ Firefox
- ✅ Safari
- ❌ Older IE browsers

### Files Modified

**Backend:**
- `d:\AI-CP\esp-stream-backend\main.py` (3 changes)

**Frontend:**
- `d:\AI-CP\frontend\src\components\VoiceAnnouncer.js` (NEW)
- `d:\AI-CP\frontend\src\pages\Dashboard.jsx` (2 changes)

---

Ready to test! 🎤
