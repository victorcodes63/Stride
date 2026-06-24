/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Stride coral — CTAs, charts, links */
        primary: {
          50: 'var(--color-primary-50, #FFF5F2)',
          100: 'var(--color-primary-100, #FFE9E4)',
          200: 'var(--color-primary-200, #FFCFC4)',
          300: 'var(--color-primary-300, #FFA894)',
          400: 'var(--color-primary-400, #FF7A5C)',
          500: 'var(--color-primary-500, #FF5436)',
          600: 'var(--color-primary-600, #E63E22)',
          700: 'var(--color-primary-700, #C9341B)',
          800: 'var(--color-primary-800, #A32A16)',
          900: 'var(--color-primary-900, #7D2010)',
        },
        /** Ink — structural brand, nav active, headings */
        secondary: {
          50: 'var(--color-secondary-50, #F4EFE8)',
          100: 'var(--color-secondary-100, #E6DED4)',
          200: 'var(--color-secondary-200, #D8CDBF)',
          300: 'var(--color-secondary-300, #B8ADA0)',
          400: 'var(--color-secondary-400, #8A8076)',
          500: 'var(--color-secondary-500, #1A1714)',
          600: 'var(--color-secondary-600, #141210)',
          700: 'var(--color-secondary-700, #0F0D0C)',
          800: 'var(--color-secondary-800, #0A0908)',
          900: 'var(--color-secondary-900, #050504)',
        },
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        success: '#15803D',
        warning: '#B45309',
        danger: '#B91C1C',
        ink: '#1A1714',
        'brand-gray': '#242220',
        /** Public marketing surface — Stride palette */
        pub: {
          primary: '#FF5436',
          'primary-hover': '#E63E22',
          'primary-subtle': '#FFE9E4',
          'primary-muted': '#FFCFC4',
          ink: '#1A1714',
          'ink-muted': '#3D3833',
          'ink-subtle': '#8A8076',
          surface: '#FBF8F4',
          'surface-muted': '#F4EFE8',
          border: '#E6DED4',
          'border-strong': '#D8CDBF',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-bricolage)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-bricolage)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        pub: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26, 23, 20, 0.04)',
        medium: '0 4px 12px rgba(26, 23, 20, 0.06)',
        large: '0 12px 32px rgba(26, 23, 20, 0.10)',
      },
    },
  },
  plugins: [],
}
