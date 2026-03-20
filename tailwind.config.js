/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fbfbf2',
          100: '#fbfbf2',
          /** Neutral divider / borders (was pink; use foil/mint for accents) */
          200: '#e2dfd6',
          300: '#c9c5bc',
        },
        /** Loading skeletons, empty media placeholders */
        charcoal: {
          DEFAULT: '#363b42',
          light: '#4a515a',
          dark: '#25282c',
        },
        ink: {
          900: '#2c3e50',
          700: '#3f5264',
          500: '#65788a',
          300: '#95a8bb',
        },
        foil: {
          DEFAULT: '#bf0e14',
          light: '#f1928f',
          dark: '#8f0a0f',
        },
        mint: {
          DEFAULT: '#dc7c74',
          light: '#f1928f',
          dark: '#bf0e14',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(26, 25, 20, 0.06)',
        cardHover: '0 8px 24px rgba(26, 25, 20, 0.1)',
      },
    },
  },
  plugins: [],
}
