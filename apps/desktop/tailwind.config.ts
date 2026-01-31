import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import tailwindcssTypography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn-inspired theme using CSS variables
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Cores principais Jurisiar - Azul Marinho (profissional jurídico)
        primary: {
          DEFAULT: '#1e3a5f', // Azul marinho principal
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#1e3a5f',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        // Cores de destaque Jurisiar - Dourado (elegância jurídica)
        accent: {
          DEFAULT: '#c9a227', // Dourado principal
          foreground: 'hsl(var(--accent-foreground))',
          hover: 'hsl(var(--accent-foreground))',
          blue: '#3397FC', // Keep for backward compatibility
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#c9a227',
          600: '#b8860b',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Legacy aliases for backward compatibility
        'background-card': 'hsl(var(--card))',
        'background-subtle': 'hsl(var(--muted))',
        'background-muted': 'hsl(var(--muted))',
        'text': 'hsl(var(--foreground))',
        'text-secondary': 'hsl(var(--foreground))',
        'text-muted': 'hsl(var(--muted-foreground))',
        'text-subtle': 'hsl(var(--muted-foreground))',
        'border-strong': 'hsl(var(--border))',
        // Cores de status Jurisiar
        danger: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          subtle: 'hsl(var(--destructive) / 0.1)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          subtle: '#fef4e6',
        },
        success: {
          DEFAULT: '#22c55e',
          subtle: '#e6f7ef',
        },
        error: '#ef4444',
        info: '#3b82f6',
      },
      boxShadow: {
        sm: '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)',
        DEFAULT: '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)',
        md: '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)',
        lg: '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)',
        xl: '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)',
        '2xl': '0 1px 3px 0px hsl(0 0% 0% / 0.25)',
        // Legacy shadows for backward compatibility
        input: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'input-focus': '0 0 0 2px hsl(var(--ring) / 0.2)',
        card: '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)',
        'card-hover': '0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)',
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        DEFAULT: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        // Legacy border radius for backward compatibility
        input: 'var(--radius)',
        card: 'var(--radius)',
        chip: '9999px',
        button: 'var(--radius)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'DM Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'Merriweather',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'Times',
          'serif',
        ],
      },
      transitionTimingFunction: {
        'accomplish': 'cubic-bezier(0.64, 0, 0.78, 0)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'spin-ccw': 'spinCcw 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        spinCcw: {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssTypography],
};

export default config;
