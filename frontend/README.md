# SentinelVision AI - Security Surveillance Console

A futuristic, real-time AI Security Surveillance Dashboard built with React, Tailwind CSS, and Vite.

## Features

- 🔐 **Authentication Portal** - Camera authentication with IP/Port configuration
- 📊 **Real-time Dashboard** - Live camera feeds with AI detection overlays
- 🚨 **Security Alerts** - Color-coded alert system (Critical, Warning, Info)
- 📁 **Recordings Archive** - Access and manage surveillance recordings from local folder
- 🎨 **Futuristic UI** - Dark theme with neon highlights and glassmorphism effects

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Google Fonts** - Orbitron, Poppins, Inter

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm/yarn
- Backend server running on `http://127.0.0.1:8000` (see `esp-stream-backend/main.py`)

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.jsx      # Top navigation bar
│   │   ├── Sidebar.jsx     # Left navigation menu
│   │   └── Layout.jsx      # Main layout wrapper
│   ├── pages/
│   │   ├── AuthPage.jsx    # Camera authentication
│   │   ├── Dashboard.jsx   # Main dashboard with feeds
│   │   ├── Alerts.jsx      # Security alerts page
│   │   └── Recordings.jsx  # Recordings archive
│   ├── App.jsx             # Main app with routing
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Backend Integration

The frontend expects the backend API to be running on `http://127.0.0.1:8000` with the following endpoints:

- `POST /camera/auth` - Camera authentication
- `GET /ai_feed` - MJPEG video stream
- `GET /logs/since/<timestamp>` - System logs
- `GET /recordings` - List recordings
- `GET /health` - System health status

## Design System

### Colors
- **Dark Base**: `#0b0f1a`
- **Neon Primary**: `#00ffc3` (aqua green)
- **Accent**: `#ff0066` (for alerts)
- **Secondary**: `#1e2533` (slate blue-gray)
- **Text**: `#dfe6e9` (light gray)

### Fonts
- **Headings**: Orbitron (futuristic)
- **Body**: Poppins/Inter (clean, readable)

### Effects
- Glassmorphism panels with backdrop blur
- Neon glow effects on active elements
- Smooth transitions and hover states
- Pulsing animations for active status indicators

## Development Notes

- The app uses localStorage for authentication state (demo mode)
- Recordings are fetched from the backend `/recordings` endpoint
- Live camera feed displays from `/ai_feed` MJPEG stream
- System logs are polled every 2 seconds for real-time updates

## License

MIT

