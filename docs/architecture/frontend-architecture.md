# Frontend Architecture

This document reflects the current frontend implementation in `frontend/src`. It focuses on how the app is organized, how modules depend on each other, and how routing/state/API concerns are separated.

## Folder Structure

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | The frontend source is organized into `components`, `pages`, `context`, `hooks`, `services`, `utils`, `constants`, `lib`, and `styles`. | The codebase uses a feature-plus-layer structure rather than a single flat component tree. | Keep new code in the nearest existing layer instead of inventing new top-level folders. |
| Observed | Shared UI primitives live under `components/ui`, layout shell pieces under `components/layout`, ecommerce browsing pieces under `components/home` and `components/Product`, and page-specific subcomponents remain nested under each page folder. | Shared/reusable code is separated from page orchestration. | Preserve this boundary: shared UI in `components`, feature-local details in `pages/<Feature>/components`. |
| Observed | The admin area is nested under `pages/Admin` with subfolders per admin function. | Admin flows are treated as a mini-app inside the main app shell. | Keep admin-only logic inside the admin tree unless it is genuinely shared by customer and admin flows. |

## Module Boundaries

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `App.jsx` owns top-level providers, router setup, lazy route boundaries, and the global toast container. | App shell responsibilities are intentionally centralized. | Keep routing, providers, and app-wide overlays in `App.jsx`, not in feature pages. |
| Observed | `PageLayout` wraps most pages with the global `Header`, `main`, and `Footer`. | Page chrome is standardized outside individual pages. | Use `PageLayout` for any new public/customer page that should inherit the shared shell. |
| Observed | Services are split by domain: auth, cart, product, order, review, and admin. | Each service file maps to a backend resource boundary. | Add future API calls to the matching service file rather than scattering axios calls through components. |
| Observed | Utilities are pure helpers for formatting, validation, pricing, search, storage, customer classification, and error extraction. | The utility layer is intended to stay framework-free and reusable. | Keep UI code out of `utils`; if a helper starts depending on React state, it likely belongs elsewhere. |

## Dependency Directions

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | The dependency flow is mostly `pages -> components/hooks/services/utils/constants`, with contexts and services feeding data downward. | Pages orchestrate; components render; services fetch; utilities transform. | Continue to push business logic down into services/utils and keep pages as orchestration layers. |
| Observed | Shared components import from `utils`, `constants`, `hooks`, and other shared components, but not from page entry files. | The tree is designed to avoid cyclic feature coupling from page to page. | Keep page-to-page imports out of shared components to preserve modularity. |
| Observed | `lib/axios.js` is the only file that creates/configures the Axios instance. | Network configuration is intentionally centralized. | Treat `lib/axios.js` as infrastructure and avoid duplicating client setup in new service code. |

## API Layer

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `frontend/src/lib/axios.js` creates a single Axios instance using `VITE_API_BASE_URL`, adds JSON headers, and injects an in-memory bearer token on requests. | Auth tokens are meant to live in memory for request use, with storage used only for hydration and persistence. | Keep token handling centralized in AuthContext and `lib/axios.js`. |
| Observed | The Axios response interceptor clears persisted auth data on 401 responses. | Unauthorized failures are expected to invalidate the local session. | Preserve that behavior; it is a useful guard against stale auth state. |
| Observed | Service functions typically call an endpoint and return `response.data` without transforming it much. | Backend responses are passed through to pages/components with minimal service-layer shaping. | Keep service methods thin unless a domain-specific response normalization is clearly needed. |
| Observed | `adminService` is a grouped object with methods for dashboard, analytics, products, categories, suppliers, orders, requests, customers, reviews, inventory, and alerts. | Admin operations are considered a large but coherent backend domain. | Continue grouping admin methods by concern inside one service object unless the file grows beyond easy navigation. |

## State Management

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | Global state is provided through React Context for auth, cart, and toast notifications. | The app uses lightweight global state rather than Redux or another store. | Keep shared session, cart, and notification state in context unless a clear scaling need appears. |
| Observed | Most page state is local with `useState`, `useEffect`, `useMemo`, and `useCallback`. | Page orchestration is intentionally self-contained. | Preserve local state for page-specific forms, loading states, and derived UI values. |
| Observed | `AuthContext` hydrates from localStorage once on mount, then uses in-memory state plus storage writes on login/logout. | Auth state is intentionally bounded and synchronized rather than repeatedly read from storage. | Keep this one-time hydration pattern to avoid storage becoming the runtime source of truth. |
| Observed | `CartContext` stores cart ID and item count, while cart page logic owns the item lists and optimistic updates. | Cart state is split between global identifiers/counts and page-local item detail. | Keep only the truly global cart signals in context; leave item collections in page state. |
| Observed | Toast state is globally managed and capped at four concurrent items. | Notification UX is intentionally bounded and ephemeral. | Maintain the capped queue behavior so the notification area does not become noisy. |

## Routing

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | Route constants live in `frontend/src/constants/routes.js` and are used throughout the app. | Route strings are meant to be centralized. | Keep route generation in `ROUTES`/helpers instead of hardcoding paths across components. |
| Observed | Public routes include home, product details, login, register, and 404. | The customer storefront is available without auth for browsing. | Continue to keep the product-discovery path public and lightweight. |
| Observed | Customer-protected routes include cart, checkout, orders, order details, profile, and order success. | Post-auth shopping flows are guarded together. | Keep purchase-related routes inside the protected customer boundary. |
| Observed | Admin and supplier routes are protected separately, with supplier access limited to the product management subset. | Role-based route gating is a first-class pattern. | Use the existing role gates for any new admin/supplier pages rather than checking roles ad hoc inside pages. |
| Observed | All lazy routes are wrapped in `LazyRoute`, which combines `Suspense` and `ErrorBoundary`. | Route-level code splitting is the default for non-critical pages. | Keep lazy-loading new page modules when they are not on the critical first-render path. |
| Observed | `useScrollRestoration` runs at the route level inside `AppRoutes`. | Scroll reset is standardized across navigations. | Keep navigation behavior consistent by leaving scroll restoration in the router shell. |

## Component Hierarchy

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | `App` wraps providers and renders `AppRoutes`, then `ToastContainer`. | Toasts are intentionally above the page tree. | Keep overlays that must survive route swaps outside the route subtree. |
| Observed | Public pages usually compose `PageLayout`, feature blocks, and shared UI primitives. | Feature pages are the orchestration layer for reusable components. | Continue building pages from feature blocks rather than embedding all markup inside the page file. |
| Observed | Product details and cart pages are the densest compositions, combining shared UI, feature-specific panels, and local flow control. | The design system is component-driven but still page-assembled. | Reuse existing panels and cards where possible before adding another bespoke subcomponent. |
| Recommendation | The checkout and product detail flows already show many page-local subcomponents. | The component system is rich enough to benefit from stronger reuse in future phases. | When Phase 2B continues, factor repeated checkout/order patterns into shared building blocks only if they recur in multiple places. |

