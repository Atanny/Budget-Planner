/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-page':    '#f2f8f4',
        'bg-surface': '#ffffff',
        'bg-card':    '#ffffff',
        'bg-subtle':  '#eef6f1',
        'g-500':      '#22703a',
        'g-400':      '#2d9e50',
        'g-300':      '#4cbb6e',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
