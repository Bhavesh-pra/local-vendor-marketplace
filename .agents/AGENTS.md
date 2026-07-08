# Phase 3 Rules

The following rules apply during Phase 3 (Mobile Experience):

1. **Desktop UI is frozen**: Do not modify desktop-specific styles, layouts, or component structures unless explicitly approved.
2. **Media Queries / Viewport limits**: Only add styles below `768px` (using media queries like `@media (max-width: 767px)`) unless explicitly approved.
3. **Shared Components**: Prefer modifying shared components over page-level hacks.
4. **No Duplication**: Never duplicate desktop and mobile components. Build responsive layouts within single components.
5. **Horizontal Scrolling Restrictions**: Horizontal scrolling is allowed only for:
   - Chips
   - Tab strips
   - Thumbnail galleries
6. **Touch Targets**: Maintain touch target size of at least `44px` height and width for all interactive elements, inputs, and triggers.
7. **Baseline Capture**: Re-run the baseline capture after each subphase.
