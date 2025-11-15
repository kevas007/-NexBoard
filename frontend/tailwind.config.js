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
        // Palette NexBoard (primaire)
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0FB5B3',
          600: '#0FB5B3',
          700: '#0A8F8C',
          800: '#0A8F8C',
          900: '#0A8F8C',
          950: '#0A8F8C',
        },
        // Palette NexBoard (accent)
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#FF8A1D',
          600: '#FF8A1D',
          700: '#E06F00',
          800: '#E06F00',
          900: '#E06F00',
          950: '#E06F00',
        },
        // Couleurs NexBoard personnalisées
        ink: '#0E1F28',
        surface: '#F8FAFC',
        muted: '#5F6B76',
        border: '#E5E7EB',
        // Gris Slate (neutre) - conservé pour compatibilité
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      borderRadius: {
        '2xl': '1rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
