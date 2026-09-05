---
description: Enforce Material Design 3 and Google Web Design standards across all UI files (HTML, CSS, JS)
globs: ui/**/*
---

# UI Design & Material Design 3 Standards

When creating, editing, or refactoring user interfaces, dashboards, modal dialogues, and styling in this repository, always adhere to the following rules:

1. **Design Tokens First**:
   - Reference variables defined in `ui/css/design-tokens.css`.
   - Never introduce ad-hoc hardcoded hex values (e.g., `#ffffff`, `#333333`, `#007bff`) or arbitrary pixel values when a design token exists.

2. **Color Roles & Contrast**:
   - Maintain semantic roles (`--md-sys-color-primary`, `--md-sys-color-surface`, `--md-sys-color-on-surface`, `--md-sys-color-outline-variant`).
   - Ensure all text passes WCAG AA contrast standards ($\ge 4.5:1$ for body, $\ge 3:1$ for large headings).

3. **Shapes & Spatial Rhythm**:
   - Spacing (padding, margin, gap) MUST strictly be multiples of 4px or 8px (e.g. 4px, 8px, 12px, 16px, 24px, 32px).
   - Use standard border-radius tokens: `var(--md-shape-corner-xs)` (4px), `var(--md-shape-corner-sm)` (8px), `var(--md-shape-corner-md)` (12px), `var(--md-shape-corner-lg)` (16px), `var(--md-shape-corner-xl)` (28px), `var(--md-shape-corner-full)` (Pill / 9999px).

4. **Typography Hierarchy (Google M3 Type Scale)**:
   - Use the designated font families (`Inter` / system sans-serif for plain text, `Outfit` for brand/display, `JetBrains Mono` for code).
   - Use the 15 standard M3 type scale tokens defined in `ui/css/design-tokens.css`:
     - **Display**: Large (57px / lh 64px), Medium (45px / lh 52px), Small (36px / lh 44px) - high-impact titles.
     - **Headline**: Large (32px / lh 40px), Medium (28px / lh 36px), Small (24px / lh 32px) - page & section headings (`h1`–`h3`).
     - **Title**: Large (22px / lh 28px), Medium (16px / lh 24px), Small (14px / lh 20px) - card & dialog titles.
     - **Body**: Large (16px / lh 24px), Medium (14px / lh 20px), Small (12px / lh 16px) - paragraphs, table contents.
     - **Label**: Large (14px / lh 20px), Medium (12px / lh 16px), Small (11px / lh 16px) - buttons, chips, form labels.
   - Never use arbitrary unaligned font sizes (e.g. 13px, 15px, 17px) without mapping to the canonical scale.

5. **Responsiveness & Window Size Classes (Google M3)**:
   - **Window Size Classes**:
     - **Compact (< 600px)**: 4 columns, 16px margins/gutters. Stacked Single-Pane layout. Full-width cards. Touch target minimum $48\text{px} \times 48\text{px}$.
     - **Medium (600px – 839px)**: 8 columns, 24px margins/gutters. Navigation Rail (collapsed, 80px). 1-2 Panes.
     - **Expanded (840px – 1199px)**: 12 columns, 24px margins/gutters. Two-Pane layout (List-Detail / Sidebar + Main Canvas).
     - **Large (1200px – 1599px)**: 12 columns, 24px margins/gutters. Three-Pane layout (Navigation + Canvas + Inspector).
     - **Extra-Large ($\ge$ 1600px)**: 12 columns, bounded container (`max-width: 1440px` or `1600px`) centered.
   - Multi-pane interfaces MUST adaptively collapse and fold into single-pane or stacked layouts below 840px.

6. **Interactions & States**:
   - All interactive elements must have hover, active, focus-visible, and disabled states.
   - Transitions should use standard easing: `transition: all var(--md-sys-motion-duration-short) var(--md-sys-motion-easing-standard)`.

7. **Iconography (Google Material Symbols)**:
   - **No Raw Emojis/Unicode**: Never use OS emojis (`🚀`, `⚙️`, `💡`, `❌`) or unicode characters (`✕`, `✓`). Always use `<span class="material-symbols-outlined">icon_name</span>`.
   - **No Decorative Icons in Headings**: Headings (`<h1>`–`<h4>`) must feature clean typography without decorative icons prefixed to the title.
   - **M3 Optical Sizes**:
     - `.icon-xs` (16px, opsz 20): Badges, pills, inline tags.
     - `.icon-sm` (20px, opsz 20): Compact buttons, inputs.
     - `.icon-md` (24px, opsz 24): Standard buttons, navigation items.
     - `.icon-lg` (32px, opsz 40): Feature banners.
     - `.icon-xl` (40px, opsz 48): Empty states.
   - **Touch Targets**: Icon-only buttons (`.btn-icon`, `.btn-icon-subtle`) must maintain a minimum clickable area of 36–40px (desktop) / 48px (mobile/compact).
   - **Navigation State**: Full label + icon when expanded; icon-only with tooltip/badge when collapsed.
