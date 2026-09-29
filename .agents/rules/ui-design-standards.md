---
description: Enforce Material Design 3 and Application Theme standards across all UI & Frontend files (React, TypeScript, CSS)
globs: "{ui/**/*,frontend/**/*}"
---

# UI Design & Material Design 3 Standards

When creating, editing, or refactoring user interfaces, dashboards, modal dialogues, and styling in this repository, always adhere to the following rules:

1. **Design Tokens & No Inline Styles (`style={{ ... }}`)**:
   - Reference variables defined in `design-tokens.css`, `ui-primitives.css`, and CSS custom properties (`var(--color-surface)`, `var(--color-primary)`, `var(--md-sys-color-...)`).
   - **Prohibition of Inline Styles for Layout & Visuals**: Never write inline flexboxes, paddings, borders, colors, or shadows (`style={{ display: 'flex', padding: '12px', background: '#fff', border: '1px solid #e2e8f0' }}`). Always use semantic CSS classes (`.ui-card`, `.ui-row`, `.ui-stack`, `.ui-page-container`, `.ui-toolbar`, `.ui-filter-chip`, etc.) or UI Primitive components (`<PageContainer>`, `<PageHeader>`, `<PageBody>`, `<Stack>`, `<Row>`, `<Card>`, `<Badge>`, `<Button>`).
   - Inline styles are **ONLY** permitted for purely dynamic runtime calculations (e.g. dynamic element width percentages, drag coordinates, computed hex colors from project config).

2. **Component Matrix by Functional Role**:
   - **Page View**: Use `<PageContainer>`, `<PageHeader>`, and `<PageBody>`.
   - **Linear Layouts**: Use `<Stack>` (vertical) and `<Row>` (horizontal) with predefined gaps (`xs`, `sm`, `md`, `lg`).
   - **Surfaces & Cards**: Use `<Card variant="elevated" | "flat">` or `.ui-card`.
   - **Status & Tags**: Use `<Badge variant="primary" | "success" | "warning" | "danger" | "info" | "neutral">` or `.ui-taxonomy-chip`.
   - **Code & Payloads**: Use `<RawCodeViewer>` or `<DiffViewer>`.
   - **Color Picking**: Use `<ColorDotPicker>`.
   - **Taxonomy Editing**: Use `<TaxonomyChipEditor>`.
   - **Sidebar Drawers & Inspectors**: Use `.ui-sidebar-drawer`, `.ui-sidebar-drawer__header`, `.ui-sidebar-drawer__body`, `.ui-sidebar-drawer__footer`.

3. **Color Roles & Contrast**:
   - Maintain semantic roles (`--md-sys-color-primary`, `--md-sys-color-surface`, `--md-sys-color-on-surface`, `--md-sys-color-outline-variant`).
   - Ensure all text passes WCAG AA contrast standards ($\ge 4.5:1$ for body, $\ge 3:1$ for large headings).

4. **Shapes & Spatial Rhythm**:
   - Spacing (padding, margin, gap) MUST strictly be multiples of 4px or 8px (e.g. 4px, 8px, 12px, 16px, 24px, 32px).
   - Use standard border-radius tokens: `var(--md-shape-corner-xs)` (4px), `var(--md-shape-corner-sm)` (8px), `var(--md-shape-corner-md)` (12px), `var(--md-shape-corner-lg)` (16px), `var(--md-shape-corner-xl)` (28px), `var(--md-shape-corner-full)` (Pill / 9999px).

5. **Typography Hierarchy (Google M3 Type Scale)**:
   - Use the designated font families (`Inter` / system sans-serif for plain text, `Outfit` for brand/display, `JetBrains Mono` for code).
   - Use standard typography classes: `.ui-heading-1`, `.ui-heading-2`, `.ui-heading-3`, `.ui-text-body`, `.ui-text-muted`, `.ui-text-caption`.

6. **Iconography (Google Material Symbols & Lucide)**:
   - **No Raw Emojis/Unicode**: Never use OS emojis (`🚀`, `⚙️`, `💡`, `❌`) or unicode characters (`✕`, `✓`). Always use `<span className="material-symbols-outlined">icon_name</span>` or Lucide Icons (`<RefreshCw />`, `<Download />`).
   - **No Decorative Icons in Headings**: Headings (`<h1>`–`<h4>`) must feature clean typography without decorative icons prefixed to the title string.

7. **Application Theme Fidelity & Subview Architecture**:
   - **Never mix un-themed or isolated Tailwind dark utility classes** (`bg-slate-900`, `text-slate-400`, `border-slate-800`) that break against the active light/dark theme variables.
   - Always verify that `npm run build` compiles with 0 TypeScript/bundling errors after refactoring any subviews or components.
