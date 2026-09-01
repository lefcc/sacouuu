/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#5f4c9a',
          'purple-dark': '#4a3a7a',
          'purple-light': '#8b7bbf',
          beige: '#f7f6fb',
          green: '#6fb755',
          'green-dark': '#5a9645',
          lightGreen: '#9de87a',
          dark: '#1e1740',
          'dark-surface': '#1e1a2e',
          'dark-deeper': '#13111e',
          'dark-border': '#2a2440',
          'dark-input': '#261f3a',
          muted: '#7c6fa0',
          'muted-dark': '#9080b8',
          border: '#ece8f5',
          'input-bg': '#f4f2fa',
          red: '#e05a6a',
          amber: '#f5a623',
        }
      },
      fontFamily: {
        title: ['"Baloo Tamma 2"', 'cursive'],
        body: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
