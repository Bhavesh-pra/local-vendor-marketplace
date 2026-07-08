# Coding Standards

These standards are inferred only from patterns that already exist in the repository. They are descriptive, not prescriptive.

## Naming Conventions

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | React components use PascalCase names such as `ProductGrid`, `OrderSummary`, and `AdminLayout`. | Component names are expected to be descriptive and domain-specific. | Continue using PascalCase for components and hooks, and avoid generic names where a clearer domain term exists. |
| Observed | Hooks use `use` prefixes, such as `useAuth`, `useCart`, `useToast`, and `useDocumentTitle`. | Custom hooks are named like standard React hooks. | Keep the `useX` convention for all new hooks. |
| Observed | Utility functions use verb-first, descriptive names like `formatCurrency`, `extractErrorMessage`, `calculateShipping`, and `validateEmail`. | Pure helpers are named by intent rather than by module. | Preserve this style for new helpers so call sites stay readable. |
| Observed | Route constants are uppercase keys in `ROUTES`, while route helper functions are camelCase. | Constants and helpers are separated clearly by naming style. | Keep constant maps uppercase and helper functions camelCase. |
| Observed | CSS class names commonly use lower-case kebab-case with BEM-like suffixes, such as `product-card__image-wrap` and `checkout-form__section`. | CSS naming is component-scoped and intentionally structured. | Continue using the same component-scoped BEM-ish naming style for new CSS modules. |

## File Naming

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | Most reusable components use an `index.jsx` plus `index.css` folder layout. | Folder names double as component names for colocated modules. | Keep new reusable components in folder-per-component structures with colocated styles. |
| Observed | Some components are single files at the feature root, such as `CheckoutDeliveryCard.jsx` or `CartItemCard.jsx`. | Small feature-local components are allowed to live as single files when the scope is narrow. | Use single-file components only when the component is clearly local and unlikely to grow into a folder. |
| Observed | Page entry points consistently live at `pages/<PageName>/index.jsx` with a sibling `index.css`. | Pages are treated as route modules. | Keep future route pages aligned to this pattern. |
| Observed | Utility and service modules use `.js`, while component modules use `.jsx` when they render JSX. | File extension reflects the presence of JSX rather than the conceptual layer. | Preserve this distinction so file intent is obvious at a glance. |

## Folder Naming

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | Feature folders use PascalCase names such as `Home`, `Checkout`, `ProductDetails`, `OrderDetails`, and `Admin`. | Folder names mirror the user-facing domain. | Continue using domain folders rather than technical names for pages and features. |
| Observed | Shared folders use lower-level concerns like `ui`, `layout`, `home`, `Product`, `hooks`, `services`, `utils`, `constants`, and `styles`. | The folder structure is a mix of concern-based and domain-based grouping. | Keep the current split: domain features in feature folders, cross-cutting pieces in shared folders. |
| Observed | Some subfolders are nested by workflow depth, such as `pages/Admin/Products/components/ProductWizard`. | Complex feature flows can create local subtrees when warranted. | Preserve that nesting only when it improves readability; do not flatten a clearly multi-step flow into a single directory. |

## Import Ordering

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | Imports commonly appear in this order: external packages, then shared components/hooks/services/utils/constants, then local CSS. | The repository prefers a readable top-down dependency order. | Keep future imports grouped from external to internal, with CSS last. |
| Observed | Path aliases are not used; imports are relative. | The codebase expects explicit relative locality. | Continue using relative imports unless a repo-wide alias strategy is introduced later. |
| Observed | Some files include a blank line between logical groups of imports. | Grouping by responsibility is part of the house style. | Keep that grouping consistent to make large files easier to scan. |

## Component Organization

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | Page components mostly own data fetching, local state, and orchestration, while child components render focused UI slices. | Pages are orchestrators; child components are renderers or small interaction units. | Preserve this split so page files do not become monoliths. |
| Observed | Shared UI components are tiny and composable. | The system prefers small reusable primitives over giant widgets. | When adding UI, start from the smallest sensible reusable piece. |
| Observed | Many feature components are colocated next to the page that consumes them. | Locality is preferred for feature-specific logic. | Keep feature-local components with the page unless they are reused in multiple routes. |
| Observed | Some components include comments that explain intent, especially around loading, routing, or state hydration. | Comments are used sparingly to orient the reader in non-obvious blocks. | Keep comments short and explanatory; avoid restating obvious code. |

## Styling Conventions

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | Most style files are component-scoped CSS modules by convention, even though they are plain CSS files. | Style boundaries are enforced by folder and class naming rather than CSS-in-JS. | Continue isolating styles per component/page and avoid broad global selectors. |
| Observed | `frontend/src/styles/variables.css` holds design tokens, `reset.css` handles normalization, and `globals.css` holds base element styles and generic helpers. | The repository uses a layered global style strategy. | Keep tokens in variables, base element defaults in globals, and component-specific rules in local CSS. |
| Observed | Components prefer utility/helper class names over inline style objects, though some inline styles still appear in a few places. | Inline styles are exceptional rather than standard. | Prefer CSS classes for reusable styling and reserve inline styles for truly dynamic one-off values. |
| Observed | The system relies on tokens such as `--space-*`, `--radius-*`, `--shadow-*`, and semantic colors. | Styling is expected to stay design-token driven. | Avoid hardcoding new spacing, color, radius, or shadow values when a token already exists. |

## Behavioral Conventions

| Confidence | Observed pattern | Inferred standard | Recommendation |
|---|---|---|---|
| Observed | Async pages use `loading`, `error`, and in-flight action flags extensively. | Loading and failure states are first-class UI states. | Keep these states explicit in future page code rather than collapsing them into a single generic flag. |
| Observed | Toasts are used for success and failure feedback in most flows. | User feedback should be immediate and lightweight. | Continue using the toast system for transient confirmations and errors. |
| Observed | localStorage is used for persisted UI/session preferences and recent activity, but helpers and contexts wrap direct access in many places. | Storage is treated as a persistence detail, not a primary state store. | Avoid broadening direct storage access; prefer a helper or context when persistence is needed. |

