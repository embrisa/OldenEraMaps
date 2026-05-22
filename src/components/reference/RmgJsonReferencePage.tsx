import { BookOpenText, FileJson, FolderOpen, GitBranch, HelpCircle, ShieldAlert } from "lucide-react";
import type { JSX } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const topLevelKeys = [
  ["name", "Template name shown in game. This is what players see when choosing the template, so use a clear map-style name."],
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
      ["orientation", "How the whole layout is rotated. This changes where zones appear on the map without changing the matchup design."],
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
      ["gameMode", "Game mode label. Most normal random map templates use the default game mode behavior."],
      ["displayWinCondition", "The win-condition badge the game shows in the template list, such as classic play or City Hold."],
      ["valueOverrides", "Advanced adjustments for named game values, often used to tune guard or object values."],
      ["globalBans", "Lists of heroes, items, or magic that should not appear in the generated match."]
    ]
  },
  {
    title: "gameRules",
    rows: [
      ["heroHireBan", "When true, blocks hiring extra heroes. This makes scouting and chaining much stricter."],
      ["encounterHoles", "Enables encounter-hole behavior for neutral fights when the template uses it."],
      ["tournamentRules", "Marks tournament-style rules as active. The actual day and score fields live under winConditions."],
      ["factionLawsExpModifier", "Changes experience from faction law effects. Higher values speed up hero development from that source."],
      ["astrologyExpModifier", "Changes experience from astrology effects. Higher values speed up hero development from that source."]
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
      ["tournament*", "Tournament fields: active days, announcement days, points needed to win, and whether armies are saved."]
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
      ["border.obstaclesWidth / waterWidth", "Thickness of obstacle or water bands around the playable area."]
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

const pitfalls = [
  "Builder presets like topology and terrain theme are not raw .rmg.json keys. The exporter compiles them into zones, connections, biomes, and support blocks.",
  "Zone names must be unique, and every connection from/to must match a real zone name.",
  "Zones reference zoneLayouts, mandatoryContent, and contentCountLimits by name. Renaming one side without the other breaks the template.",
  "City Hold needs a valid hold-city target, and Tournament mode requires exactly two players.",
  "The builder can keep generatorPosition for round-tripping, but exported game files should be treated as raw template data, not full builder state.",
  "Validation in this app checks structure and generator invariants. It does not guarantee the game will generate a playable map from every file."
];

export function RmgJsonReferencePage(): JSX.Element {
  return (
    <section className="reference-layout" aria-label="RMG JSON reference guide page">
      <div className="reference-hero">
        <Card className="reference-hero__card">
          <CardHeader>
            <div>
              <CardTitle><BookOpenText size={18} />RMG JSON Reference Guide</CardTitle>
              <CardDescription>
                A practical guide to the raw .rmg.json template shape used by Heroes of Might and Magic: Olden Era,
                grounded in this app&apos;s generator, parser, and bundled fixtures.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="reference-hero__content">
            <p>
              OldenEraMaps edits two layers at once: a friendly builder model and the raw template JSON the game reads.
              This page focuses on the raw export format, but always explains it in terms the builder already uses.
            </p>
            <p>
              You do not need to understand every JSON field to make useful templates. Start with zones, connections,
              guards, rewards, and win conditions; those are the parts players feel most clearly in a match.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="reference-grid">
        <Card>
          <CardHeader>
            <div>
              <CardTitle><GitBranch size={18} />Builder To Export</CardTitle>
              <CardDescription>Use the builder to decide behavior; use raw JSON to inspect and fine-tune the generated result.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="reference-stack">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle><FileJson size={18} />Top-Level Template Shape</CardTitle>
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
              <CardTitle><HelpCircle size={18} />Plain English Map Terms</CardTitle>
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

        <Card className="reference-grid__wide">
          <CardHeader>
            <div>
              <CardTitle><FileJson size={18} />Schema Quick Tables</CardTitle>
              <CardDescription>These are the nested sections most worth recognizing when you inspect or hand-tune an export.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="reference-schema-grid">
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
          </CardContent>
        </Card>

        <Card className="reference-grid__wide">
          <CardHeader>
            <div>
              <CardTitle><FileJson size={18} />Field Directory</CardTitle>
              <CardDescription>More raw fields you may see in exported or imported templates, grouped by where they appear.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="reference-schema-grid">
            {fieldDirectory.map((slice) => (
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
          </CardContent>
        </Card>

        <Card className="reference-grid__wide">
          <CardHeader>
            <div>
              <CardTitle><HelpCircle size={18} />What Actually Changes The Match?</CardTitle>
              <CardDescription>Use this as the player-facing shortcut before editing detailed fields.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="reference-explainer-list">
              {gameplayLevers.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle><ShieldAlert size={18} />Common Pitfalls</CardTitle>
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

      <div className="reference-examples">
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

      </div>
    </section>
  );
}
