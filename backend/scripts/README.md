`seedPhase4DiscoveryDataset.js` expands the local catalog to a discovery-ready dataset.

It:
- adds roughly 60 active products in total across existing categories,
- writes multiple uploaded gallery images per product,
- creates realistic variants, inventory, reviews, orders, and analytics events,
- avoids schema changes and works against the current SQLite database.
