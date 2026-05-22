# OldenEraMaps

## What is this?

A TypeScript/HTML web app for building, uploading, browsing, rating, and downloading `.rmg.json` map templates for **Heroes of Might and Magic: Olden Era**.

The builder starts from a small 2-player schematic design. Users can add zones, configure each zone, manage connections, and export a template JSON. The board is intentionally a topology diagram. It is not an attempt to accurately depict the final in-game map.

## Features

- Manual schematic board with draggable zone nodes and connection lines
- New design starts with `Spawn-A`, `Neutral-C`, and `Spawn-B`
- Add player, neutral, and hub zones
- Click a zone to configure role, quality, castles, size, terrain, guard/content tuning, roads, footholds, and City Hold targeting
- Connection manager for direct, portal, and proximity links
- Validation before export for connected graphs, missing endpoints, duplicate names, City Hold rules, player count, and zone limits
- Save/open builder designs as `.oetd.json`
- Import old `.oetgs` settings as a one-way migration into an editable design
- Export `.rmg.json` files directly from the browser
- Browse shared maps in-app with search, sorting, downloads, and ratings
- Share maps from the builder through an upload dialog
- Restrict uploads to valid generated `.rmg.json` templates

## Product Direction

OldenEraMaps has two primary product areas:

- Build and upload Olden Era map template files.
- Browse, rate, and download maps shared by the community.

## Important Note

Generated templates should still be validated in game before serious use. The current validation checks template structure and builder invariants; it does not guarantee that the game will generate a playable map from every exported template.

## Running The App

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

Build a production bundle with:

```bash
npm run build
```

Run unit tests with:

```bash
npm test
```

## How To Use

1. Start with the default 2-player design.
2. Add, select, and drag zones on the schematic board.
3. Configure selected zones in the Zone Inspector.
4. Open **Connections** to add or edit links between zones.
5. Fix any validation errors.
6. Export the `.rmg.json` file.
7. Move the `.rmg.json` file to your Olden Era templates folder:

```text
<Olden Era install folder>\HeroesOldenEra_Data\StreamingAssets\map_templates
```

## Community Sharing

- Use **Browse** to search and sort shared maps, download templates, and rate uploads.
- Use **Share Map** from the builder to publish the current design into the catalog.
- Uploads and ratings require sign-in. Anonymous users can browse and download public maps.
- Sharing is only enabled when the current design validates and can be exported as a `.rmg.json`.

## Community Backend Setup

Community features use Supabase for auth, database, storage, and server-side upload validation. The Vite app needs these public browser environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

For OAuth providers, configure provider secrets in Supabase or the local Supabase environment. Do not commit provider client secrets.

Provider callback URLs must point to Supabase Auth, not directly to the Vite app:

```text
https://<project-ref>.supabase.co/auth/v1/callback
http://127.0.0.1:54321/auth/v1/callback
```

Add the app URLs in Supabase Auth redirect settings, for example:

```text
http://localhost:5173
http://127.0.0.1:5173
https://<production-domain>
```

## Recommended Public Launch Stack

- **Frontend hosting:** Vercel. This repo already fits Vercel's SPA deployment flow and preview environments well.
- **Database + backend services:** Supabase. Use Postgres for maps and ratings, Storage for uploaded assets, and Edge Functions or RPCs for upload validation, moderation hooks, and rate limiting.
- **Suggested production rule:** require sign-in for uploads and ratings, and validate submitted JSON server-side before inserting rows or publishing map entries.

## Where Templates Are Stored

Olden Era map templates are usually stored under:

```text
<Olden Era install folder>\HeroesOldenEra_Data\StreamingAssets\map_templates
```

## License

MIT. See `LICENSE`.

## Disclaimer

This project is not affiliated with or endorsed by the developers of Heroes of Might and Magic: Olden Era.
Use generated templates at your own risk.
