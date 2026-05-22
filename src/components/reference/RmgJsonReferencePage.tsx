import { BookOpenText, Compass, FileJson, FolderOpen, GitBranch, Search, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState, type JSX } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";

const ringDuelSnippet = `{
  "name": "Golden Ring Duel Balanced",
  "displayWinCondition": "win_condition_1",
  "sizeX": 160,
  "sizeZ": 160,
  "gameRules": {
    "heroCountMin": 3,
    "heroCountMax": 8,
    "heroCountIncrement": 1,
    "winConditions": {
      "classic": true,
      "cityHold": false
    }
  },
  "variants": [
    {
      "zones": [
        {
          "name": "Spawn-2",
          "layout": "zone_layout_spawns",
          "mandatoryContent": ["mandatory_content_side_2"],
          "contentCountLimits": ["content_limits_side_1_2"]
        }
      ],
      "connections": [
        {
          "name": "Ring-2-3",
          "from": "Spawn-2",
          "to": "Neutral-3",
          "connectionType": "Direct"
        }
      ]
    }
  ]
}`;

const cityHoldSnippet = `{
  "name": "Golden King Of The Hill",
  "displayWinCondition": "win_condition_5",
  "gameRules": {
    "winConditions": {
      "classic": true,
      "cityHold": true,
      "cityHoldDays": 6
    }
  },
  "variants": [
    {
      "zones": [
        {
          "name": "Hub",
          "layout": "zone_layout_center",
          "mainObjects": [
            {
              "type": "City",
              "holdCityWinCon": true,
              "placement": "Center"
            }
          ]
        }
      ]
    }
  ]
}`;

const guideSections = [
  ["overview", "Overview"],
  ["builder-export", "Builder to Export"],
  ["template-anatomy", "Template Anatomy"],
  ["field-directory", "Field Directory"],
  ["official-patterns", "Official Patterns"],
  ["examples", "Examples"],
  ["pitfalls-export", "Pitfalls and Export"]
] as const;

const topLevelKeys = [
  ["name", "Template name shown in game. Use a clear map-style name."],
  ["sizeX / sizeZ", "Whole-map width and height in tiles. Bigger numbers usually mean longer travel, more room for zones, and a slower match."],
  ["gameRules", "Match-wide rules: hero limits, movement bonuses, victory conditions, and special mode timing."],
  ["variants", "The actual map plan: where areas are, how they connect, and what border/orientation rules apply. This app currently exports one variant."],
  ["zoneLayouts", "Reusable shape recipes for zones. A zone points to one of these instead of writing all layout details inline."],
  ["mandatoryContent", "Named bundles of important objects the zone should include, such as towns, mines, or required rewards."],
  ["contentCountLimits", "Named caps that stop a zone from getting too many copies of certain object types."],
  ["contentPools / contentLists", "Advanced object-list blocks. The current generator usually leaves them empty unless a future feature needs them."]
] as const;

const schemaSlices = [
  {
    title: "gameRules",
    rows: [
      ["heroCountMin / heroCountMax", "The fewest and most heroes a player can have. Raising the max supports more scouting and expansion."],
      ["heroCountIncrement", "How much owning castles can raise the hero cap. Higher values reward taking extra towns."],
      ["bonuses", "Global bonuses applied by the template. The builder currently uses this for the movement bonus setting."],
      ["winConditions", "Which win rules are active, such as normal defeat-all play, City Hold, Gladiator Arena, or Tournament timing."]
    ]
  },
  {
    title: "variants[0]",
    rows: [
      ["orientation", "How the whole layout is rotated. This changes where zones appear without changing the matchup design."],
      ["border", "What surrounds the playable map edge, usually obstacle and water bands."],
      ["zones", "The player starts, neutral areas, hubs, and objective areas. Most gameplay tuning lives here."],
      ["connections", "The paths between zones. These decide who can reach whom, whether a border is guarded, and whether a road or portal is used."]
    ]
  },
  {
    title: "zone objects",
    rows: [
      ["layout", "The zone's shape and internal road/content style, such as spawn-like or center-like layout."],
      ["mainObjects", "Major fixed objects in the zone, for example a player spawn, city, ruins, or City Hold target."],
      ["mandatoryContent", "Required content bundles for this zone. Think of these as must-have ingredients."],
      ["contentCountLimits", "Limits for repeated content. These keep the generator from overcrowding a zone."],
      ["zoneBiome / contentBiome", "Terrain and visual placement selectors. They affect how the zone looks and where matching content can appear."]
    ]
  }
] as const;

const fieldDirectory = [
  {
    title: "template root",
    rows: [
      ["description", "Optional notes about the template. The app uses this to describe how a generated template was made."],
      ["gameMode", "Game mode label. Official fast formats can use values such as SingleHero."],
      ["displayWinCondition", "The win-condition badge the game shows in the template list, such as classic play, arena, or City Hold."],
      ["valueOverrides", "Advanced adjustments for named game values, often used to tune guard or object values."],
      ["globalBans", "Lists of heroes, items, or magic that should not appear in the generated match."],
      ["sizeX / sizeZ", "Map width and height in tiles. Official quick templates often use smaller sizes than long-form exploration templates."]
    ]
  },
  {
    title: "gameRules",
    rows: [
      ["heroHireBan", "When true, blocks hiring extra heroes. This makes scouting and chaining much stricter."],
      ["encounterHoles", "Enables encounter-hole behavior for neutral fights when the template uses it."],
      ["tournamentRules", "Marks tournament-style rules as active. The actual day and score fields live under winConditions."],
      ["factionLawsExpModifier", "Changes experience from faction law effects. Higher values speed up hero development from that source."],
      ["astrologyExpModifier", "Changes experience from astrology effects. Higher values speed up hero development from that source."],
      ["desertion / heroLighting", "Special pressure rules seen in fast official templates. Treat these as advanced mode-specific timing controls."]
    ]
  },
  {
    title: "winConditions",
    rows: [
      ["classic", "Normal Heroes-style victory: defeat opponents and take control in the usual way."],
      ["lostStartCity / lostStartCityDay", "Controls whether losing the starting city can eliminate a player, and after what day."],
      ["lostStartHero", "Controls whether losing the starting hero can eliminate a player."],
      ["cityHold / cityHoldDays", "Turns on City Hold and sets how many days the marked city must be held."],
      ["gladiatorArena*", "Arena timing fields: registration, fight start delay, fight day count, and champion selection behavior."],
      ["tournament*", "Tournament fields: active days, announcement days, points needed to win, and whether armies are saved."],
      ["desertionDay / desertionValue", "Fast-format loss pressure: when desertion starts and the value threshold attached to it."]
    ]
  },
  {
    title: "variant",
    rows: [
      ["orientation.mode", "How the whole zone graph is rotated or arranged before the map is generated."],
      ["orientation.zeroAngleZone", "The zone used as the rotation anchor. Useful when one area should face a predictable direction."],
      ["orientation.baseAngleMin / baseAngleMax", "Allowed starting angle range for the layout."],
      ["orientation.randomAngleAmplitude / randomAngleStep", "How much random rotation can be added, and the step size used for that randomness."],
      ["border.cornerRadius", "How rounded the playable map edge is."],
      ["border.obstaclesWidth / waterWidth", "Thickness of obstacle or water bands around the playable area."],
      ["connectionsPlacement", "Advanced official-template placement hint that can influence how connection gates are arranged."]
    ]
  },
  {
    title: "border noise",
    rows: [
      ["obstaclesNoise / waterNoise", "Lists of noise entries that make border bands more natural instead of perfectly even."],
      ["amp", "Noise strength. Larger values make the border wiggle more."],
      ["freq", "Noise frequency. Larger values create tighter, more frequent changes."],
      ["waterType", "The water terrain type used when the border includes water."]
    ]
  },
  {
    title: "zone",
    rows: [
      ["name", "Unique zone name. Connections and placement rules refer to this exact text."],
      ["size", "Relative zone size. Larger zones take more map space and can hold more content."],
      ["guardCutoffValue", "Small encounters below this value may be treated differently by the generator."],
      ["guardRandomization", "How much guard strength can vary from the listed value."],
      ["guardMultiplier", "Broad difficulty multiplier for guarded content in the zone."],
      ["guardWeeklyIncrement", "How much guards grow over time."],
      ["guardReactionDistribution", "Weights for how guards react. Treat this as advanced combat behavior tuning."],
      ["diplomacyModifier", "Adjusts diplomacy behavior for encounters in the zone."]
    ]
  },
  {
    title: "zone content values",
    rows: [
      ["guardedContentPool", "Allowed random guarded reward/object pools for this zone."],
      ["unguardedContentPool", "Allowed random unguarded reward/object pools for this zone."],
      ["resourcesContentPool", "Allowed resource pickup pools for this zone."],
      ["guardedContentValue / guardedContentValuePerArea", "Total and area-based budget for guarded objects."],
      ["unguardedContentValue / unguardedContentValuePerArea", "Total and area-based budget for free or lightly protected objects."],
      ["resourcesValue / resourcesValuePerArea", "Total and area-based budget for loose resources and similar pickups."]
    ]
  },
  {
    title: "zone biome and roads",
    rows: [
      ["zoneBiome", "Selector for the ground terrain of the zone."],
      ["contentBiome", "Selector for terrain-compatible content placement inside the zone."],
      ["metaObjectsBiome", "Selector for special objects and decoration-like map elements."],
      ["crossroadsPosition", "Where the zone's internal crossroads point should sit."],
      ["roads", "Road segments inside the zone, usually linking main objects to connections."]
    ]
  },
  {
    title: "mainObjects",
    rows: [
      ["type", "Major object kind, such as Spawn, City, or Ruins."],
      ["spawn", "Player spawn id for Spawn objects, usually Player1, Player2, and so on."],
      ["owner", "Player owner for an object when it should start owned."],
      ["faction / factions", "Faction selector. Match means copy from another object; Random or FromList chooses from allowed factions."],
      ["guardChance / guardValue", "Chance the object is guarded and the approximate guard strength."],
      ["buildingsConstructionSid", "Town building preset, such as poor, rich, or ultra-rich construction."],
      ["placement / placementArgs", "Where and how the object is placed inside the zone."],
      ["holdCityWinCon", "Marks this city as the City Hold objective."]
    ]
  },
  {
    title: "connections",
    rows: [
      ["name", "Connection id. Roads and placement rules can point to it, so keep names stable."],
      ["from / to", "The two zone names this connection links."],
      ["connectionType", "Direct is a normal border route, Portal is teleport-style, Proximity is adjacency guidance."],
      ["guardZone", "Which zone owns the border guard for this route."],
      ["guardEscape / simTurnSquad", "Advanced guard behavior flags used by example-backed templates."],
      ["guardValue / guardRandomization / guardWeeklyIncrement", "Border guard strength, variance, and growth over time."],
      ["guardMatchGroup", "Groups similar guards so related borders can stay comparable."],
      ["road", "Whether the connection should receive road support."],
      ["gatePlacement / length", "Advanced placement and distance hints for the route."]
    ]
  },
  {
    title: "roads and endpoints",
    rows: [
      ["road.type", "Road style or route type when specified."],
      ["from / to", "Endpoints for the road segment."],
      ["endpoint.type", "What the road endpoint targets, such as a main object or connection."],
      ["endpoint.args", "Arguments for the endpoint target, such as object index 0 or a connection name."]
    ]
  },
  {
    title: "zoneLayouts",
    rows: [
      ["obstaclesFill / obstaclesFillVoid", "How much of the zone is filled with blocking terrain and empty pockets."],
      ["lakesFill / minLakeArea", "How much lake terrain appears and how small lakes are allowed to be."],
      ["elevationClusterScale", "How broad elevation areas are."],
      ["elevationModes", "Weighted choices for low/high elevated area fractions."],
      ["roadClusterArea", "How much road-like clustering the layout encourages."],
      ["guardedEncounterResourceFractions", "How resources are split around guarded encounters."],
      ["ambientPickupDistribution", "How loose pickups spread around roads, obstacles, and each other."]
    ]
  },
  {
    title: "mandatoryContent",
    rows: [
      ["name", "Group name referenced by zones."],
      ["content", "The required objects or nested content entries in that group."],
      ["sid", "Specific object id, such as mine_wood, market, watchtower, or pandora_box."],
      ["includeLists", "Named game lists that expand into possible objects."],
      ["isGuarded / isMine", "Marks whether the object is guarded or treated as a mine."],
      ["soloEncounter", "Asks the generator to place the object as its own encounter."],
      ["designatedEncounter", "Marks a special encounter in example-backed content."],
      ["rules", "Placement rules for where the content can appear."]
    ]
  },
  {
    title: "placement rules",
    rows: [
      ["type", "Rule kind, such as Crossroads, MainObject, or another game-supported placement target."],
      ["args", "Extra target arguments for the rule."],
      ["targetMin / targetMax", "Preferred distance range from the target."],
      ["target", "Single target value when a range is not used."],
      ["weight", "How strongly the rule should influence placement."]
    ]
  },
  {
    title: "contentCountLimits",
    rows: [
      ["name", "Limit group name referenced by zones."],
      ["playerMin / playerMax", "Player-count range where the limits apply."],
      ["limits", "The object limits inside this group."],
      ["limits[].sid", "Object id being limited."],
      ["limits[].maxCount", "Maximum number allowed for that object."],
      ["limits[].includeLists", "Lists whose objects are included in the limit."]
    ]
  },
  {
    title: "valueOverrides and bans",
    rows: [
      ["valueOverrides[].sid", "Named value being overridden."],
      ["valueOverrides[].variant", "Optional variant index the override applies to."],
      ["valueOverrides[].guardValue", "Guard value override for the named entry."],
      ["globalBans.items", "Item ids that should not appear."],
      ["globalBans.heroes", "Hero ids that should not appear."],
      ["globalBans.magics", "Magic ids that should not appear."]
    ]
  }
] as const;

const playerTranslations = [
  ["Template", "A reusable recipe for generating a map. It is not one finished map; the game uses it to create a fresh map."],
  ["Zone", "One area of the map, like a player start, nearby expansion, center hub, or contested treasure area."],
  ["Connection", "A route between two zones. If a connection is missing, those areas may not be reachable in the intended way."],
  ["Guard", "Neutral creatures blocking an object or border. Guard multipliers make those fights easier or harder."],
  ["Content", "Objects placed in a zone: resources, mines, buildings, rewards, towns, and similar map items."],
  ["Budget", "How much reward value the generator is allowed to spend in an area. More budget usually means richer or more numerous objects."],
  ["Biome", "The terrain theme used for ground and object placement, such as grass-like, desert-like, or mixed terrain behavior."],
  ["Variant", "One possible layout plan inside the template. OldenEraMaps exports one variant, so most files show variants[0]."]
] as const;

const gameplayLevers = [
  "To make a match longer, increase map size, add more neutral zones, or make key connections harder to break through.",
  "To make expansion faster, lower nearby guard strength, add roads, or keep early zones closer to player starts.",
  "To make the center matter, give the hub important content, stronger rewards, a City Hold target, or several guarded connections.",
  "To keep players balanced, make each spawn zone use the same layout, similar mandatory content, and comparable connection difficulty."
] as const;

const editLevers = [
  ["Map size", "Change sizeX and sizeZ when the whole match should breathe more or resolve faster."],
  ["Zones", "Add, resize, or retune zones when one player needs more room, safer starts, or richer contested areas."],
  ["Connections", "Change routes and guard values when the fight timing, rushing lanes, or center access feel wrong."],
  ["Win conditions", "Edit displayWinCondition and gameRules.winConditions together so the visible badge and actual rules agree."],
  ["Bans and overrides", "Use globalBans and valueOverrides for targeted balance corrections without redesigning the whole template."]
] as const;

const officialTemplatePatterns = [
  {
    title: "Blitz-style pressure",
    source: "Blitz.rmg.json",
    detail: "A compact SingleHero template that combines one-hero play, hero hiring bans, fast loss pressure, Gladiator Arena timing, value overrides, and targeted item bans.",
    fields: ["gameMode", "heroHireBan", "gladiatorArena*", "desertion*", "valueOverrides", "globalBans.items"]
  },
  {
    title: "Jebus Cross-style contest center",
    source: "Jebus Cross.rmg.json",
    detail: "A familiar competitive shape: player starts build toward richer middle territory through guarded lanes. The important JSON idea is repeated zone roles with comparable connections.",
    fields: ["zones", "connections", "guardValue", "guardMatchGroup", "mandatoryContent"]
  },
  {
    title: "Anarchy-style special economy",
    source: "Anarchy.rmg.json",
    detail: "Uses overrides and bans to push the template toward a specific balance envelope while keeping the main structure recognizable.",
    fields: ["valueOverrides", "globalBans", "contentCountLimits", "guardedContentPool"]
  },
  {
    title: "King of the Hill / City Hold objective",
    source: "golden koth-city-hold fixture",
    detail: "City Hold is not one field. The badge, win-condition flags, day count, and a marked city object must line up.",
    fields: ["displayWinCondition", "cityHold", "cityHoldDays", "holdCityWinCon"]
  }
] as const;

const glossary = [
  ["sid", "String id for a game object, bonus, value, item, spell, mine, or list entry."],
  ["variant", "A complete map layout option inside one template. This app exports one variant."],
  ["guardMatchGroup", "A label used to keep related border guards comparable across mirrored or repeated lanes."],
  ["includeLists", "A reference to a named game list that expands into multiple possible objects."],
  ["placementArgs", "Extra arguments for object placement, usually meaningful only with the paired placement type."],
  ["generatorPosition", "Builder round-trip metadata. Useful for this app, but not a gameplay rule by itself."]
] as const;

const pitfalls = [
  "Builder presets like topology and terrain theme are not raw .rmg.json keys. The exporter compiles them into zones, connections, biomes, and support blocks.",
  "Zone names must be unique, and every connection from/to must match a real zone name.",
  "Zones reference zoneLayouts, mandatoryContent, and contentCountLimits by name. Renaming one side without the other breaks the template.",
  "City Hold needs a valid hold-city target, and Tournament mode requires exactly two players.",
  "The builder can keep generatorPosition for round-tripping, but exported game files should be treated as raw template data, not full builder state.",
  "Validation in this app checks structure and generator invariants. It does not guarantee the game will generate a playable map from every file."
];

function matchesFieldQuery(query: string, title: string, row: readonly [string, string]): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${title} ${row[0]} ${row[1]}`.toLowerCase().includes(normalizedQuery);
}

export function RmgJsonReferencePage(): JSX.Element {
  const [fieldQuery, setFieldQuery] = useState("");
  const filteredFieldDirectory = useMemo(
    () => fieldDirectory
      .map((slice) => ({
        ...slice,
        rows: slice.rows.filter((row) => matchesFieldQuery(fieldQuery, slice.title, row))
      }))
      .filter((slice) => slice.rows.length > 0),
    [fieldQuery]
  );
  const visibleFieldCount = filteredFieldDirectory.reduce((total, slice) => total + slice.rows.length, 0);

  return (
    <section className="reference-layout" aria-label="RMG JSON reference guide page">
      <aside className="reference-nav" aria-label="Reference sections">
        <strong><Compass size={16} />Guide</strong>
        {guideSections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </aside>

      <div className="reference-main">
        <section id="overview" className="reference-section reference-section--hero">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><BookOpenText size={18} /></span>
            <div>
              <h1>RMG JSON Reference Guide</h1>
              <p>
                A practical guide to the raw .rmg.json template shape used by Heroes of Might and Magic: Olden Era,
                grounded in this app&apos;s generator, parser, golden fixtures, and bundled official templates.
              </p>
            </div>
          </div>
          <div className="reference-hero__content">
            <p>
              OldenEraMaps edits two layers at once: a friendly builder model and the raw template JSON the game reads.
              This page focuses on the raw export format, but explains it in terms the builder already uses.
            </p>
            <p>
              You do not need to understand every JSON field to make useful templates. Start with zones, connections,
              guards, rewards, and win conditions; those are the parts players feel most clearly in a match.
            </p>
          </div>
        </section>

        <section id="builder-export" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><GitBranch size={18} /></span>
            <div>
              <h2>Builder To Export</h2>
              <p>Use the builder to decide behavior; use raw JSON to inspect and fine-tune the generated result.</p>
            </div>
          </div>
          <div className="reference-flow" aria-label="Builder to export flow">
            <div>
              <strong>Builder settings</strong>
              <span>topology, terrain theme, balanced placement, roads, City Hold</span>
            </div>
            <div>
              <strong>Generator step</strong>
              <span>normalizes presets into zones, connections, guard values, layouts, and support blocks</span>
            </div>
            <div>
              <strong>Exported .rmg.json</strong>
              <span>top-level metadata, gameRules, one variant, named layouts, content groups, and limits</span>
            </div>
          </div>
          <p className="reference-note">
            If you open raw JSON expecting keys like topology or contentPreset, you will not find them. Those are builder-side conveniences.
          </p>
        </section>

        <section id="template-anatomy" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><FileJson size={18} /></span>
            <div>
              <h2>Template Anatomy</h2>
              <p>The outer structure, map terms, and high-impact edits worth learning first.</p>
            </div>
          </div>
          <div className="reference-grid">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Top-Level Template Shape</CardTitle>
                  <CardDescription>The generator&apos;s stable outer structure and the purpose of each section.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="reference-key-grid">
                  {topLevelKeys.map(([key, detail]) => (
                    <div key={key} className="reference-key-grid__row">
                      <dt>{key}</dt>
                      <dd>{detail}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Plain English Map Terms</CardTitle>
                  <CardDescription>Read these first if the raw JSON names feel too technical.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="reference-key-grid">
                  {playerTranslations.map(([key, detail]) => (
                    <div key={key} className="reference-key-grid__row">
                      <dt>{key}</dt>
                      <dd>{detail}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>

          <div className="reference-schema-grid reference-schema-grid--quick">
            {schemaSlices.map((slice) => (
              <section key={slice.title} className="reference-schema-card">
                <h3>{slice.title}</h3>
                <dl className="reference-key-grid reference-key-grid--compact">
                  {slice.rows.map(([key, detail]) => (
                    <div key={key} className="reference-key-grid__row">
                      <dt>{key}</dt>
                      <dd>{detail}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <div className="reference-subsection">
            <h3>What Actually Changes The Match?</h3>
            <ul className="reference-explainer-list">
              {gameplayLevers.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="reference-schema-grid">
            {editLevers.map(([key, detail]) => (
              <section key={key} className="reference-schema-card">
                <h3>{key}</h3>
                <p>{detail}</p>
              </section>
            ))}
          </div>
        </section>

        <section id="field-directory" className="reference-section">
          <div className="reference-section__heading reference-section__heading--with-control">
            <span className="reference-section__icon"><Search size={18} /></span>
            <div>
              <h2>Field Directory</h2>
              <p>Raw fields you may see in exported or imported templates, grouped by where they appear.</p>
            </div>
            <label className="reference-search">
              <span className="oe-field__label">Search fields</span>
              <Input
                aria-label="Search reference fields"
                value={fieldQuery}
                placeholder="guard, cityHold, bans..."
                onChange={(event) => setFieldQuery(event.currentTarget.value)}
              />
            </label>
          </div>
          <p className="reference-note" aria-live="polite">{visibleFieldCount} field rows shown.</p>
          {filteredFieldDirectory.length > 0 ? (
            <div className="reference-schema-grid">
              {filteredFieldDirectory.map((slice) => (
                <section key={slice.title} className="reference-schema-card">
                  <h3>{slice.title}</h3>
                  <dl className="reference-key-grid reference-key-grid--compact">
                    {slice.rows.map(([key, detail]) => (
                      <div key={key} className="reference-key-grid__row">
                        <dt>{key}</dt>
                        <dd>{detail}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          ) : <div className="empty-state">No reference fields match this search.</div>}
        </section>

        <section id="official-patterns" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><Sparkles size={18} /></span>
            <div>
              <h2>Official Template Patterns</h2>
              <p>Compact notes from the bundled official templates. Use these as pattern references, not full copies.</p>
            </div>
          </div>
          <div className="reference-pattern-grid">
            {officialTemplatePatterns.map((pattern) => (
              <article key={pattern.title} className="reference-pattern-card">
                <div>
                  <h3>{pattern.title}</h3>
                  <span>{pattern.source}</span>
                </div>
                <p>{pattern.detail}</p>
                <ul className="reference-token-list" aria-label={`${pattern.title} fields`}>
                  {pattern.fields.map((field) => <li key={field}><code>{field}</code></li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="reference-subsection">
            <h3>Glossary For Official Template Terms</h3>
            <dl className="reference-key-grid reference-key-grid--compact">
              {glossary.map(([key, detail]) => (
                <div key={key} className="reference-key-grid__row">
                  <dt>{key}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="examples" className="reference-section reference-examples">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><FileJson size={18} /></span>
            <div>
              <h2>Examples</h2>
              <p>Small snippets based on local golden fixtures. They show shape and intent without embedding full templates.</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Fixture Example: Ring Duel</CardTitle>
                <CardDescription>Based on the bundled golden fixture for a standard generated duel template.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="reference-example-card">
              <div className="reference-example-card__copy">
                <p>
                  This is the clearest baseline example for the default generated structure: classic win condition,
                  one variant, named support blocks, and direct connections between spawn and neutral zones.
                </p>
                <p>
                  In player terms, this means each side gets a start area, nearby neutral areas, and roads or borders that
                  guide the early fight. The JSON is mostly naming those areas and saying how they are connected.
                </p>
                <ul className="reference-list">
                  <li><strong>displayWinCondition</strong> is <code>win_condition_1</code> for classic play.</li>
                  <li><strong>heroCountMin</strong> is serialized as 3 in the golden output.</li>
                  <li><strong>mandatoryContent</strong> and <strong>contentCountLimits</strong> are referenced by name from the zone.</li>
                </ul>
              </div>
              <pre className="reference-code"><code>{ringDuelSnippet}</code></pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Fixture Example: City Hold</CardTitle>
                <CardDescription>Based on the bundled King of the Hill golden fixture.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="reference-example-card">
              <div className="reference-example-card__copy">
                <p>
                  City Hold is a good example of how the builder writes a user-facing rule into multiple raw fields:
                  a displayed win condition, nested gameRules.winConditions values, and a designated hold city in the variant.
                </p>
                <p>
                  For players, the important point is simple: one city becomes the objective, and the template tells the
                  game how many days it must be held before that player wins.
                </p>
                <ul className="reference-list">
                  <li><strong>displayWinCondition</strong> switches to <code>win_condition_5</code>.</li>
                  <li><strong>winConditions.cityHold</strong> and <strong>cityHoldDays</strong> carry the actual rule.</li>
                  <li><strong>holdCityWinCon</strong> marks the concrete city object that satisfies the condition.</li>
                </ul>
              </div>
              <pre className="reference-code"><code>{cityHoldSnippet}</code></pre>
            </CardContent>
          </Card>
        </section>

        <section id="pitfalls-export" className="reference-section">
          <div className="reference-section__heading">
            <span className="reference-section__icon"><ShieldAlert size={18} /></span>
            <div>
              <h2>Pitfalls and Export Path</h2>
              <p>Checks that prevent broken imports, broken expectations, or files saved in the wrong place.</p>
            </div>
          </div>
          <div className="reference-grid">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Common Pitfalls</CardTitle>
                  <CardDescription>These are the mistakes most likely to break imports, validation, or expectations.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="reference-list">
                  {pitfalls.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle><FolderOpen size={18} />Where Templates Belong</CardTitle>
                  <CardDescription>When a file looks valid but does not appear in game, path issues are still the first thing to check.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="reference-stack">
                <div className="reference-callout">
                  <strong>Standard install location</strong>
                  <code>{`<Olden Era install folder>\\HeroesOldenEra_Data\\StreamingAssets\\map_templates`}</code>
                </div>
                <p className="reference-note">
                  Save Design creates a builder-focused .oetd.json file. Export creates the game-facing .rmg.json file.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </section>
  );
}
