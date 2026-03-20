import type { Config } from 'tailwindcss';

/**
 * tailwind.config.ts
 *
 * ALL values reference design tokens via CSS custom properties.
 * Never add hardcoded hex, px, or rem values here.
 * Add tokens to design-tokens/tokens.json first, then reference them here.
 */

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    // ── Colours ────────────────────────────────────────────────────────────
    // All reference CSS custom properties from design-tokens/tokens.css
    // Changing a token value propagates everywhere automatically
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      brand: {
        primary:        'var(--color-brand-primary)',
        'primary-hover':'var(--color-brand-primary-hover)',
        'primary-subtle':'var(--color-brand-primary-subtle)',
        accent:         'var(--color-brand-accent)',
        'accent-hover': 'var(--color-brand-accent-hover)',
        'accent-subtle':'var(--color-brand-accent-subtle)',
      },

      surface: {
        background:     'var(--color-surface-background)',
        'background-alt':'var(--color-surface-background-alt)',
        1:              'var(--color-surface-surface-1)',
        2:              'var(--color-surface-surface-2)',
        3:              'var(--color-surface-surface-3)',
      },

      text: {
        primary:    'var(--color-text-primary)',
        secondary:  'var(--color-text-secondary)',
        tertiary:   'var(--color-text-tertiary)',
        inverse:    'var(--color-text-inverse)',
        'on-accent':'var(--color-text-on-accent)',
        link:       'var(--color-text-link)',
        'link-hover':'var(--color-text-link-hover)',
      },

      border: {
        DEFAULT: 'var(--color-border-default)',
        strong:  'var(--color-border-strong)',
        focus:   'var(--color-border-focus)',
      },

      semantic: {
        success:         'var(--color-semantic-success)',
        'success-subtle':'var(--color-semantic-success-subtle)',
        warning:         'var(--color-semantic-warning)',
        'warning-subtle':'var(--color-semantic-warning-subtle)',
        error:           'var(--color-semantic-error)',
        'error-subtle':  'var(--color-semantic-error-subtle)',
      },
    },

    // ── Typography ─────────────────────────────────────────────────────────
    fontFamily: {
      sans: ['var(--typography-font-family-sans)'],
      mono: ['var(--typography-font-family-mono)'],
    },

    fontSize: {
      xs:   ['var(--typography-font-size-xs)',   { lineHeight: 'var(--typography-line-height-normal)' }],
      sm:   ['var(--typography-font-size-sm)',   { lineHeight: 'var(--typography-line-height-normal)' }],
      base: ['var(--typography-font-size-base)', { lineHeight: 'var(--typography-line-height-normal)' }],
      lg:   ['var(--typography-font-size-lg)',   { lineHeight: 'var(--typography-line-height-snug)' }],
      xl:   ['var(--typography-font-size-xl)',   { lineHeight: 'var(--typography-line-height-snug)' }],
      '2xl':['var(--typography-font-size-2xl)',  { lineHeight: 'var(--typography-line-height-snug)' }],
      '3xl':['var(--typography-font-size-3xl)',  { lineHeight: 'var(--typography-line-height-tight)' }],
      '4xl':['var(--typography-font-size-4xl)',  { lineHeight: 'var(--typography-line-height-tight)' }],
      '5xl':['var(--typography-font-size-5xl)',  { lineHeight: 'var(--typography-line-height-tight)' }],
      '6xl':['var(--typography-font-size-6xl)',  { lineHeight: 1 }],
    },

    fontWeight: {
      regular:  'var(--typography-font-weight-regular)',
      medium:   'var(--typography-font-weight-medium)',
      semibold: 'var(--typography-font-weight-semibold)',
      bold:     'var(--typography-font-weight-bold)',
    },

    // ── Spacing (4px grid) ─────────────────────────────────────────────────
    spacing: {
      '0':  'var(--spacing-0)',
      '1':  'var(--spacing-1)',
      '2':  'var(--spacing-2)',
      '3':  'var(--spacing-3)',
      '4':  'var(--spacing-4)',
      '5':  'var(--spacing-5)',
      '6':  'var(--spacing-6)',
      '8':  'var(--spacing-8)',
      '10': 'var(--spacing-10)',
      '12': 'var(--spacing-12)',
      '16': 'var(--spacing-16)',
      '20': 'var(--spacing-20)',
      '24': 'var(--spacing-24)',
      '32': 'var(--spacing-32)',
    },

    // ── Border radius ──────────────────────────────────────────────────────
    borderRadius: {
      none: 'var(--border-radius-none)',
      sm:   'var(--border-radius-sm)',
      DEFAULT: 'var(--border-radius-md)',
      md:   'var(--border-radius-md)',
      lg:   'var(--border-radius-lg)',
      xl:   'var(--border-radius-xl)',
      '2xl':'var(--border-radius-2xl)',
      '3xl':'var(--border-radius-3xl)',
      full: 'var(--border-radius-full)',
    },

    // ── Shadows ────────────────────────────────────────────────────────────
    boxShadow: {
      xs:   'var(--shadow-xs)',
      sm:   'var(--shadow-sm)',
      DEFAULT: 'var(--shadow-md)',
      md:   'var(--shadow-md)',
      lg:   'var(--shadow-lg)',
      xl:   'var(--shadow-xl)',
      '2xl':'var(--shadow-2xl)',
      none: 'none',
    },

    // ── Breakpoints ────────────────────────────────────────────────────────
    screens: {
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },

    extend: {
      // ── Transitions ──────────────────────────────────────────────────────
      transitionDuration: {
        fast:   'var(--animation-duration-fast)',
        normal: 'var(--animation-duration-normal)',
        slow:   'var(--animation-duration-slow)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--animation-easing-default)',
        spring:  'var(--animation-easing-spring)',
      },

      // ── Z-index ───────────────────────────────────────────────────────────
      zIndex: {
        dropdown: 'var(--z-index-dropdown)',
        sticky:   'var(--z-index-sticky)',
        overlay:  'var(--z-index-overlay)',
        modal:    'var(--z-index-modal)',
        toast:    'var(--z-index-toast)',
        tooltip:  'var(--z-index-tooltip)',
      },
    },
  },

  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config;
