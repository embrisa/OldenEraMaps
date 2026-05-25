# AGENTS.md

Guidance for agents working on this repository.

## Project Overview

This is a TypeScript/HTML web app for generating `.rmg.json` random map template files for Heroes of Might and Magic: Olden Era.

The app entry points are:

```text
index.html
src/app.ts
```

The generator/model code lives under:

```text
src/
```

Unit tests live under:

```text
tests/
```

Golden fixtures and example-backed fixtures are stored in:

```text
tests/fixtures
```

Use those examples as the primary local reference for the `.rmg.json` shape and expected naming style.

## Discovering Olden Era `.rmg.json` Files

Olden Era map templates are almost always located under the game's install directory:

```text
[Steam Game Install Location]\HeroesOldenEra_Data\StreamingAssets\map_templates
```

The standard Steam install location is usually:

```text
C:\Program Files (x86)\Steam\steamapps\common\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates
```

Do not assume that path always exists. Users may have installed Steam or the game on another drive, especially on systems with multiple disks or custom Steam libraries.

Useful discovery checks:

```powershell
$defaultTemplates = "${env:ProgramFiles(x86)}\Steam\steamapps\common\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates"
Test-Path $defaultTemplates
Get-ChildItem -Path $defaultTemplates -Filter "*.rmg.json" -ErrorAction SilentlyContinue
```

If the default path is missing, inspect Steam library locations. The primary Steam library file is usually:

```text
C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf
```

Additional libraries typically contain:

```text
[Steam Library]\steamapps\common\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates
```

A quick targeted check for common Steam library roots:

```powershell
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $candidate = Join-Path $_.Root "SteamLibrary\steamapps\common\Heroes of Might and Magic Olden Era\HeroesOldenEra_Data\StreamingAssets\map_templates"
    if (Test-Path $candidate) {
        Get-Item $candidate
    }
}
```

Avoid broad recursive searches across entire drives unless the user asks for that; they can be slow.

## Commands And Testing

This is a Node/Vite/TypeScript project. Install dependencies with:

```bash
npm install
```

Before handing off changes, run the unit tests and production build:

```bash
npm test
npm run build
```

When completed changes include Supabase schema or Edge Function updates, deploy those Supabase changes before the final handoff whenever credentials and project access are available. If deployment cannot be completed, state exactly which Supabase deployment command failed and why.

When changing behavior, always add or update focused Vitest tests around the generator/model/workflow behavior rather than relying only on manual UI checks.

For Supabase schema work on local macOS development with Colima, start Colima first and run Supabase without the logging/vector containers:

```bash
colima start
supabase start -x vector,logflare
```

Plain `supabase start` can fail under Colima because the `vector` logging container tries to bind-mount Colima's Docker socket. `supabase db start`, `supabase db reset`, and `supabase db lint --local` are sufficient for migration smoke tests.

## Visual Testing

For UI changes, run the Vite dev server and visually check the affected workflow. The app should open cleanly, controls should be readable, and the expected action should work without layout breakage.

Typical local run command:

```bash
npm run dev
```

At minimum, verify that the configured options can create a `.rmg.json` file. Generated template validation currently stops there: do not claim that generated templates are guaranteed to generate a playable map in game. In-game validation must be left to users until the project has a reliable automated or documented game-level validation workflow.

## Responsive Scope

The map builder is a desktop-focused tool and phone/small-screen compatibility is not supported. Do not spend effort trying to make the builder fully responsive for phones, and do not treat small-screen builder layout issues as blockers unless they also affect the intended desktop experience.

The builder may use fixed or minimum desktop dimensions where that keeps the board, inspectors, dialogs, and export workflow clear. Preserve desktop usability over squeezing the builder into narrow viewports.

Browse/catalog pages can have limited phone support where it is practical, especially for reading cards, searching, filtering, downloading, or opening a map. This exception does not apply to the map builder itself.

## Development Notes

- Look in "docs/reference/game-data" for Heroes of Might and Magic: Olden Era game information.
- Keep changes scoped to the app's current TypeScript, Vite, and browser UI patterns.
- Add or update unit tests for every behavior change, and do not treat the work as complete until those tests pass.
- Prefer structured JSON serialization/deserialization over manual string editing for template files.
- Treat the bundled example templates as fixtures and references; do not overwrite them during ad hoc testing.
- When saving generated files during testing, use a temporary location unless the user explicitly wants files written into their game install.
- Be careful with paths containing spaces, especially the solution name, project directory, Steam install path, and template filenames.
- Assume other individuals or agents may be working elsewhere in the repository at the same time. Ignore and preserve changes you did not specifically make; do not revert, overwrite, or include them in your work unless the user explicitly asks.
