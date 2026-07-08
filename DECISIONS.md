# Architecture Decision Log - Local Vendor Marketplace

This document serves as a chronological record of architectural decisions, justifications, and trade-offs made during the development of the **Local Vendor Marketplace** project.

---

## ADR-001: Database Engine - SQLite (Initial Schema & Migration Baseline)

### Decision
Use **SQLite** as the primary relational database engine (`ecommerce.sqlite` stored inside the `/backend` folder).

### Context & Justification
*   **Simple Deployment:** Requires no external database daemon to manage, minimizing developer setup overhead and infrastructure hosting costs.
*   **Zero Admin:** SQLite uses file-backed storage, which simplifies backups and environment synchronization.
*   **Transaction Guarantee:** Fully supports ACID transactions, foreign keys, and indexes necessary for e-commerce integrity.

### Trade-offs
*   *Concurrency Limits:* SQLite utilizes file-level locking for write operations, meaning high write concurrency can result in database busy states.
*   *Future Mitigation:* If profiling shows write-locks bottlenecking checkout operations under load, the database layer will migrate to PostgreSQL (Phase 13: Scalability Evolution).

---

## ADR-002: State Management - React Context

### Decision
Use React Context (`AuthContext`, `CartContext`, `ToastContext`) for global state management instead of state libraries like Redux or server-cache query managers like React Query.

### Context & Justification
*   **Minimal Setup Overhead:** React Context is built into React 19, keeping bundle size low and avoiding extra library dependencies.
*   **Current State Complexity:** The application's global state (logged-in user session, items count in cart, and toast messages) is simple and easily managed via context values.

### Trade-offs
*   *Re-render Risks:* Any consumer of a context re-renders when the context value object changes.
*   *Data Fetching Redundancy:* Context lacks built-in request deduplication, cache stale invalidation, and background synchronization.
*   *Future Mitigation:* If profiling shows excessive re-renders or redundant endpoint queries, we will review the data layer and migrate to a server-state caching manager (Phase 3.5: Performance & UX Foundation).

---

## ADR-003: Database Schema Design - Variant-based Inventory

### Decision
Migrate from a product-level inventory schema to a variant-level inventory schema (`product_variants`, `inventory`, `cart_items`, `order_items`).

### Context & Justification
*   **Real-world Marketplace Needs:** Products naturally have variations in sizes, colors, and models. Each variant can have its own price overrides, cost metrics, and stock levels.
*   **Data Integrity:** Restructuring cart items and order items to reference specific `variant_id` values instead of general `product_id` values ensures order history accuracy.

### Trade-offs
*   *Migration Complexity:* Required structured data migrations to split existing product rows into default variant structures and rebuild tables.
*   *API Updates:* Controllers and queries required refactoring to join on `product_variants` and resolve default variants when cart additions omit specific IDs.

---

## ADR-004: Backend Design - Controller-to-Route DB Injection Pattern

### Decision
Instantiate controllers as factory functions that take a database instance as a dependency, registering route middlewares inside standard routing handlers.

### Context & Justification
*   **Testability:** Allows for easy unit and integration testing where mock databases or test database connections can be injected into controllers.
*   **Isolation of Concerns:** Separation of express router definitions from business logic code inside controllers.

### Trade-offs
*   *Boilerplate:* Requires factory declarations and manual controller initialization inside server bootstrap scripts.
