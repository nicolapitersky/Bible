import type { Config } from 'tailwindcss';

/**
 * tailwind.config.ts
 * All values reference CSS custom properties from design-tokens/tokens.css.
 * Never hardcode colours or spacing here.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      brand: {
        primary:         'var(--color-brand-primary)',
        'primary-hover': 'var(--color-brand-primary-hover)',
        'primary-subtle':'var(--color-brand-primary-subtle)',
        accent:          'var(--color-brand-accent)',
        'accent-hover':  'var(--color-brand-accent-hover)',
        'accent-subtle': 'var(--color-brand-accent-subtle)',
      },
      surface: {
        background:      'var(--color-surface-background)',
        'background-alt':'var(--color-surface-background-alt)',
        1:               'var(--color-surface-surface-1)',
        2:               'var(--color-surface-surface-2)',
        3:               'var(--color-surface-surface-3)',
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
        success:          'var(--color-semantic-success)',
        'success-subtle': 'var(--color-semantic-success-subtle)',
        warning:          'var(--color-semantic-warning)',
        'warning-subtle': 'var(--color-semantic-warning-subtle)',
        error:            'var(--color-semantic-error)',
        'error-subtle':   'var(--color-semantic-error-subtle)',
      },
    },
    fontFamily: {
      sans: ['var(--typography-font-family-sans)'],
      mono: ['var(--typography-font-family-mono)'],
    },
    fontSize: {
      xs:   ['var(--typography-font-size-xs)',   { lineHeight: '1.5' }],
      sm:   ['var(--typography-font-size-sm)',   { lineHeight: '1.5' }],
      base: ['var(--typography-font-size-base)', { lineHeight: '1.5' }],
      lg:   ['var(--typography-font-size-lg)',   { lineHeight: '1.375' }],
      xl:   ['var(--typography-font-size-xl)',   { lineHeight: '1.375' }],
      '2xl':['var(--typography-font-size-2xl)',  { lineHeight: '1.25' }],
      '3xl':['var(--typography-font-size-3xl)',  { lineHeight: '1.1' }],
      '4xl':['var(--typography-font-size-4xl)',  { lineHeight: '1.1' }],
    },
    spacing: {
      '0':'var(--spacing-0)', '1':'var(--spacing-1)', '2':'var(--spacing-2)',
      '3':'var(--spacing-3)', '4':'var(--spacing-4)', '5':'var(--spacing-5)',
      '6':'var(--spacing-6)', '8':'var(--spacing-8)', '10':'var(--spacing-10)',
      '12':'var(--spacing-12)','16':'var(--spacing-16)','20':'var(--spacing-20)',
    },
    borderRadius: {
      none:'var(--border-radius-none)', sm:'var(--border-radius-sm)',
      DEFAULT:'var(--border-radius-md)', md:'var(--border-radius-md)',
      lg:'var(--border-radius-lg)', xl:'var(--border-radius-xl)',
      '2xl':'var(--border-radius-2xl)', full:'var(--border-radius-full)',
    },
    extend: {
      transitionDuration: {
        fast:   'var(--animation-duration-fast)',
        normal: 'var(--animation-duration-normal)',
        slow:   'var(--animation-duration-slow)',
      },
    },
  },
  plugins: [],
} satisfies Config;
