/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-base': '#0b0f1a',
        'neon-primary': '#00ffc3',
        'neon-accent': '#ff0066',
        'slate-secondary': '#1e2533',
        'text-light': '#dfe6e9',
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'poppins': ['Poppins', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 8px #00ffc3',
        'neon-lg': '0 0 20px #00ffc3',
        'neon-red': '0 0 8px #ff0066',
        'neon-red-lg': '0 0 20px #ff0066',
      },
      backdropBlur: {
        'glass': '20px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00ffc3, 0 0 10px #00ffc3' },
          '100%': { boxShadow: '0 0 10px #00ffc3, 0 0 20px #00ffc3, 0 0 30px #00ffc3' },
        },
      },
    },
  },
  plugins: [],
}

