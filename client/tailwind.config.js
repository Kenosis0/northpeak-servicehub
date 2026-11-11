/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        northpeak: {
          navy: '#0F172A',
          slate: '#1E293B',
          arctic: '#0284C7',
          sky: '#38BDF8',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444'
        }
      }
    }
  },
  plugins: []
};
