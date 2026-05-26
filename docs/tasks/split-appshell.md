# Split AppShell Task Plan

## Goal

Reduce `src/components/AppShell.tsx` into focused containers and hooks without changing user-visible behavior.

## Current Problem

`AppShell` owns routing, SEO metadata, builder state, undo history, JSON import/export, community browse state, auth state, upload flow, map detail state, my-maps management, account deletion, and file downloads. This makes unrelated changes easy to couple through shared state and broad effects.

## Proposed Slices

1. `useAppRoute`
   - Own `page`, URL parsing, navigation, popstate handling, and SEO sync.
   - Return `page`, `navigate`, and route-specific metadata.

2. `useBuilderWorkspace`
   - Own `design`, selected zone/connection, inspector/workspace tabs, dirty state, undo history, autosave, and design mutation handlers.
   - Keep the public API close to current props passed into builder components.

3. `useBuilderJsonWorkflow`
   - Own JSON snapshot/draft state, parse/apply errors, validation errors, import file handling, and force-export behavior.
   - Depend on `design` and a small `commitDesign` callback from `useBuilderWorkspace`.

4. `useCommunityAuth`
   - Own `communityAuthReducer`, session bootstrap, auth state listener, sign-in dialog state, post-sign-in upload resume, sign-out, profile name edits, and account deletion dialog state.

5. `useCommunityBrowse`
   - Own browse filters, selected tags, pagination, loading/error/result state, map detail loading, ratings, downloads, and browse refresh.
   - Keep local catalog fallback contained here.

6. `useMyMaps`
   - Own `listMyMaps`, listing update/hide/restore/delete/download flows, optimistic card patching, and my-maps loading/error state.
   - Share only auth identity and community refresh callbacks with browse.

7. `useTemplateDownload`
   - Own save picker capability, file-name normalization, JSON/image blob writes, and community preview image downloads.

## Sequence

1. Extract pure helpers first: route/SEO helpers, file download helpers, and community filename helpers.
2. Extract `useBuilderWorkspace` with no JSX movement. Keep tests green after each moved handler group.
3. Extract JSON workflow next because it has a clear boundary around `jsonDraft`, `jsonSnapshot`, and `applyRmgJsonToDesign`.
4. Extract auth/community hooks after builder state is stable.
5. Move JSX page composition into small page containers only after state hooks are separated.

## Verification

- Run `npm test` after each slice.
- Run `npm run build` after each slice that moves imports or exported types.
- For UI-affecting slices, run the Vite app and smoke-test: builder edit, JSON edit/apply, export, browse filters, upload dialog open, map detail open, my-maps listing edit.

## Guardrails

- Keep behavior-preserving commits small enough to review by slice.
- Do not refactor visual components while extracting state.
- Preserve autosave keys, local catalog keys, route paths, and public component prop names until the split is complete.
