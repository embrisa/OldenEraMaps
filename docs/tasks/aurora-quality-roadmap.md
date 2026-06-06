# AuroraRMG Quality Roadmap

## Goal

Bring OldenEraMaps closer to the strongest product and generator qualities observed in AuroraRMG while preserving this project's web-first builder, community catalog, and existing TypeScript/Vite architecture.

## Reference

AuroraRMG repository: https://github.com/sany86russ/AuroraRMG

Useful source areas from the reference project:

- `README.en.md`: feature surface, simple/advanced mode split, user-facing workflow.
- `ReadyMaps/`: generated preset templates used as examples.
- `Olden Era - Template Editor/Services/Analysis/`: balance and content summary services.
- `Olden Era - Template Editor/Services/Generation/RandomTemplateBuilder.cs`: simple-mode generation heuristics.
- `Olden Era - Template Editor/Models/Generator/Presets.cs`: broad preset library.
- `Olden Era - Template Editor.Tests/`: focused tests for balance, content summary, validation, generation, localization, landmarks, and JSON export.

## What We Already Have

- Visual board editing and JSON round-trip editing.
- Balanced Random map flow with seed support.
- Faction-matched terrain, city-hold rules, tournament rules, global bans, and value overrides.
- Strong design validation, including graph connectivity and tournament lane checks.
- Remote footholds, starter mines, generated preview images, install guide, and community sharing.

## Task Set

1. [Post-generation map analysis](aurora-post-generation-map-analysis.md)
2. [Simple generation flow](aurora-simple-generation-flow.md)
3. [Preset library expansion](aurora-preset-library-expansion.md)
4. [City Hold target selection](aurora-city-hold-target-selection.md)
5. [Export and install workflow polish](aurora-export-install-workflow-polish.md)

## Suggested Order

1. Build post-generation analysis first. It is pure, testable, and improves every generated/imported map.
2. Improve City Hold target selection next because it is a narrow generator-quality upgrade.
3. Expand Balanced Random into a clearer simple generation flow.
4. Add curated presets once the analysis panel can tell users what a preset produced.
5. Polish export/install workflow after generation and analysis behavior settles.

## Common Verification

- Run focused Vitest coverage for each task.
- Run `npm test`.
- Run `npm run build`.
- For UI-facing tasks, run `npm run dev` and smoke-test the affected builder workflow on a desktop viewport.
- Do not claim generated templates are playable in game without separate in-game validation.

## Guardrails

- Keep each task behavior-focused and avoid broad visual rewrites.
- Preserve existing builder file formats and autosave behavior unless a task explicitly changes them.
- Prefer pure analysis/generator modules with small UI projections.
- Do not overwrite bundled example templates during testing.
- If importing ideas from AuroraRMG, reimplement them in our own TypeScript style rather than copying C# structure directly.
