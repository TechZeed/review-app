/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        expertise: '#3B82F6',
        care: '#EC4899',
        delivery: '#22C55E',
        initiative: '#F97316',
        trust: '#8B5CF6',
      },
    },
  },
  plugins: [],
};
