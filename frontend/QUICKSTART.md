# Quick Start Guide

## Getting Started

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Backend Server** (in a separate terminal)
   ```bash
   cd esp-stream-backend
   python main.py
   ```
   The backend should run on `http://127.0.0.1:8000`

3. **Start Frontend Dev Server**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

4. **Access the Application**
   - Open `http://localhost:5173` in your browser
   - You'll be redirected to the Auth page
   - Enter camera credentials (or use defaults) and click "Connect Camera Feed"
   - You'll be redirected to the Dashboard

## Pages Overview

### 🔐 Auth Page (`/auth`)
- Camera authentication portal
- Enter camera IP, port, and authentication key
- Supports RTSP, HTTP, and WebRTC protocols

### 📊 Dashboard (`/dashboard`)
- Live camera feeds (Primary and Backup)
- Real-time system terminal logs
- Feed status indicators
- AI detection summaries

### 🚨 Alerts (`/alerts`)
- Security alerts with severity levels
- Filter by Critical, Warning, or Info
- Acknowledge active alerts

### 📁 Recordings (`/recordings`)
- Browse surveillance recordings
- Search by title or camera name
- Download or delete recordings
- Shows detection count, file size, and duration

## Backend Endpoints Used

- `POST /camera/auth` - Camera authentication
- `GET /ai_feed` - MJPEG video stream
- `GET /logs/since/<timestamp>` - System logs
- `GET /recordings` - List recordings
- `GET /health` - System health status

## Troubleshooting

**Camera feed not showing?**
- Make sure the backend is running
- Check that the camera URL is accessible
- Verify CORS settings in the backend

**Recordings not loading?**
- Ensure the `recordings` folder exists in the backend directory
- Check backend logs for errors
- Verify the `/recordings` endpoint is working

**Styling issues?**
- Clear browser cache
- Run `npm install` again to ensure all dependencies are installed
- Check that Tailwind CSS is properly configured

## Customization

### Colors
Edit `tailwind.config.js` to change the color scheme:
- `dark-base`: Background color
- `neon-primary`: Primary accent (aqua green)
- `neon-accent`: Alert color (red)

### Fonts
Fonts are loaded from Google Fonts in `index.html`. You can change them there.

## Production Build

```bash
npm run build
```

The production files will be in the `dist` directory.

