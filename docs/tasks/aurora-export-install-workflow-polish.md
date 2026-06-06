# Aurora Task: Export And Install Workflow Polish

## Goal

Improve the handoff from builder to game by learning from AuroraRMG's save workflow, while respecting that this project is a browser app and cannot reliably auto-write to a Steam install folder.

## Current Starting Point

Existing relevant files:

- `src/components/AppShell.tsx`
- `src/components/install/InstallationGuidePage.tsx`
- `src/components/builder/ValidationOutputPanel.tsx`
- `src/previewRenderer.ts`
- `src/community/communityPreviewImage.ts`

The app already exports `.rmg.json`, saves builder `.oetd.json`, and documents install paths.

## Proposed Improvements

1. Export checklist
   - Show final file name.
   - Show whether warnings exist.
   - Show whether a preview PNG is available.
   - Show install folder hint with a link to the Installation Guide.

2. Pair JSON and preview image workflow
   - Make it easier to download both `.rmg.json` and matching `.png`.
   - Keep names aligned so users can copy both into `map_templates`.

3. Stale warning around generated preview/image
   - If a preview image was generated before the latest board edit, mark it stale or regenerate on demand.

4. Platform-specific install hints
   - Windows Steam default path.
   - Custom Steam library note.
   - Steam Deck/Linux locations already documented.

5. Optional browser save-picker improvement
   - When File System Access API exists, prefer save picker for JSON and PNG.
   - Otherwise keep current anchor download fallback.

## Tests

Add or update UI/unit tests:

- Export buttons stay disabled for invalid templates.
- Export warning dialog appears for warnings.
- JSON and PNG download base names match.
- Install guide link is present in export warning/checklist UI.
- Existing community preview image generation still works.

## Acceptance Criteria

- Users can clearly tell what to export and where to put it.
- JSON and preview image naming is consistent.
- The install guide remains the source of detailed path instructions.
- No browser-only workflow assumes direct filesystem write access to Steam folders.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not build a native auto-updater or desktop save-to-game-folder feature.
- Do not perform broad recursive filesystem searches.
- Do not claim successful in-game validation.
