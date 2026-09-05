---
name: material-design-system
description: >-
  Expert guide and practical design system tokens, components, and workflows based on
  Google Material Design 3 (Material You) and Google Web Design guidelines.
  Use when designing, building, or refactoring web interfaces, dashboards, modal dialogues,
  navigation systems, or creating CSS design tokens with accessible light/dark theme support.
---

# Material Design 3 (Material You) & Google Web Guidelines

This skill provides a standardized design system, token architecture, and UX guidelines based on Google's Material Design 3 (M3).

---

## 1. Core Principles

1. **Semantic Color Roles**: Never hardcode colors like `#ff0000` or `#0066ff`. Always use semantic color tokens (`primary`, `surface`, `on-surface`, `outline`, etc.).
2. **Tonal Elevation**: Communicate depth using tonal surface overlays (`surface-container-low`, `surface-container`, `surface-container-high`) rather than exaggerated black drop shadows.
3. **4px/8px Spatial Rhythm**: All margins, paddings, gap sizes, and heights should strictly follow multiples of 4px / 8px (4, 8, 12, 16, 24, 32, 48, 64).
4. **Accessible Typography Hierarchy**: Maintain structured scales (Display, Headline, Title, Body, Label) using high-legibility fonts (Inter, Roboto, Outfit, Google Sans).
5. **Purposeful Motion & State Feedback**: Interactive elements must provide immediate, smooth feedback using standard easing curves (`cubic-bezier(0.2, 0.0, 0, 1.0)`).

---

## 2. Color System & Design Tokens (CSS)

```css
:root {
  /* Primary & Accents */
  --md-sys-color-primary: #1a73e8;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #d2e3fc;
  --md-sys-color-on-primary-container: #041e49;

  /* Secondary */
  --md-sys-color-secondary: #5f6368;
  --md-sys-color-on-secondary: #ffffff;
  --md-sys-color-secondary-container: #e8eaed;
  --md-sys-color-on-secondary-container: #202124;

  /* Tertiary */
  --md-sys-color-tertiary: #188038;
  --md-sys-color-on-tertiary: #ffffff;
  --md-sys-color-tertiary-container: #ceead6;
  --md-sys-color-on-tertiary-container: #0d652d;

  /* Surfaces & Backgrounds (Light) */
  --md-sys-color-surface: #ffffff;
  --md-sys-color-on-surface: #202124;
  --md-sys-color-on-surface-variant: #5f6368;
  --md-sys-color-surface-container-lowest: #ffffff;
  --md-sys-color-surface-container-low: #f8f9fa;
  --md-sys-color-surface-container: #f1f3f4;
  --md-sys-color-surface-container-high: #e8eaed;
  --md-sys-color-surface-container-highest: #dadce0;

  /* Outlines & Borders */
  --md-sys-color-outline: #747775;
  --md-sys-color-outline-variant: #c4c7c5;

  /* Status Colors */
  --md-sys-color-error: #d93025;
  --md-sys-color-on-error: #ffffff;
  --md-sys-color-error-container: #fce8e6;
  --md-sys-color-on-error-container: #c5221f;

  /* Shape Radii */
  --md-shape-corner-xs: 4px;
  --md-shape-corner-sm: 8px;
  --md-shape-corner-md: 12px;
  --md-shape-corner-lg: 16px;
  --md-shape-corner-xl: 28px;
  --md-shape-corner-full: 9999px;

  /* Elevation Shadows */
  --md-sys-elevation-0: none;
  --md-sys-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05);
  --md-sys-elevation-2: 0 3px 6px rgba(0, 0, 0, 0.10), 0 2px 4px rgba(0, 0, 0, 0.06);
  --md-sys-elevation-3: 0 10px 20px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);

  /* Motion */
  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0.0, 0, 1.0);
  --md-sys-motion-duration-short: 150ms;
  --md-sys-motion-duration-medium: 300ms;
}

[data-theme="dark"], .dark-theme {
  --md-sys-color-primary: #8ab4f8;
  --md-sys-color-on-primary: #041e49;
  --md-sys-color-primary-container: #174ea6;
  --md-sys-color-on-primary-container: #d2e3fc;

  --md-sys-color-surface: #121212;
  --md-sys-color-on-surface: #e8eaed;
  --md-sys-color-on-surface-variant: #9aa0a6;
  --md-sys-color-surface-container-lowest: #0c0d0e;
  --md-sys-color-surface-container-low: #1a1a1c;
  --md-sys-color-surface-container: #202124;
  --md-sys-color-surface-container-high: #2d2f31;
  --md-sys-color-surface-container-highest: #3c4043;

  --md-sys-color-outline: #8e918f;
  --md-sys-color-outline-variant: #444746;
}
```

---

## 3. Standard Component Archetypes

### 1. Buttons
- **Filled Button**: Primary call-to-action (`background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); border-radius: var(--md-shape-corner-full)`).
- **Tonal Button**: Secondary actions (`background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container)`).
- **Outlined Button**: Alternative or dismissive actions (`border: 1px solid var(--md-sys-color-outline-variant)`).
- **Text Button**: Compact, low-emphasis actions (e.g., inside dialog footers or table rows).

### 2. Cards & Containers
- **Elevated Card**: Use `var(--md-sys-color-surface-container-low)` with `var(--md-sys-elevation-1)` and `border-radius: var(--md-shape-corner-lg)`.
- **Outlined Card**: Use `var(--md-sys-color-surface)` with `1px solid var(--md-sys-color-outline-variant)`.

### 3. Navigation
- **Navigation Bar / Rail / Drawer**: Adaptive navigation responding to screen width.
- **Active State Indicator**: Pill-shaped background container behind active icon/label with `var(--md-sys-color-primary-container)`.
- **Drawer vs Rail**: Full icon + label side-by-side when expanded (Desktop); centered icon only when collapsed (Rail).

### 4. Typography Scale (Google Material Design 3 Type Scale)

The Material 3 typography system defines 15 type styles across 5 roles to create clear visual hierarchy:

| Role & Level | Font Size | Line Height | Weight | Letter Spacing | Common Use Cases |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Large** | 57px | 64px | Regular (400) | -0.25px | Hero landing titles, key numbers |
| **Display Medium** | 45px | 52px | Regular (400) | 0px | Short high-impact headers |
| **Display Small** | 36px | 44px | Regular (400) | 0px | Prominent page titles |
| **Headline Large** | 32px | 40px | Regular (400) | 0px | Primary page headers (`<h1>`) |
| **Headline Medium** | 28px | 36px | Regular (400) | 0px | Section headers (`<h2>`) |
| **Headline Small** | 24px | 32px | Regular (400) | 0px | Subsection headers (`<h3>`) |
| **Title Large** | 22px | 28px | Regular (400) | 0px | Dialog & modal titles, top app bar |
| **Title Medium** | 16px | 24px | Medium (500) | +0.15px | Card titles, list section headers |
| **Title Small** | 14px | 20px | Medium (500) | +0.1px | Sub-item headers, group titles |
| **Body Large** | 16px | 24px | Regular (400) | +0.5px | Document body text, articles |
| **Body Medium** | 14px | 20px | Regular (400) | +0.25px | Standard UI text, descriptions |
| **Body Small** | 12px | 16px | Regular (400) | +0.4px | Captions, secondary helper text |
| **Label Large** | 14px | 20px | Medium (500) | +0.1px | Buttons, prominent tab labels |
| **Label Medium** | 12px | 16px | Medium (500) | +0.5px | Form labels, navigation badges, chips |
| **Label Small** | 11px | 16px | Medium (500) | +0.5px | Metadata tags, timestamp annotations |

---

### 5. Responsive Design & Window Size Classes (Google M3)

Material 3 replaces arbitrary screen breakpoints with standardized **Window Size Classes** for adaptive layouts:

| Window Size Class | Breakpoint Range | Grid Columns | Margin / Gutter | Navigation Pattern | Layout & Pane Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Compact** | `< 600px` | 4 cols | 16px / 16px | Bottom Navigation Bar / Modal Drawer | **Single-Pane**: Content stacked vertically, full-width cards, modals occupy full width or bottom sheet |
| **Medium** | `600px` – `839px` | 8 cols | 24px / 24px | Navigation Rail (collapsed, 80px) | **1 or 2 Panes**: Side-by-side elements when simple; responsive cards in 2 columns |
| **Expanded** | `840px` – `1199px` | 12 cols | 24px / 24px | Permanent Navigation Drawer (240–280px) | **Two-Pane (List-Detail)**: Sidebar list + Detail canvas side-by-side |
| **Large** | `1200px` – `1599px` | 12 cols | 24px / 24px | Navigation Drawer + Supporting Pane | **Three-Pane**: Navigation + Master editor + Right-side Inspector / AI drawer |
| **Extra-Large** | `$\ge$ 1600px` | 12 cols | 24px (bounded max 1440px) | Bounded centered container | **Bounded Multi-Pane**: Max width bounded to 1440px/1600px centered to prevent excessive eye travel |

#### Responsive Rules:
1. **Touch Targets vs Pointer**: On compact screens (touch), clickable targets MUST be $\ge 48\text{px} \times 48\text{px}$. On desktop/pointer screens, targets may be $36\text{px}$–$40\text{px}$.
2. **Fluid Typography vs Scaled Classes**: Body and titles scale smoothly across breakpoints using predefined tokens, never arbitrary fractional pixels.
3. **Pane Folding**: Multi-pane interfaces must fold gracefully into single-pane or stacked layouts as screen width drops below `840px`.

---

### 6. Iconography & Optical Sizes (Google Material Symbols)
- **Optical Sizes (opsz)**:
  - `icon-xs` (16px, opsz 20): Badges, pills, metadata tags.
  - `icon-sm` (20px, opsz 20): Compact buttons, inputs, context menus.
  - `icon-md` (24px, opsz 24): Navigation items, standard buttons, app bar (Standard M3).
  - `icon-lg` (32px, opsz 40): Section hero cards, modal status illustrations.
  - `icon-xl` (40px, opsz 48): Empty states.
- **Headings Rule**: Never put decorative icons in `<h1>`–`<h4>` titles. Keep typography clean.
- **Buttons Rule**: Leading icon + text for primary creations; text-only for standard dialogs; icon-only with tooltip for dense tables/close buttons.

---

## 7. Accessibility (A11y) & UX Checklist

- [ ] **Contrast Ratio**: Normal text $\ge$ 4.5:1, large headings $\ge$ 3:1 against their container.
- [ ] **Touch Target Size**: Minimum 36-40px (desktop) / 48x48px (mobile/touch) for clickable items.
- [ ] **Focus Rings**: Clear 2px focus indicators (`:focus-visible`) with adequate outline offset.
- [ ] **Descriptive Labels**: Semantic `aria-label` or visible text for icon-only buttons.
- [ ] **Smooth Transitions**: Use `transition: all var(--md-sys-motion-duration-short) var(--md-sys-motion-easing-standard)`.
