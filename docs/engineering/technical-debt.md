# Technical Debt Report

This is an observational report only. It does not propose or apply code changes.

## Highest-Value Findings

| Confidence | Area | Finding | Why it matters | Location(s) |
|---|---|---|---|---|
| High Confidence Inference | Oversized component | `ProductWizard` is extremely large at 1,838 lines and mixes wizard flow, validation, file uploads, variant generation, preview rendering, and submit logic in one module. | Large files are harder to reason about, test, and safely extend. | `frontend/src/pages/Admin/Products/components/ProductWizard/index.jsx` |
| Observed | Duplicate flow surfaces | Several pairs of components solve nearly the same problem with different skins: `CartSummary` vs `OrderSummaryCard`, `CartItemCard` vs `OrderItemRow`, `TrustBadges` vs `CartTrustBar`/`CheckoutTrustBar`, `ShippingCard` vs `CheckoutDeliveryCard`. | The app has a strong component base, but the same concepts are being re-expressed in multiple places. | Cart, checkout, order details, product details |
| Observed | Hardcoded business rules | Shipping, delivery window, promo, and free-shipping text are repeated with literal thresholds and dates in multiple components instead of coming from a single policy source. | Policy changes will require more edits than necessary and can drift across screens. | `CartSummary`, `CheckoutDeliveryCard`, `ShippingCard`, `DeliveryOptions`, `CheckoutDeliveryCard` |
| Observed | Legacy / unused components | `SearchBar`, `FilterSortBar`, `CheckoutForm`, and `CartItemRow` are defined but do not appear to be wired into the current active page tree. | Unused modules increase navigation overhead and create uncertainty about which implementation is authoritative. | `frontend/src/components/home/SearchBar/index.jsx`, `frontend/src/components/home/FilterSortBar/index.jsx`, `frontend/src/pages/Checkout/components/CheckoutForm/index.jsx`, `frontend/src/pages/Cart/components/CartItemRow/index.jsx` |

## Duplicate CSS and Repeated Styling

| Confidence | Finding | Evidence | Impact |
|---|---|---|---|
| Observed | Repeated card-like styling appears across many feature components instead of being pushed through a shared visual primitive. | Product cards, order cards, cart cards, checkout cards, and trust bars each maintain their own local CSS files. | Styles are coherent, but maintenance cost is high because similar spacing, borders, and header rows are redefined many times. |
| Observed | Several loading/empty/error patterns are recreated at page level. | `Spinner`, `ErrorState`, `EmptyCart`, `OrdersEmpty`, and `ProductGrid` empty/error states all define their own wrappers and copy. | UX is consistent enough, but there is still duplicated layout code around the shared primitives. |
| High Confidence Inference | Button-like controls are repeated with custom classes in many files instead of consistently using the shared `Button` primitive. | Stepper controls, tab bars, modal buttons, and compact action buttons often use local `<button>` styling. | The visual language stays consistent today, but future changes could drift as more one-off button CSS accumulates. |

## Hardcoded Values and Policy Drift

| Confidence | Finding | Evidence | Impact |
|---|---|---|---|
| Observed | Shipping thresholds are duplicated and partially hardcoded outside the pricing utility. | `CartSummary` computes free-shipping progress with literal `500` and `1000` checks, while `CheckoutDeliveryCard` uses `1000 - subtotal` directly. | Changes to shipping policy will be easy to miss because the same rule is encoded multiple times. |
| Observed | Delivery estimates are mocked in multiple places with local formulas and static copy. | `DeliveryOptions`, `ShippingCard`, `CheckoutDeliveryCard`, and `OrderDeliveryCard` all express delivery timing differently. | The UI can become inconsistent if product or order logistics rules evolve. |
| Observed | Admin settings fallback text uses a fixed saved date. | `frontend/src/pages/Admin/Settings/index.jsx` returns `26 Jun 2026` as a default last-saved date. | This is a visible hardcoded sentinel that can confuse users if it leaks into production behavior. |
| Observed | Pricing utilities ignore some imported constants. | `frontend/src/utils/pricing.js` imports `SHIPPING_THRESHOLD`, `SHIPPING_FEE`, and `TAX_RATE`, but the functions still rely on literal thresholds and `calculateTax` always returns `0`. | The constants suggest a policy layer that the implementation does not fully use yet. |

## Architecture Inconsistencies

| Confidence | Finding | Evidence | Impact |
|---|---|---|---|
| Observed | localStorage is accessed directly in several pages and feature components instead of consistently going through the storage helper. | `Checkout`, `Home`, `ProductDetails`, `CartRecommendations`, `RecentlyViewed`, and `Admin/Settings` all call `localStorage` themselves. | Persistence rules are not centralized, which makes it easier for key names and serialization behavior to drift. |
| High Confidence Inference | Checkout has two form implementations that overlap heavily, but only one is clearly wired into the page. | `CheckoutForm` and `CheckoutCustomerForm` both model customer/address/payment entry, while `Checkout/index.jsx` uses `CheckoutCustomerForm`. | This creates ambiguity about the current checkout source of truth. |
| Observed | A few components still use non-token inline styling or ad hoc layout values. | Inline styles appear in places like `ProductCardSkeleton`, `ProductWizard`, `ProductDetails`, and several page-specific control rows. | The design-token system is strong, but it is not yet fully universal. |
| Observed | Some navigation or link code contains legacy fallback expressions. | `Register` uses `ROUTES.ROUTES_LOGIN || ROUTES.LOGIN`. | The code works because of the fallback, but the extra property read is a sign of lingering cleanup debt. |

## Dead Code / Likely Dead Code

| Confidence | Finding | Evidence | Impact |
|---|---|---|---|
| High Confidence Inference | `SearchBar` and `FilterSortBar` appear to be unreferenced by the current page tree. | Search results show the files define the components, but the active home page uses inline search/sort controls instead. | These files may be historical leftovers or planned alternatives that are no longer active. |
| High Confidence Inference | `CheckoutForm` looks like a legacy or alternative checkout implementation. | It is defined in the checkout folder but is not imported by `Checkout/index.jsx`. | It adds confusion because its responsibilities overlap with the live checkout form flow. |
| High Confidence Inference | `CartItemRow` appears unreferenced by the current cart page. | The cart page uses `CartItemCard` through `CartItemList`, not `CartItemRow`. | This likely represents an older cart layout that is no longer in the active path. |

## Reuse Opportunities

| Confidence | Finding | Evidence | Impact |
|---|---|---|---|
| Observed | Cart and order item row/card components share the same thumbnail, title, quantity, and price structure. | `CartItemCard`, `CartItemRow`, `OrderItemRow`, and `OrderItemsList` all render the same commerce item anatomy. | A shared item primitive could reduce duplication if future work needs both compact and expanded variants. |
| Observed | Trust rows and reassurance strips are repeated across home, cart, checkout, and product details. | `PromoSection`, `TrustBadges`, `CartTrustBar`, and `CheckoutTrustBar` all communicate similar confidence cues. | A shared trust component family could make maintenance easier if the messaging needs to change. |
| Observed | Summary panels follow the same conceptual flow. | `CartSummary`, `OrderSummary`, `OrderSummaryCard`, and the checkout order review all present totals, shipping, and CTA affordances. | There is a clear opportunity to standardize the summary pattern if future checkout work expands. |

## Summary

The codebase is in good shape structurally, but the main debt is concentration, not chaos. The biggest pressure points are the oversized product wizard, repeated shipping/summary/item patterns, and a few leftover components that no longer seem to participate in the active UI. The design system and route structure are already solid enough that future cleanup can be incremental.

