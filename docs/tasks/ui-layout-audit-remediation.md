# UI & Layout Audit Remediation Plan

This document identifies complex UI components and bad layout structures within the Olden Era Maps Studio app, detailing proposed improvements to align with modern responsive desktop practices, clean code standards, and passing test suites.

---

## 1. Monolithic State & Page Rendering in `AppShell`

### Problem
The primary entry point `src/components/AppShell.tsx` is a monolithic file (~70KB, 1,750+ lines) that combines:
- App-level routing and SEO synchronization
- Supabase/OAuth auth state management
- Community browse catalog state and filters
- User map listings (My Maps) state
- Undo/redo workspace history management
- XML/JSON template serialization, parser logic, and file downloading
- Full JSX composition for the topbar, footer, and several sub-pages inline

### Bad Layout & Code Impact
- **Test Suite Regressions**: A recent update added required `templateDiagnostics` to the `ValidationOutputPanel` component. Because the monolithic `AppShell.tsx` was never updated to compute or pass this prop, rendering it from the main shell crashed with a `TypeError` on load, breaking 92 out of 102 frontend tests.
- **Performance Drag**: State updates in sub-pages (e.g., changing filters in browse, clicking buttons in the zone inspector) trigger re-renders of the topbar file action buttons, faction strips, and dialogs.
- **Maintenance Risk**: Adding or modifying layout rules for one page easily breaks state or layouts for completely unrelated pages.

### Proposed Fix
Complete the refactoring plan defined in [split-appshell.md](file:///Users/philippe.tillheden/OldenEraMaps/docs/tasks/split-appshell.md):
1. **Migrate to Page-level Containers**: Replace inline page rendering inside `AppShell.tsx` with dedicated container components:
   - Render `BuilderWorkspacePage` for the `"builder"` route.
   - Render `BrowsePage` for the `"browse"` route.
   - Keep page-specific dialogs nested inside their respective pages rather than global app-level modals.
2. **Utilize Extracted React Hooks**: Replace inline state blocks in `AppShell.tsx` with the pre-written hooks in `src/hooks/`:
   - `useAppRoute.ts` for routing and SEO syncing.
   - `useBuilderWorkspace.ts` for workspace design, selection, and history.
   - `useBuilderJsonWorkflow.ts` for JSON drafting, parsing, and applying.
   - `useCommunityAuth.ts` and `useCommunityBrowse.ts` for auth and browsing.
   - `useMyMaps.ts` for my-maps listing actions.

---

## 2. collapsed Hamburger Menu on Desktop Viewports

### Problem
Navigation links ("Builder", "Browse", "Reference", "Install") are hidden behind a mobile-style hamburger menu trigger (`.topbar-menu__trigger`) on all screen sizes, including wide desktop monitors.

### Bad Layout & UX Impact
- **High Interaction Cost**: Desktop users must perform two clicks (open menu -> select route) instead of clicking a clearly visible route link directly.
- **Broken Tests**: The UI test suite expects a visible navigation element with role `"navigation"` and name `"Main navigation"`. Hiding these routes behind the trigger menu causes 18 test cases checking page navigation, community filtering, map downloading, and install documentation to fail.

### Proposed Fix
1. **Introduce Desktop Navigation Bar**: Create a horizontal navigation bar component `<nav aria-label="Main navigation" className="desktop-navigation">` directly in the topbar.
2. **Toggle Visibility via CSS**:
   - For viewport widths **above `1160px`**, display the horizontal `<nav>` element and hide the mobile hamburger trigger button (`.topbar-menu__trigger`).
   - For viewport widths **below `1160px`**, hide the horizontal `<nav>` and display the hamburger trigger, keeping navigation inside the dropdown overlay (`.topbar-actions`).
3. **Style Integration**: Add modern desktop nav styling in `src/style.css` with subtle hover indicators and gold/white color states mapping to active route states.

---

## 3. Modal Dialog Overload & Fragmented Workflow

### Problem
The map builder interface uses seven (7+) separate modal dialog overlays for configuring advanced template attributes:
- `ConnectionsDialog` (routes, portals, road mode)
- `ContentLimitsDialog` (limit object counts)
- `LayoutProfilesDialog` (layout presets)
- `ContentLibraryDialog` (content library pools)
- `ExpertTemplateSettingsDialog` (map angles, borders, noise)
- `MandatoryContentDialog` (mandatory spawns, objects)
- `BalancedRandomMapDialog` (simple map generator)

### Bad Layout & UX Impact
- **Constant Context-Switching**: Users must open a modal, perform a small configuration edit, close it, select another button under "Advanced Settings", open a different modal, etc. There is no central advanced settings dashboard.
- **DOM Bloat**: Eight different radix dialog containers are mounted constantly, cluttering the DOM structure and making focus management fragile.

### Proposed Fix
1. **Consolidate Advanced Settings**: Combine related dialogs (`Content Limits`, `Layout Profiles`, `Content Library`, `Expert Settings`, and `Mandatory Content`) into a single **"Advanced Configuration" Dialog** with a left-hand tab panel or horizontal tabs.
2. **Unified Advanced Panel**:
   - Tab 1: **Layout & Profiles** (combines Layout Profiles and Expert orientation/borders)
   - Tab 2: **Content Pools** (combines Content Library and Mandatory Content)
   - Tab 3: **Count Limits** (Content Limits configuration)
3. **Preserve Dialog Triggers**: Keep the individual button triggers under the "Advanced Settings" card on the layout board, but have them open the unified configuration dialog directly to the relevant tab.

---

## 4. Textarea-based JSON Editing in Dialogs

### Problem
Advanced properties like value overrides, global bans, noise arrays (in `ExpertTemplateSettingsDialog`), and portal placement rules (in `ConnectionsDialog`) require users to write raw JSON strings into standard HTML textareas.

### Bad Layout & UX Impact
- **Error Prone**: Users receive no auto-formatting, syntax coloring, auto-completion, or inline schema validation. Missing a comma or quotation mark yields generic red parser errors, blocking template exports.
- **Poor Readability**: Unformatted JSON strings in textareas quickly become unreadable lists.

### Proposed Fix
1. **Replace Textareas with Visual Form Arrays**: Instead of textareas for list-based JSON arrays (like global bans or noise entries), provide simple list builders where users can add, edit, or delete items using standard form controls (inputs, sliders, select boxes).
2. **Integrate Schema Validation & Linting**: For truly advanced fields (like value overrides) where text editing is desired:
   - Implement a lightweight, styled JSON code editor component (e.g. Monaco Editor, CodeMirror, or a syntax-highlighted textarea) that validates JSON structures on the fly and provides descriptive line numbers for errors.
   - Standardize error output banners below the textareas to pinpoint the invalid line and column number.

---

## 5. Non-Responsive Dialog Heights

### Problem
Large forms inside the dialogs (like `ConnectionsDialog` or `ExpertTemplateSettingsDialog`) lack proper flex containment, resulting in dialog panels that overflow the viewport height on smaller desktop monitors or tablets.

### Bad Layout & UX Impact
- **Hidden Controls**: Actions like "Apply" or "Cancel" buttons at the bottom of dialogs can get pushed off the screen, requiring awkward page-level scrolling.
- **Stretching Forms**: Scrollable areas are not always bound to the modal content area, making headers and footers scroll out of view.

### Proposed Fix
1. **Bind Dialog Content Heights**: Set default CSS properties on the radix dialog panels:
   ```css
   .dialog-content {
     display: flex;
     flex-direction: column;
     max-height: 88vh;
     overflow: hidden;
   }
   ```
2. **Scroll Container Isolation**: Wrap dialog form fields in a scrollable body container:
   ```css
   .dialog-body {
     flex: 1 1 auto;
     overflow-y: auto;
     padding-right: 8px;
   }
   ```
   This ensures that dialog headers (`dialog-heading`) and actions (`dialog-actions`) remain sticky at the top and bottom of the dialog panel while the form fields scroll smoothly in between.
