# OldenEraMaps Roadmap & Task Progress

This document tracks the implementation status of all feature development, template learnings, validation safety improvements, and architectural cleanups defined in the `docs/tasks/` folder.

---

## 1. AuroraRMG Quality Enhancements
**Goal**: Bring generator quality and user analysis feedback closer to AuroraRMG standards.
**Status**: **100% Completed**

| Task | Status | Implementation Details | Reference File |
| :--- | :---: | :--- | :--- |
| **Post-generation Map Analysis** | Completed | Added a pure metrics analyzer calculating balance score (start wealth, expansion equality, opponent proximity) and content summary. | [templateAnalysis.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/analysis/templateAnalysis.ts) |
| **Simple Generation Flow** | Completed | Simplified generation UI with presets (Duel, FFA, PvE), chaos level, game length, and victory conditions. | [balancedRandomMap.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/balancedRandomMap.ts) |
| **Preset Library Expansion** | Completed | Integrated economic expansion, survivals, island/water, and PvE-focused generation presets. | [settings.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/settings.ts) |
| **City Hold Target Selection** | Completed | Added strategic, distance-fair hold city target selection logic for non-hub/triangle topologies. | [cityHoldTarget.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/generator/cityHoldTarget.ts) |
| **Export and Install Polish** | Completed | Aligned file naming, added File System Access API save picker support, platform-specific guide path, and stale-preview tracking. | [templateDownloads.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/components/appShell/templateDownloads.ts) |

---

## 2. RMG Template Safety & Diagnostics
**Goal**: Catch crash-risk structures and validate template consistency.
**Status**: **100% Completed**

| Task | Status | Implementation Details | Reference File |
| :--- | :---: | :--- | :--- |
| **Structural Template Validation** | Completed | Validates dimension grid division, correct connection names, crossroads constraints, and content limit mapping. | [rmgDiagnostics.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/rmgDiagnostics.ts) |
| **City Hold Objective Validation** | Completed | Requires valid hold targets, prevents ruins/spawns from masquerading, and checks win conditions. | [rmgDiagnostics.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/rmgDiagnostics.ts) |
| **Route & Road Consistency** | Completed | Verifies that roads correspond to actual graph connections and vice-versa, preventing dead-ends. | [rmgDiagnostics.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/rmgDiagnostics.ts) |
| **Branch Mirroring & Naming** | Completed | Checks branch symmetry (zone count, connection counts, guard values, reward configurations) in symmetric layouts. | [rmgDiagnostics.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/rmgDiagnostics.ts) |
| **Guard & Reward Scaling** | Completed | Checks growth increments (N1 < N2 < N3 < Center) and flags high-tier rewards paired with low guard settings. | [rmgDiagnostics.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/rmgDiagnostics.ts) |
| **Size & Pacing Presets** | Completed | Suggests optimal template dimensions by player count and warns on pacing drift for non-standard sizes. | [rmgDiagnostics.ts](file:///Users/philippe.tillheden/OldenEraMaps/src/rmgDiagnostics.ts) |
| **Fixture-backed Regression Pack** | Completed | Integrated representative valid/invalid `.rmg.json` fixtures for regression checking. | [rmg-validation fixtures](file:///Users/philippe.tillheden/OldenEraMaps/tests/fixtures/rmg-validation) |
| **Export Diagnostics & UI** | Completed | Aggregates all structural errors, warnings, and troubleshooting copy in the UI prior to template export. | [ValidationOutputPanel.tsx](file:///Users/philippe.tillheden/OldenEraMaps/src/components/builder/ValidationOutputPanel.tsx) |

---

## 3. Split AppShell Task Plan
**Goal**: Reduce the complexity of the massive `src/components/AppShell.tsx` component by slicing routing, workspace state, authentication, community browsing, and downloads into focused hooks and smaller container components.
**Status**: **In Progress**

- **[x] Extract Pure Helpers**: Pure helper utilities for route parsing, filename normalization, and blob download handles have been moved out of `AppShell.tsx` and into standalone helpers.
- **[ ] Hook Extraction**: Slice states, reducers, and handlers into the following standalone hooks:
  - `useAppRoute` (navigation, URL parsing, popstate, and SEO sync).
  - `useBuilderWorkspace` (autosave, undo/redo history, dirty flags, and active zone/connection management).
  - `useBuilderJsonWorkflow` (JSON edit buffer state, parse error messages, and schema validation).
  - `useCommunityAuth` (auth dispatch, user profile syncing, provider sign-in, and account deletion state).
  - `useCommunityBrowse` (browse queries, filters, sorting, downloads, and catalog caching).
  - `useMyMaps` (managing current user uploaded maps list).
  - `useTemplateDownload` (save picker orchestration).
- **[ ] Page Component Splitting**: Break the JSX page compositions (builder workspace, browse directory, installation guide page, etc.) out of the main `AppShell` container.
