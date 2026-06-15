/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          600: '#1a4a8a',
          700: '#143d75',
          800: '#0f2d5c',
          900: '#091e3d',
        },
        gold: {
          300: '#f0cc6e',
          400: '#e8b84b',
          500: '#c8a951',
          600: '#a88930',
        },
      },
    },
  },
  plugins: [],
}
