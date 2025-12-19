/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        success: '#16A34A',
        danger: '#EF4444',
        text: '#0F172A',
        bg: '#FFFFFF',
        borderNeutral: 'rgba(0,0,0,0.08)'
      },
    },
  },
  plugins: [],
};
