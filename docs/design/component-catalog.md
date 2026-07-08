# Component Catalog

This catalog covers the reusable components currently present in `frontend/src`. It includes shared primitives, layout shells, and feature-level components that are reused across pages or are clearly intended to be reusable.

## Shared UI Primitives

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `Button` | Base interactive action control with loading and variant states. | `variant`, `size`, `loading`, `disabled`, `type`, `onClick`, `children`, `className`. | Home product cards, login/register/add product forms, checkout summary, empty states, profile logout, cart actions, invoice CTA. | Should be the default for all standard actions. | Overlaps with page-local `<button>` elements used for steppers, tabs, and custom toggles. |
| Observed | `Badge` | Small status or role label. | `variant`, `children`, `className`. | Profile role chip, potentially other status labels. | Good fit for status chips in admin/customer/order views. | Overlaps with custom pill/badge styling in many page components. |
| Observed | `InputField` | Accessible wrapper for text inputs, textareas, and selects. | `id`, `label`, `type`, `error`, `hint`, `required`, `autoComplete`, `as`, `children`, `className`, plus control props. | Login, register, add product, checkout customer form, admin product wizard. | Best default for any form with labels and validation. | Overlaps with custom labeled inputs in checkout and admin flows. |
| Observed | `EmptyState` | Generic no-data placeholder with optional action. | `icon`, `heading`, `body`, `action`. | Currently a reusable shell for empty collections; not heavily imported in active pages. | Useful for empty carts, empty orders, and empty admin datasets. | Overlaps with page-specific empty-state panels such as `EmptyCart`, `OrdersEmpty`, and `ProductGrid` empty view. |
| Observed | `ErrorState` | Reusable API/load failure panel with retry action. | `message`, `onRetry`. | App route fallbacks, home, cart, checkout, orders, product details. | Strong candidate for any future fetch failure state. | Overlaps with page-local error banners and custom retry layouts. |
| Observed | `Spinner` | Loading indicator. | `size`, `className`. | Route fallbacks, page loading states, admin and customer pages, checkout/cart/order/product pages. | Keep as the standard busy indicator. | Overlaps with inline loading text and custom spinners in some pages. |
| Observed | `Skeleton` | Generic shimmer placeholder. | `width`, `height`, `borderRadius`, `className`. | Product card skeletons and any future loading placeholders. | Useful anywhere content shape is known ahead of data. | Overlaps with loading spinners where the UI could be more skeleton-driven. |
| Observed | `ImageWithFallback` | Robust image wrapper with lazy loading and placeholder fallback. | `src`, `alt`, `className`, `eager`, rest props. | Product cards, product gallery, cart/order item thumbnails, order summary thumbnails, success page. | Should be the default image primitive for product media and thumbnails. | Overlaps with raw `<img>` usage in hero, admin preview, and a few local components. |
| Observed | `StarRating` | Display or interactive star rating widget. | `value`, `max`, `interactive`, `onChange`, `label`, `className`. | Present as a reusable primitive; product detail reviews are the obvious consumer. | Good candidate for review forms and rating summaries. | Overlaps with page-local star rendering in `RatingSummary` and review UI. |
| Observed | `ProtectedRoute` | Auth/role gate for route trees. | `allowedRoles`. | `App.jsx` route configuration. | Central place for all route guarding. | Overlaps with auth checks that could otherwise appear inside pages. |
| Observed | `ErrorBoundary` | Catch-all render and lazy-import failure boundary. | `children`, `fallback`. | `App.jsx` wraps each lazy route. | Appropriate for route-level fault isolation. | Overlaps with page-local error handling, but serves a different layer. |
| Observed | `Toast` | Single auto-dismissing notification item. | `toast`, `onDismiss`. | Rendered by `ToastContainer`. | Central notification card for success/error/warning/info. | Overlaps with alert banners inside pages, though the UX goals differ. |
| Observed | `ToastContainer` | Floating notification region. | None beyond context consumption. | Mounted once in `App.jsx`. | Keep as the single global toast host. | Overlaps with inline banners only visually; not functionally. |

## Layout Shells

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `PageLayout` | Global page chrome with header, main content, and footer. | `children`. | Home, product details, cart, checkout, login, register, profile, orders, order details, not found, add product. | The default wrapper for public/customer pages. | Overlaps with `AdminLayout`, which provides a different shell for admin routes. |
| Observed | `Header` | Top navigation, account menu, cart badge, mobile drawer. | None. | Rendered by `PageLayout`. | The main navigation shell for customer browsing. | Overlaps with `AdminLayout` navigation but serves a different audience. |
| Observed | `Footer` | Minimal brand/footer navigation. | None. | Rendered by `PageLayout`. | Suitable as the common public footer. | Little direct overlap beyond brand presentation. |
| Observed | `AdminLayout` | Persistent admin/supplier shell with sidebar and top bar. | None. | All `/admin/*` routes. | Good anchor for admin route groups. | Overlaps with `PageLayout` at the shell level, but intentionally separate. |

## Home / Discovery

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `Hero` | Home-page editorial banner with CTA and visual. | `isVisible`. | Home page only. | Could support future campaign-style banners. | Overlaps with promo banners conceptually, but not structurally. |
| Observed | `DiscoveryBar` | Search, category, and filter control strip with sticky behavior. | `searchQuery`, `setSearchQuery`, `categories`, `activeCategory`, `setActiveCategory`, `resultCount`, `isFiltersOpen`, `activeFiltersCount`, `onToggleFilters`. | Home page only. | Candidate for any future browse page with search/filter controls. | Overlaps with `SearchBar`, `FilterSortBar`, and part of `FilterSidebar`. |
| Observed | `CategoryTabs` | Horizontal tab row for category filtering. | `categories`, `activeCategory`, `onCategoryChange`. | Defined as reusable; not currently a visible consumer in the main home page tree. | Could replace other category selectors if the UX needs tabbed chips. | Overlaps with category dropdowns and filter chips. |
| Observed | `SearchBar` | Compact search input with clear action. | `value`, `onChange`. | Defined as reusable; not currently wired into the main page tree. | Good for smaller search surfaces or mobile-only variants. | Overlaps with the search field inside `DiscoveryBar`. |
| Observed | `FilterSortBar` | Sort select with result count. | `sortOption`, `onSortChange`, `resultCount`. | Defined as reusable; current home page uses its own inline sort row instead. | Could consolidate sorting controls in future browse pages. | Overlaps with the home page sort row and `DiscoveryBar` sort select. |
| Observed | `FilterSidebar` | Collapsible filter panel for price/rating/availability. | `desktopVisible`, `priceRange`, `onPriceRangeChange`, `minRating`, `onRatingChange`, `inStock`, `onInStockChange`, `onClearAll`, `isOpen`, `onClose`. | Home page. | Strong reusable pattern for other catalog/listing screens. | Overlaps with `DiscoveryBar` filters toggle and `FilterSortBar`. |
| Observed | `PromoSection` | Static trust/value proposition strip. | None. | Home page. | Reusable marketing/trust block for browse or landing pages. | Overlaps with cart/checkout trust bars in intent, but not in structure. |
| Observed | `ProductGrid` | Main product collection renderer with loading/error/empty states. | `products`, `loading`, `error`, `onRetry`, `onAddToCart`, `addingProductId`, `onClearFilters`. | Home page, cart recommendations, related products via `ProductCard`. | Good shared collection layout for product listings. | Overlaps with recommendation carousels and page-specific empty states. |
| Observed | `ProductCard` | Product listing card with image, pricing, badges, stock state, and add-to-cart CTA. | `product`, `onAddToCart`, `isAdding`. | Home grid, cart recommendations, related products. | Central ecommerce card; highly reusable. | Overlaps with cart/order item cards only at the thumbnail-and-metadata level. |
| Observed | `ProductCardSkeleton` | Loading placeholder matching `ProductCard`. | None. | Home listing load state. | Useful anywhere `ProductCard` is used. | Overlaps with generic `Skeleton` but is layout-specific. |

## Product Details

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `Breadcrumbs` | Product page breadcrumb trail. | `category`, `productName`. | Product details page. | Could be reused for any nested product/category detail page. | Overlaps with ad hoc breadcrumb trails in cart/order areas. |
| Observed | `HighlightsSection` | Compact list of featured specifications. | `specifications`. | Product details page. | Useful wherever a short spec summary is needed. | Overlaps with `ProductTabs` specifications view. |
| Observed | `RatingSummary` | Compact non-interactive product rating display. | `rating`, `reviewsCount`. | Product details page. | Good for cards and compact summary zones. | Overlaps with `StarRating` and review summary UI. |
| Observed | `VariantSelector` | Selects color/size combinations and availability. | `variants`, `selectedColor`, `selectedSize`, `onSelectColor`, `onSelectSize`. | Product details page. | Core reusable selector for variant-based products. | Overlaps with product wizard preview variant controls. |
| Observed | `BuyBox` | Purchase panel with pricing, quantity stepper, and actions. | `product`, `selectedVariant`, `quantity`, `onQuantityChange`, `onAddToCart`, `onBuyNow`, `isAdding`, `shipping`. | Product details page. | Reusable pattern for direct purchase funnels. | Overlaps with `StickyPurchaseBar` and portions of checkout summary intent. |
| Observed | `TrustBadges` | Static trust badge strip. | None. | Product details page. | Could be reused on checkout or marketing surfaces. | Overlaps with cart/checkout trust bars. |
| Observed | `ProductTabs` | Tabbed detail region for description/specs/warranty/shipping. | `description`, `specifications`, `warranty`, `shipping`. | Product details page. | Good candidate for other multi-section product detail views. | Overlaps with `HighlightsSection`, `ShippingCard`, and `WarrantyCard`. |
| Observed | `ProductGallery` | Image/video gallery with thumbnails and fullscreen viewer. | `media`, `badge`. | Product details page. | Core reusable media experience for product pages. | Overlaps with `ImageViewerModal` and admin preview image handling. |
| Observed | `ImageViewerModal` | Fullscreen zoom/pan image viewer. | `assets`, `initialIndex`, `onClose`. | Opened from `ProductGallery`. | Reusable for any zoomable asset set. | Overlaps with `ProductGallery` zoom behavior. |
| Observed | `PriceBox` | Simple price/MRP/discount display. | `price`, `mrp`. | Used by `BuyBox`. | Could be reused in cards and checkout summaries if a compact price block is needed. | Overlaps with many local price rows. |
| Observed | `RelatedProducts` | Groups related product rows by relationship type. | `relatedProducts`, `onAddToCart`, `isAddingProductId`. | Product details page. | Good pattern for recommendation sections on other pages. | Overlaps with `CartRecommendations` and `ProductGrid`. |
| Observed | `RecentlyViewed` | Displays previously viewed products from localStorage. | `currentProductId`. | Product details page. | Could be moved to other browsing pages if needed. | Overlaps with recommendation logic in cart and product surfaces. |
| Observed | `ShareButton` | Clipboard-based link share control. | None. | Product details page. | General-purpose share action for product pages. | Overlaps with any future copy-link button. |
| Observed | `ShippingCard` | Shipping policy and delivery estimator panel. | `shipping`. | `ProductTabs`. | Useful for product detail or checkout policy summaries. | Overlaps with `CheckoutDeliveryCard` and shipping snippets in cart/checkout. |
| Observed | `StickyPurchaseBar` | Mobile sticky purchase action bar. | `productName`, `price`, `selectedVariantDesc`, `isOutOfStock`, `onAddToCart`, `onBuyNow`, `loading`. | Product details page. | Useful for any mobile product conversion flow. | Overlaps with `BuyBox` and `StickyCheckoutBar` in function. |
| Observed | `WarrantyCard` | Warranty/returns summary panel. | `warranty`. | `ProductTabs`. | Suitable for any warranty-policy display. | Overlaps with warranty info in the product wizard and tabs. |

## Cart

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `CartItemList` | Collection wrapper for cart items. | `items`, `onUpdateQuantity`, `onRemoveItem`, `onSaveForLater`, `isSaving`. | Cart page. | Good list wrapper for any future cart variant. | Overlaps with `ProductGrid` in list behavior, not in content. |
| Observed | `CartItemCard` | Rich cart line item card. | `item`, `onUpdateQuantity`, `onRemoveItem`, `onSaveForLater`, `isSaving`. | Cart page. | Primary reusable cart line item presentation. | Overlaps with `CartItemRow` and `OrderItemRow`. |
| Observed | `CartItemRow` | Dense cart row with stepper and remove action. | `item`, `onUpdateQuantity`, `onRemoveItem`. | Defined as reusable; not used by the current cart page tree. | Could suit compact list/table cart layouts. | Overlaps strongly with `CartItemCard`. |
| Observed | `CartSummary` | Totals, promo input, and checkout CTA panel. | `items`. | Cart page. | Reusable order summary model for cart-like flows. | Overlaps with `OrderSummary` in checkout. |
| Observed | `SaveForLater` | Saved-items shelf with move/remove actions. | `savedItems`, `onMoveToCart`, `onRemoveSavedItem`, `isMoving`, `isDeleting`. | Cart page. | Strong utility for saved-item workflows. | Overlaps with recommendation/product card patterns. |
| Observed | `DeliveryOptions` | Demonstration delivery option selector. | None. | Cart page. | Could evolve into a real shipping-choice control if required later. | Overlaps with checkout shipping policy display conceptually. |
| Observed | `CartRecommendations` | Recommendation strip derived from recent views and category match. | `cartItems`, `onAddToCart`, `isAddingProductId`. | Cart page. | Good model for other personalized recommendation shelves. | Overlaps with `RelatedProducts` and `ProductGrid`. |
| Observed | `EmptyCart` | Empty cart call-to-action state. | None. | Cart page. | Best default cart empty state. | Overlaps with `EmptyState` and `OrdersEmpty`. |
| Observed | `StickyCheckoutBar` | Mobile total + checkout CTA bar. | `items`. | Cart page. | Reusable mobile purchase bar for cart-like flows. | Overlaps with `StickyPurchaseBar` and `OrderSummary`. |
| Observed | `CartTrustBar` | Compact trust strip for cart page. | None. | Cart page. | Can be reused for reassurance rows on other commerce pages. | Overlaps with `TrustBadges` and checkout trust bar. |

## Checkout

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `CheckoutCustomerForm` | Detailed contact/address/notes form. | `formData`, `errors`, `onChange`, `submitting`. | Checkout page. | Strong candidate for any future shipping-address form. | Overlaps with `CheckoutForm` and `InputField` groupings. |
| Observed | `CheckoutDeliveryCard` | Delivery estimate and shipping charge explanation. | `shipping`, `items`, `subtotal`. | Checkout page. | Useful for order summary and shipping policy views. | Overlaps with `ShippingCard` and cart shipping UI. |
| Observed | `CheckoutPaymentSelector` | Payment method tile selector. | `selectedMethod`, `onChange`. | Checkout page. | Reusable for any future payment-step UI. | Overlaps with `CheckoutForm` select blocks and payment constants. |
| Observed | `OrderSummary` | Checkout order preview with totals and submit CTA. | `items`, `subtotal`, `submitting`, `isValid`. | Checkout page. | Could be reused for any order-review step. | Overlaps with `CartSummary` and `OrderSummaryCard`. |
| Observed | `CheckoutTrustBar` | Trust badges beneath the checkout CTA. | None. | Checkout page. | Reusable reassurance strip for transaction flows. | Overlaps with `CartTrustBar` and `TrustBadges`. |
| Observed | `CheckoutForm` | Legacy/alternate checkout form component. | `onSubmit`, `submitting`, `backendError`. | Defined in checkout folder; appears to be a parallel/legacy form surface. | Might be useful if the checkout is split into smaller pieces later. | Strong overlap with `CheckoutCustomerForm` and `CheckoutPaymentSelector`. |

## Orders

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `OrderCard` | Order summary card in order list views. | `order`. | Orders page. | Good reusable card for order indices and history pages. | Overlaps with order detail summary cards. |
| Observed | `OrderItemRow` | Single order line item row. | `item`. | Order details page. | Reusable for any order line display. | Overlaps with `CartItemRow` and cart/order item thumbnails. |
| Observed | `OrderStatusBadge` | Status label with icon and color treatment. | `status`. | Orders page and order detail page. | Strong reusable status chip for all order statuses. | Overlaps with `OrderStatusMessage` and `OrderTimeline` icons. |
| Observed | `OrdersFilterBar` | Tab-based order filter control. | `activeFilter`, `onFilterChange`, `counts`. | Orders page. | Useful for any list with segmented status views. | Overlaps with `CategoryTabs` and other tab bars. |
| Observed | `OrdersEmpty` | Empty-state panel for empty order history. | None. | Orders page. | Reusable for empty history or empty dashboard states. | Overlaps with `EmptyState` and `EmptyCart`. |

## Order Details

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `OrderTimeline` | Visual stepper for order progress and special states. | `status`. | Order details page. | Good pattern for fulfillment progress. | Overlaps with `OrderStatusMessage` and `OrderActivityCard`. |
| Observed | `OrderStatusMessage` | Plain-language status explainer. | `status`. | Order details page. | Useful as a top-of-page status summary. | Overlaps with `OrderTimeline` and `OrderStatusBadge`. |
| Observed | `OrderSummaryCard` | Price summary panel for an order. | `order`. | Order details page. | Reusable for invoice/order overview layouts. | Overlaps with checkout/cart summaries. |
| Observed | `OrderItemsList` | Ordered item list with thumbnails and totals. | `items`. | Order details page. | Strong reusable order line-item component. | Overlaps with `CartItemCard` and `OrderItemRow`. |
| Observed | `OrderAddressCard` | Shipping address and contact card. | `order`. | Order details page. | Useful for customer service and admin order views. | Overlaps with checkout shipping forms conceptually. |
| Observed | `OrderPaymentCard` | Payment method/status and notes card. | `order`. | Order details page. | Reusable for payment detail panels. | Overlaps with checkout payment and notes surfaces. |
| Observed | `OrderDeliveryCard` | Delivery status/date card. | `status`, `placedAt`, `updatedAt`. | Order details page. | Good reusable shipment status card. | Overlaps with `OrderTimeline` and shipping policy blocks. |
| Observed | `OrderNotesCard` | Customer delivery instructions panel. | `notes`. | Order details page. | Reusable for any note or instruction display. | Overlaps with form notes sections. |
| Observed | `OrderSupportCard` | Support contact card with copy-email action. | None. | Order details page. | Can support any help/contact surface. | Overlaps with generic contact cards. |
| Observed | `InvoiceCard` | Placeholder invoice download card. | None. | Order details page. | Reusable as an action/info stub for future invoicing. | Overlaps with document download CTAs elsewhere. |
| Observed | `CancelOrderModal` | Confirmation modal for cancellation. | `isOpen`, `onClose`, `onConfirm`, `isCancelling`. | Order details page. | Standard destructive confirmation pattern. | Overlaps with any future modal confirmations. |
| Observed | `OrderActivityCard` | Event timeline of order activity messages. | `events`. | Order details page. | Good reusable audit/event feed pattern. | Overlaps with `OrderUpdatesCard` and `OrderTimeline`. |
| Observed | `OrderUpdatesCard` | Informational placeholder for future updates. | None. | Order details page. | Temporary reusable info block. | Overlaps with `OrderSupportCard` and `OrderActivityCard` conceptually. |

## Admin

| Confidence | Component | Purpose | Props | Usage locations | Reuse opportunities | Overlap |
|---|---|---|---|---|---|---|
| Observed | `ProductWizard` | Multi-step create/edit product flow. | `mode`, `productId`. | Admin product create/edit screens. | The main reusable admin authoring flow. | Overlaps with `AddProduct` in spirit, but is far more complete. |

## Notes on Reuse

| Confidence | Observed implementation | Inferred standards | Recommendation |
|---|---|---|---|
| Observed | The same visual ideas recur across home, cart, checkout, orders, and product details: cards, status chips, trust bars, item rows, and summary panels. | The app already has a strong shared visual language. | Future work should prefer extending these existing component families rather than creating new ones with nearly identical behavior. |
| Recommendation | Several components are paired versions of the same concept, such as `CartSummary` vs `OrderSummary`, `CartItemCard` vs `OrderItemRow`, and `TrustBadges` vs the cart/checkout trust bars. | These overlaps are the clearest abstraction opportunities. | When implementation work resumes, consider whether the overlap is best solved by a shared primitive or by keeping the current page-specific variants if the behavior is genuinely different. |

