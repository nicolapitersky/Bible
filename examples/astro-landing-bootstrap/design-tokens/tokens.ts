/**
 * design-tokens/tokens.ts
 * AUTO-GENERATED — do not edit.
 * Source: design-tokens/tokens.json
 * Generated: 2026-03-19T07:39:35.965Z
 */

// Use these constants for runtime token access (animations, JS calculations)
// For CSS: use var(--token-name) instead

export const tokens = {
  color: {
    brand: {
      primary: '#0A0A0A',
      primaryHover: '#262626',
      primarySubtle: '#F5F5F5',
      accent: '#6366F1',
      accentHover: '#4F46E5',
      accentSubtle: '#EEF2FF',
    },
    semantic: {
      success: '#10B981',
      successSubtle: '#D1FAE5',
      warning: '#F59E0B',
      warningSubtle: '#FEF3C7',
      error: '#EF4444',
      errorSubtle: '#FEE2E2',
    },
    surface: {
      background: '#FFFFFF',
      backgroundAlt: '#FAFAFA',
      surface-1: '#FFFFFF',
      surface-2: '#F5F5F5',
      surface-3: '#E5E5E5',
    },
    text: {
      primary: '#0A0A0A',
      secondary: '#525252',
      tertiary: '#A3A3A3',
      inverse: '#FFFFFF',
      onAccent: '#FFFFFF',
      link: '#6366F1',
      linkHover: '#4F46E5',
    },
    border: {
      default: '#E5E5E5',
      strong: '#D4D4D4',
      focus: '#6366F1',
    },
  },
  typography: {
    fontFamily: {
      sans: ''Inter', system-ui, -apple-system, sans-serif',
      mono: ''JetBrains Mono', 'Fira Code', monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      2xl: '1.5rem',
      3xl: '1.875rem',
      4xl: '2.25rem',
      5xl: '3rem',
      6xl: '3.75rem',
    },
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.1',
      snug: '1.25',
      normal: '1.5',
      relaxed: '1.7',
    },
    letterSpacing: {
      tighter: '-0.04em',
      tight: '-0.02em',
      normal: '0',
      wide: '0.05em',
      wider: '0.1em',
    },
  },
  spacing: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
    32: '128px',
  },
  borderRadius: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    2xl: '24px',
    3xl: '32px',
    full: '9999px',
  },
  shadow: {
    xs: '0 1px 2px rgba(0,0,0,0.04)',
    sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
    lg: '0 10px 15px rgba(0,0,0,0.07), 0 4px 6px rgba(0,0,0,0.04)',
    xl: '0 20px 25px rgba(0,0,0,0.08), 0 8px 10px rgba(0,0,0,0.04)',
    2xl: '0 25px 50px rgba(0,0,0,0.12)',
  },
  animation: {
    duration: {
      instant: '0ms',
      fast: '150ms',
      normal: '250ms',
      slow: '350ms',
      slower: '500ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  breakpoint: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    2xl: '1536px',
  },
  zIndex: {
    base: '0',
    raised: '1',
    dropdown: '100',
    sticky: '200',
    overlay: '300',
    modal: '400',
    toast: '500',
    tooltip: '600',
  },
} as const;

export type Tokens = typeof tokens;