/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0e14',
          panel: '#11161f',
          border: '#1e2630',
          muted: '#5c6b7a',
          text: '#c9d4e0',
          accent: '#2dd4bf',
        },
        up: '#26d97f',
        down: '#ff5470',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
