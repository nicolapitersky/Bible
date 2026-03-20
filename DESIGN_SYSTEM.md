# DESIGN_SYSTEM.md — Design System Constitution

> Every pixel of every product is governed by this document.
> There is exactly one place where colours, fonts, spacing, and visual decisions live.
> If you change it there, it changes everywhere. That is the contract.

---

## The Core Principle

**No hardcoded visual values. Ever. Anywhere.**

Not in component files. Not in inline styles. Not in Tailwind arbitrary values like `text-[#333]`.
Not in Flutter `Color(0xFF333333)`. Not in CSS `margin: 13px`.

Every visual value is a token. Tokens live in `design-tokens/tokens.json`.
Everything else references tokens.

This is how changing the brand colour from blue to teal takes 30 seconds and zero bugs.

---

## Token Schema

### Master Token File: `design-tokens/tokens.json`

```json
{
  "_meta": {
    "version": "1.0.0",
    "project": "{{PROJECT_NAME}}",
    "description": "Design tokens — the single source of truth for all visual values"
  },
  "color": {
    "brand": {
      "primary": { "value": "#0066FF", "description": "Primary brand colour" },
      "primary-hover": { "value": "#0052CC", "description": "Primary on hover" },
      "primary-subtle": { "value": "#E8F0FF", "description": "Subtle primary background" },
      "secondary": { "value": "#6B46C1", "description": "Secondary brand colour" },
      "accent": { "value": "#F59E0B", "description": "Accent / highlight colour" }
    },
    "semantic": {
      "success": { "value": "#10B981", "description": "Success states" },
      "success-subtle": { "value": "#D1FAE5", "description": "Success backgrounds" },
      "warning": { "value": "#F59E0B", "description": "Warning states" },
      "warning-subtle": { "value": "#FEF3C7", "description": "Warning backgrounds" },
      "error": { "value": "#EF4444", "description": "Error states" },
      "error-subtle": { "value": "#FEE2E2", "description": "Error backgrounds" },
      "info": { "value": "#3B82F6", "description": "Informational states" },
      "info-subtle": { "value": "#DBEAFE", "description": "Info backgrounds" }
    },
    "surface": {
      "background": { "value": "#FFFFFF", "description": "Page background" },
      "background-alt": { "value": "#F9FAFB", "description": "Alternative background" },
      "surface-1": { "value": "#FFFFFF", "description": "Cards, modals" },
      "surface-2": { "value": "#F3F4F6", "description": "Input backgrounds, secondary cards" },
      "surface-3": { "value": "#E5E7EB", "description": "Dividers, borders" }
    },
    "text": {
      "primary": { "value": "#111827", "description": "Primary text" },
      "secondary": { "value": "#6B7280", "description": "Secondary / muted text" },
      "tertiary": { "value": "#9CA3AF", "description": "Placeholder text, disabled" },
      "inverse": { "value": "#FFFFFF", "description": "Text on dark backgrounds" },
      "on-primary": { "value": "#FFFFFF", "description": "Text on brand primary" },
      "link": { "value": "#0066FF", "description": "Link colour" },
      "link-hover": { "value": "#0052CC", "description": "Link hover" }
    },
    "border": {
      "default": { "value": "#E5E7EB", "description": "Default borders" },
      "strong": { "value": "#D1D5DB", "description": "Strong borders, inputs" },
      "focus": { "value": "#0066FF", "description": "Focus ring colour" }
    }
  },
  "color-dark": {
    "surface": {
      "background": { "value": "#0F1117", "description": "Dark mode page background" },
      "background-alt": { "value": "#1A1D2E", "description": "Dark mode alt background" },
      "surface-1": { "value": "#1E2130", "description": "Dark mode cards, modals" },
      "surface-2": { "value": "#252840", "description": "Dark mode secondary surfaces" },
      "surface-3": { "value": "#2D3150", "description": "Dark mode dividers" }
    },
    "text": {
      "primary": { "value": "#F9FAFB", "description": "Dark mode primary text" },
      "secondary": { "value": "#9CA3AF", "description": "Dark mode secondary text" },
      "tertiary": { "value": "#6B7280", "description": "Dark mode placeholder" }
    }
  },
  "typography": {
    "font-family": {
      "sans": { "value": "'Inter', system-ui, -apple-system, sans-serif" },
      "mono": { "value": "'JetBrains Mono', 'Fira Code', monospace" }
    },
    "font-size": {
      "xs":   { "value": "12px", "description": "Captions, labels" },
      "sm":   { "value": "14px", "description": "Secondary text, input labels" },
      "base": { "value": "16px", "description": "Body text (default)" },
      "lg":   { "value": "18px", "description": "Lead text, large labels" },
      "xl":   { "value": "20px", "description": "Small headings" },
      "2xl":  { "value": "24px", "description": "Section headings" },
      "3xl":  { "value": "30px", "description": "Page headings" },
      "4xl":  { "value": "36px", "description": "Hero headings (desktop)" },
      "5xl":  { "value": "48px", "description": "Display headings (desktop)" }
    },
    "font-weight": {
      "regular": { "value": "400" },
      "medium":  { "value": "500" },
      "semibold": { "value": "600" },
      "bold":    { "value": "700" }
    },
    "line-height": {
      "tight":  { "value": "1.25", "description": "Headings" },
      "snug":   { "value": "1.375", "description": "Large text" },
      "normal": { "value": "1.5",   "description": "Body text" },
      "relaxed": { "value": "1.625", "description": "Long-form reading" }
    },
    "letter-spacing": {
      "tighter": { "value": "-0.05em", "description": "Large headings" },
      "tight":   { "value": "-0.025em" },
      "normal":  { "value": "0" },
      "wide":    { "value": "0.025em", "description": "Uppercase labels" },
      "wider":   { "value": "0.05em",  "description": "All-caps tracking" }
    }
  },
  "spacing": {
    "0":  { "value": "0px" },
    "1":  { "value": "4px",   "description": "Micro spacing" },
    "2":  { "value": "8px",   "description": "Tight spacing" },
    "3":  { "value": "12px" },
    "4":  { "value": "16px",  "description": "Default spacing unit" },
    "5":  { "value": "20px" },
    "6":  { "value": "24px",  "description": "Section inner spacing" },
    "8":  { "value": "32px",  "description": "Component padding" },
    "10": { "value": "40px" },
    "12": { "value": "48px",  "description": "Section spacing" },
    "16": { "value": "64px",  "description": "Large section spacing" },
    "20": { "value": "80px",  "description": "Page section gaps" },
    "24": { "value": "96px",  "description": "Hero spacing" }
  },
  "border-radius": {
    "none": { "value": "0" },
    "sm":   { "value": "4px",   "description": "Subtle rounding (inputs)" },
    "md":   { "value": "8px",   "description": "Standard (cards, buttons)" },
    "lg":   { "value": "12px",  "description": "Large cards, modals" },
    "xl":   { "value": "16px",  "description": "Feature cards" },
    "2xl":  { "value": "24px",  "description": "Large containers" },
    "full": { "value": "9999px", "description": "Pills, avatars, badges" }
  },
  "shadow": {
    "sm":  { "value": "0 1px 2px rgba(0,0,0,0.05)" },
    "md":  { "value": "0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06)" },
    "lg":  { "value": "0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)" },
    "xl":  { "value": "0 20px 25px rgba(0,0,0,0.10), 0 8px 10px rgba(0,0,0,0.04)" }
  },
  "animation": {
    "duration": {
      "instant":  { "value": "0ms" },
      "fast":     { "value": "150ms", "description": "Hover states, micro-interactions" },
      "normal":   { "value": "250ms", "description": "Standard transitions" },
      "slow":     { "value": "350ms", "description": "Page transitions, modals" },
      "slower":   { "value": "500ms", "description": "Complex animations" }
    },
    "easing": {
      "default":   { "value": "cubic-bezier(0.4, 0, 0.2, 1)", "description": "Standard ease" },
      "in":        { "value": "cubic-bezier(0.4, 0, 1, 1)",   "description": "Entering" },
      "out":       { "value": "cubic-bezier(0, 0, 0.2, 1)",   "description": "Leaving" },
      "spring":    { "value": "cubic-bezier(0.34, 1.56, 0.64, 1)", "description": "Bouncy" }
    }
  },
  "breakpoint": {
    "sm":  { "value": "640px",  "description": "Small devices" },
    "md":  { "value": "768px",  "description": "Tablets" },
    "lg":  { "value": "1024px", "description": "Desktops" },
    "xl":  { "value": "1280px", "description": "Large desktops" },
    "2xl": { "value": "1536px", "description": "Extra large" }
  },
  "z-index": {
    "base":     { "value": "0" },
    "raised":   { "value": "1" },
    "dropdown": { "value": "100" },
    "sticky":   { "value": "200" },
    "overlay":  { "value": "300" },
    "modal":    { "value": "400" },
    "toast":    { "value": "500" },
    "tooltip":  { "value": "600" }
  }
}
```

---

## Web Implementation: CSS Custom Properties

The bootstrap generates `design-tokens/tokens.css` from `tokens.json`.
This file is imported once in the root layout. All components use these variables.

```css
/* design-tokens/tokens.css — AUTO-GENERATED. Edit tokens.json, not this file. */
:root {
  /* Brand */
  --color-brand-primary: #0066FF;
  --color-brand-primary-hover: #0052CC;
  --color-brand-primary-subtle: #E8F0FF;
  --color-brand-secondary: #6B46C1;

  /* Semantic */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --text-base: 1rem;
  
  /* Spacing (4px base grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* etc. — all tokens become CSS variables */
}

[data-theme="dark"] {
  --color-surface-background: #0F1117;
  /* etc. */
}
```

---

## Flutter Implementation: ThemeData

The bootstrap generates `design-tokens/theme.dart` from `tokens.json`.

```dart
// design-tokens/theme.dart — AUTO-GENERATED. Edit tokens.json, not this file.
import 'package:flutter/material.dart';

abstract class AppTokens {
  // Colours
  static const Color brandPrimary = Color(0xFF0066FF);
  static const Color brandPrimaryHover = Color(0xFF0052CC);
  
  // Typography scale
  static const double textXs = 12.0;
  static const double textSm = 14.0;
  static const double textBase = 16.0;
  
  // Spacing
  static const double space1 = 4.0;
  static const double space2 = 8.0;
  static const double space4 = 16.0;
  
  // Border radius
  static const double radiusMd = 8.0;
  static const double radiusLg = 12.0;
  static const BorderRadius borderMd = BorderRadius.all(Radius.circular(radiusMd));
}

ThemeData buildAppTheme({required bool isDark}) => ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppTokens.brandPrimary,
    brightness: isDark ? Brightness.dark : Brightness.light,
  ),
  textTheme: const TextTheme(
    bodyMedium: TextStyle(fontSize: AppTokens.textBase, height: 1.5),
    // ...
  ),
);
```

---

## Component Library Rules

### The Component Contract
Every UI component in this project must:
1. Accept only token-referenced values for visual properties (via CSS variables or AppTokens)
2. Be documented with usage examples
3. Have at least the following variants covered: default, hover, active, focus, disabled, error
4. Work at all breakpoints
5. Pass accessibility checks (keyboard navigation, screen reader labels, colour contrast)
6. Be located in the project's designated component library path

### Before Creating a New Component
1. Check if the component already exists in the library
2. Check if an existing component can be extended with a prop
3. If truly new: propose the component's API (props/parameters) before implementing
4. Name it clearly: `PrimaryButton`, not `BlueButton` (names describe purpose, not appearance)

### Component File Structure (web)
```
components/
  Button/
    Button.tsx          ← component implementation
    Button.test.tsx     ← tests
    Button.stories.tsx  ← Storybook stories (if used)
    index.ts            ← re-export
```

### Banned Patterns
```tsx
// ❌ Hardcoded colour
<div style={{ color: '#333333' }}>

// ❌ Hardcoded spacing
<div style={{ padding: '13px 17px' }}>

// ❌ Tailwind arbitrary values
<div className="text-[#333] p-[13px]">

// ❌ One-off button style
<button style={{ background: 'blue', borderRadius: '5px' }}>

// ✅ Token reference
<div style={{ color: 'var(--color-text-primary)' }}>

// ✅ Token-based Tailwind (configured from tokens)
<div className="text-text-primary p-4">

// ✅ Component from library
<Button variant="primary" size="md">Click me</Button>
```

---

## UI/UX Principles

### Simplicity First
- One primary action per screen. Support actions are secondary.
- Maximum three font sizes visible simultaneously on any one screen.
- Maximum two brand colours prominent on any one screen (plus neutrals).
- When in doubt, remove. Complexity is added only when it solves a real user problem.

### Consistency is a Feature
- Same action, same visual treatment, everywhere.
- Same error, same error message format, everywhere.
- Same loading state, same loading treatment, everywhere.
- Surprise is an antipattern in UI.

### Responsive Design Order
- Design mobile first. Add complexity for larger screens.
- Test at 320px (small phone), 375px (standard phone), 768px (tablet), 1280px (desktop).
- Nothing breaks. Nothing overlaps. Nothing requires horizontal scrolling.

### Accessible by Default
- Colour alone never conveys meaning (pair with icon or text)
- All form inputs have visible labels (not just placeholder text)
- Interactive elements have visible focus states
- Touch targets minimum 44×44px
- Contrast ratio: 4.5:1 for normal text, 3:1 for large text (WCAG AA)

### Motion
- Respect `prefers-reduced-motion` — wrap all animations in this media query
- Animation durations from tokens only
- Animation serves communication, not decoration
- Page transitions: `--animation-duration-slow` (350ms)
- Micro-interactions: `--animation-duration-fast` (150ms)
