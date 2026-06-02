/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ma-navy':  '#0F2044',
        'ma-red':   '#C44B38',
        'ma-green': '#1E6B40',
        'ma-gold':  '#C9883A',
        'ma-cream': '#F5F1EB',
        'ma-sand':  '#EDE8DE',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':       '0 1px 4px rgba(15,32,68,0.06), 0 0 0 1px rgba(15,32,68,0.05)',
        'card-hover': '0 8px 28px rgba(15,32,68,0.12), 0 0 0 1px rgba(15,32,68,0.08)',
        'nav':        '0 4px 20px rgba(15,32,68,0.22)',
      },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite linear',
      },
    },
  },
  plugins: [],
};
