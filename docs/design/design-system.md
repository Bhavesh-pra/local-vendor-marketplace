# ShopCart Design System

This document describes the implementation currently present in `frontend/src`. It separates what is directly observed from what is inferred from repeated usage patterns.

## Color Palette

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | The app uses CSS custom properties in `frontend/src/styles/variables.css` for brand, surface, text, border, status, shadow, motion, layout, and z-index values. Primary brand is indigo, secondary accent is emerald, and the overall theme is dark. | The system is intentionally token-driven and meant to avoid hardcoded colors inside components. | Keep all new UI on the token layer first, and treat any new raw color as technical debt unless a token cannot cover it. |
| Observed | Brand tokens include `--color-brand-primary`, `--color-brand-primary-hover`, `--color-brand-primary-muted`, and `--color-brand-secondary`. | Indigo is the primary action color, while emerald appears to be a secondary accent used sparingly. | Preserve indigo as the default action color and avoid introducing competing accent families. |
| Observed | Surface tokens are `--color-surface-base`, `--color-surface-raised`, `--color-surface-elevated`, and `--color-surface-overlay`. | These define a three-tier dark elevation model plus modal/backdrop surfaces. | Use the existing surface steps for cards, panels, menus, and overlays instead of creating one-off background colors. |
| Observed | Text tokens are split into heading, body, muted, inverted, and brand text colors. | The UI expects high contrast headings, softer body copy, and a lighter brand text state. | Keep the text hierarchy consistent across pages so headings remain visually dominant and supporting copy stays muted. |
| Observed | Status colors exist for success, error, warning, and info, each with a matching background token. | Status messaging is meant to be semantic and reusable rather than ad hoc. | Use the semantic pairings for alerts, badges, and toasts rather than inventing new status palettes. |
| Recommendation | Several components still use local hardcoded colors or inline style values. | The token system is not yet fully enforced across all CSS. | Expand token usage into any remaining component styles that still rely on raw colors. |

## Typography Scale

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `--font-family-sans` is `Inter, system-ui, -apple-system, sans-serif`. | The design system is built around a clean sans-serif base with system fallbacks. | Keep typography simple and legible; do not introduce a competing display font without a deliberate system update. |
| Observed | Font sizes are tokenized from `--font-size-xs` through `--font-size-5xl`. | The scale supports dense UI as well as marketing-style hero text. | Reserve the largest sizes for true page hero content and product-highlight sections. |
| Observed | Headings in `globals.css` default to bold, tight line-height, and specific size tokens per level. | Headings are meant to read clearly across the app without each component redefining base heading behavior. | Let components override size only when necessary; preserve the shared heading rhythm. |
| Observed | Line-height tokens exist for tight, snug, normal, and relaxed spacing. | The codebase expects careful control of compact versus readable text blocks. | Use the tighter values for titles and the relaxed values for longer descriptions and policy text. |
| Recommendation | Most pages use uppercase labels, subtle eyebrow text, and compact metadata rows. | The system favors an information-dense ecommerce presentation rather than editorial typography. | Keep new copy short, scannable, and hierarchy-driven. |

## Spacing System

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | Spacing tokens are mostly an 8px grid: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`. | The layout language is built on an 8px rhythm with one-step exceptions for tighter controls. | Base new spacing decisions on these tokens first, especially for page shells, cards, and form sections. |
| Observed | `.container` uses `--container-max-width: 1700px` and `--container-padding: var(--space-6)`, with smaller padding on narrow screens. | The layout is wide by default and adapts only at smaller breakpoints. | Maintain the current wide ecommerce canvas, but avoid making new sections feel overly stretched on desktop. |
| Observed | `--header-height` is tokenized at `72px`. | Header-adjacent sticky elements are expected to align to that measurement. | Keep sticky offsets token-based so scroll logic and sticky controls stay aligned. |

## Elevation Hierarchy

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | Shadows are tokenized as `--shadow-sm`, `--shadow-md`, `--shadow-lg`, and `--shadow-brand`. | The app uses soft depth rather than heavy contrast shadows. | Keep the shadow language restrained so the dark theme remains premium instead of muddy. |
| Observed | `--shadow-brand` is a ring-like indigo glow used on primary hover states. | Brand emphasis is meant to be visible on interaction, not constantly present. | Use the brand shadow for focus and hover states on key actions only. |
| Observed | `--z-dropdown`, `--z-sticky`, `--z-drawer`, `--z-modal`, and `--z-toast` define a clear overlay stack. | Interaction layering is intentionally explicit. | Reuse the existing z-index ladder rather than adding ad hoc values in component CSS. |

## Buttons

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `frontend/src/components/ui/Button/index.jsx` supports `primary`, `secondary`, `outline`, `ghost`, and `danger` variants with `sm`, `md`, and `lg` sizes. | Buttons are the main reusable action primitive across the app. | Prefer the shared `Button` component for all standard CTAs and form submissions. |
| Observed | Button styling uses a 10px border radius, min-height targets, and token-based colors. | Button sizing is designed around touch-friendly minimums. | Keep interactive controls at or above the current touch target behavior. |
| Observed | Loading state inserts a spinner and hides the label visually. | Async actions are expected to preserve layout stability while loading. | Maintain this pattern for any new async actions rather than swapping labels or shrinking controls. |
| Recommendation | Some page-specific buttons still use raw `<button>` tags and local CSS classes. | The design system is consistent, but not yet completely centralized. | Consider migrating new shared actions to the reusable button primitive before adding more one-off button styles. |

## Forms

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `InputField` wraps label, control, hint, and error state in one component, and supports `input`, `textarea`, and `select`. | Form controls are intended to be accessible and visually consistent. | Use `InputField` whenever a field needs validation, helper text, or a select/textarea variant. |
| Observed | Error state is represented through `aria-invalid`, `aria-describedby`, and a visible error line. | Accessibility is part of the form system rather than an afterthought. | Preserve these attributes in any custom form control that cannot use `InputField`. |
| Observed | Form pages rely on fieldset/legend groupings in checkout and admin flows. | Sectioned forms are the dominant layout pattern for longer data entry screens. | Keep large forms broken into labeled sections, especially for checkout and product admin flows. |
| Recommendation | The current checkout area still mixes shared inputs with page-specific select and checkbox blocks. | The form system is good, but not yet fully normalized. | Reuse the same field wrapper patterns where possible so long forms feel like one system. |

## Cards

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `.card` in `globals.css` sets a raised surface, subtle border, 12px radius, and `var(--space-6)` padding. | Cards are a general container surface, not a decorative element. | Keep cards functional and information-dense, especially in admin and checkout surfaces. |
| Observed | Many specialized cards define their own local CSS, but they generally follow the same raised-surface aesthetic. | The system allows local variation while preserving a shared visual family. | Reuse the base card language when introducing new panels so the UI stays coherent. |
| Observed | Product cards and order cards are more compact and structured than page cards. | Repeated item cards are treated differently from whole-page panels. | Keep repeated cards tight and consistent with their list/grid context. |

## Interactive Elements

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | Buttons, tabs, badges, selects, drawers, and toast dismiss controls all use compact icon-led micro-interactions. | The app favors action density over ornamental controls. | Continue using icons inside compact controls where the action is obvious or the icon is familiar. |
| Observed | `Button`, `Badge`, `StarRating`, `Toast`, `ProtectedRoute`, `Spinner`, `Skeleton`, `EmptyState`, and `ErrorState` form the main interaction utility layer. | These are the reusable primitives that keep page code focused on business logic. | Add new shared interactive states to this utility layer before copying control logic into pages. |
| Recommendation | Several page components still repeat local toggle, chip, and stepper patterns. | The shared interaction vocabulary is strong enough to absorb more reuse. | Normalize repeated stepper, badge, and tab patterns into shared primitives when future implementation work begins. |

