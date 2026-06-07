import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("generated/tournament-duel-arena.rmg.json");

const t2Guarded = [
  "classic_template_pool_random_t2_item",
  "classic_template_pool_random_t2_pandora",
  "classic_template_pool_random_t2_hire",
  "classic_template_pool_random_t2_unit_bank",
  "classic_template_pool_random_t2_res_bank",
  "classic_template_pool_random_t2_stat",
  "classic_template_pool_random_t2_magic"
];
const t2Unguarded = [
  "classic_template_pool_random_unguarded_t2_item",
  "classic_template_pool_random_unguarded_t2_pandora",
  "classic_template_pool_random_unguarded_t2_hire",
  "classic_template_pool_random_unguarded_t2_unit_bank",
  "classic_template_pool_random_unguarded_t2_res_bank",
  "classic_template_pool_random_unguarded_t2_stat",
  "classic_template_pool_random_unguarded_t2_magic"
];
const t3Guarded = t2Guarded.map((name) => name.replace("_t2_", "_t3_"));
const t3Unguarded = t2Unguarded.map((name) => name.replace("_t2_", "_t3_"));
const t4Guarded = t2Guarded.map((name) => name.replace("_t2_", "_t4_"));
const t4Unguarded = t2Unguarded.map((name) => name.replace("_t2_", "_t4_"));
const t5Guarded = t2Guarded.map((name) => name.replace("_t2_", "_t5_"));
const t5Unguarded = t2Unguarded.map((name) => name.replace("_t2_", "_t5_"));

const sideContentLimits = (() => {
  const limits = [];
  for (let a = 1; a <= 5; a++) {
    for (let b = a + 1; b <= 6; b++) limits.push(`content_limits_side_${a}_${b}`);
  }
  return limits;
})();

const mainObject = (index) => ({ type: "MainObject", args: [String(index)] });
const connectionEndpoint = (name) => ({ type: "Connection", args: [name] });
const road = (from, to) => ({ from, to });

function zone({
  name,
  size,
  layout = "zone_layout_sides",
  connections = [],
  guardedContentPool,
  unguardedContentPool,
  mandatoryContent = [],
  guardedContentValue,
  guardedContentValuePerArea,
  unguardedContentValue,
  unguardedContentValuePerArea,
  resourcesValue,
  resourcesValuePerArea,
  guardCutoffValue,
  guardMultiplier,
  guardWeeklyIncrement = 0.15,
  guardReactionDistribution = [0, 10, 10, 10, 10, 0],
  mainObjects = [],
  biome = mainObjects.length > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
  roads = []
}) {
  return {
    name,
    size,
    layout,
    guardCutoffValue,
    guardRandomization: 0.03,
    guardMultiplier,
    guardWeeklyIncrement,
    guardReactionDistribution,
    diplomacyModifier: -0.5,
    guardedContentPool,
    unguardedContentPool,
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    mandatoryContent,
    contentCountLimits: sideContentLimits,
    guardedContentValue,
    guardedContentValuePerArea,
    unguardedContentValue,
    unguardedContentValuePerArea,
    resourcesValue,
    resourcesValuePerArea,
    mainObjects,
    zoneBiome: biome,
    contentBiome: biome,
    metaObjectsBiome: biome,
    crossroadsPosition: 0,
    roads
  };
}

function directConnection(name, from, to, guardZone, guardValue, guardMatchGroup, guardWeeklyIncrement = 0.15) {
  return {
    name,
    from,
    to,
    connectionType: "Direct",
    guardZone,
    guardEscape: false,
    simTurnSquad: true,
    guardValue,
    guardWeeklyIncrement,
    guardMatchGroup
  };
}

// 7 Zones construction
const zones = [
  // Center: small, insanely hard middle zone
  zone({
    name: "Center",
    size: 0.35,
    layout: "zone_layout_center",
    connections: ["Treasure-A-Center", "Treasure-B-Center"],
    guardedContentPool: t5Guarded,
    unguardedContentPool: t5Unguarded,
    mandatoryContent: ["mandatory_content_center"],
    guardedContentValue: 400000,
    guardedContentValuePerArea: 10000,
    unguardedContentValue: 0,
    unguardedContentValuePerArea: 0,
    resourcesValue: 0,
    resourcesValuePerArea: 0,
    guardCutoffValue: 4500,
    guardMultiplier: 3.5,
    guardWeeklyIncrement: 0.3,
    guardReactionDistribution: [0, 5, 10, 20, 15, 0],
    biome: { type: "FromList", args: ["Grass"] },
    roads: [
      road(connectionEndpoint("Treasure-A-Center"), connectionEndpoint("Treasure-B-Center"))
    ]
  }),

  // Player A - Spawn-A
  zone({
    name: "Spawn-A",
    size: 1.0,
    layout: "zone_layout_spawns",
    connections: ["Spawn-A-Expansion-A", "Spawn-A-Treasure-A"],
    guardedContentPool: t2Guarded,
    unguardedContentPool: t2Unguarded,
    mandatoryContent: ["mandatory_content_spawn_a"],
    guardedContentValue: 120000,
    guardedContentValuePerArea: 1000,
    unguardedContentValue: 10000,
    unguardedContentValuePerArea: 100,
    resourcesValue: 12000,
    resourcesValuePerArea: 130,
    guardCutoffValue: 900,
    guardMultiplier: 1.0,
    guardReactionDistribution: [70, 20, 5, 5, 0, 0],
    mainObjects: [
      {
        type: "Spawn",
        spawn: "Player1",
        removeGuardIfHasOwner: true,
        guardChance: 1,
        guardValue: 2500,
        guardWeeklyIncrement: 0.08,
        buildingsConstructionSid: "poor_buildings_construction",
        placement: "Uniform",
        placementArgs: ["true", "0.7", "0"]
      }
    ],
    roads: [
      road(mainObject(0), connectionEndpoint("Spawn-A-Expansion-A")),
      road(mainObject(0), connectionEndpoint("Spawn-A-Treasure-A"))
    ]
  }),

  // Player A - Expansion-A (medium farm base, matching faction)
  zone({
    name: "Expansion-A",
    size: 1.15,
    layout: "zone_layout_sides",
    connections: ["Spawn-A-Expansion-A"],
    guardedContentPool: [...t2Guarded, ...t3Guarded],
    unguardedContentPool: [...t2Unguarded, ...t3Unguarded],
    mandatoryContent: ["mandatory_content_expansion_a"],
    guardedContentValue: 240000,
    guardedContentValuePerArea: 1800,
    unguardedContentValue: 18000,
    unguardedContentValuePerArea: 120,
    resourcesValue: 24000,
    resourcesValuePerArea: 190,
    guardCutoffValue: 1200,
    guardMultiplier: 1.2,
    guardReactionDistribution: [10, 20, 20, 10, 5, 0],
    mainObjects: [
      {
        type: "City",
        guardChance: 1,
        guardValue: 10000,
        guardWeeklyIncrement: 0.10,
        buildingsConstructionSid: "poor_buildings_construction",
        faction: { type: "Match", args: ["0", "Spawn-A"] },
        placement: "Uniform"
      }
    ],
    biome: { type: "MatchZone", args: ["Spawn-A"] },
    roads: [
      road(mainObject(0), connectionEndpoint("Spawn-A-Expansion-A"))
    ]
  }),

  // Player A - Treasure-A (high level farm zone)
  zone({
    name: "Treasure-A",
    size: 1.4,
    layout: "zone_layout_treasure_zone",
    connections: ["Spawn-A-Treasure-A", "Treasure-A-Center"],
    guardedContentPool: [...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t3Unguarded, ...t4Unguarded, ...t5Unguarded],
    mandatoryContent: ["mandatory_content_treasure_a"],
    guardedContentValue: 900000,
    guardedContentValuePerArea: 6000,
    unguardedContentValue: 120000,
    unguardedContentValuePerArea: 800,
    resourcesValue: 60000,
    resourcesValuePerArea: 400,
    guardCutoffValue: 2200,
    guardMultiplier: 2.2,
    guardReactionDistribution: [0, 5, 10, 20, 15, 0],
    biome: { type: "MatchZone", args: ["Spawn-A"] },
    roads: [
      road(connectionEndpoint("Spawn-A-Treasure-A"), connectionEndpoint("Treasure-A-Center"))
    ]
  }),

  // Player B - Spawn-B
  zone({
    name: "Spawn-B",
    size: 1.0,
    layout: "zone_layout_spawns",
    connections: ["Spawn-B-Expansion-B", "Spawn-B-Treasure-B"],
    guardedContentPool: t2Guarded,
    unguardedContentPool: t2Unguarded,
    mandatoryContent: ["mandatory_content_spawn_b"],
    guardedContentValue: 120000,
    guardedContentValuePerArea: 1000,
    unguardedContentValue: 10000,
    unguardedContentValuePerArea: 100,
    resourcesValue: 12000,
    resourcesValuePerArea: 130,
    guardCutoffValue: 900,
    guardMultiplier: 1.0,
    guardReactionDistribution: [70, 20, 5, 5, 0, 0],
    mainObjects: [
      {
        type: "Spawn",
        spawn: "Player2",
        removeGuardIfHasOwner: true,
        guardChance: 1,
        guardValue: 2500,
        guardWeeklyIncrement: 0.08,
        buildingsConstructionSid: "poor_buildings_construction",
        placement: "Uniform",
        placementArgs: ["true", "0.7", "0"]
      }
    ],
    roads: [
      road(mainObject(0), connectionEndpoint("Spawn-B-Expansion-B")),
      road(mainObject(0), connectionEndpoint("Spawn-B-Treasure-B"))
    ]
  }),

  // Player B - Expansion-B (medium farm base, matching faction)
  zone({
    name: "Expansion-B",
    size: 1.15,
    layout: "zone_layout_sides",
    connections: ["Spawn-B-Expansion-B"],
    guardedContentPool: [...t2Guarded, ...t3Guarded],
    unguardedContentPool: [...t2Unguarded, ...t3Unguarded],
    mandatoryContent: ["mandatory_content_expansion_b"],
    guardedContentValue: 240000,
    guardedContentValuePerArea: 1800,
    unguardedContentValue: 18000,
    unguardedContentValuePerArea: 120,
    resourcesValue: 24000,
    resourcesValuePerArea: 190,
    guardCutoffValue: 1200,
    guardMultiplier: 1.2,
    guardReactionDistribution: [10, 20, 20, 10, 5, 0],
    mainObjects: [
      {
        type: "City",
        guardChance: 1,
        guardValue: 10000,
        guardWeeklyIncrement: 0.10,
        buildingsConstructionSid: "poor_buildings_construction",
        faction: { type: "Match", args: ["0", "Spawn-B"] },
        placement: "Uniform"
      }
    ],
    biome: { type: "MatchZone", args: ["Spawn-B"] },
    roads: [
      road(mainObject(0), connectionEndpoint("Spawn-B-Expansion-B"))
    ]
  }),

  // Player B - Treasure-B (high level farm zone)
  zone({
    name: "Treasure-B",
    size: 1.4,
    layout: "zone_layout_treasure_zone",
    connections: ["Spawn-B-Treasure-B", "Treasure-B-Center"],
    guardedContentPool: [...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t3Unguarded, ...t4Unguarded, ...t5Unguarded],
    mandatoryContent: ["mandatory_content_treasure_b"],
    guardedContentValue: 900000,
    guardedContentValuePerArea: 6000,
    unguardedContentValue: 120000,
    unguardedContentValuePerArea: 800,
    resourcesValue: 60000,
    resourcesValuePerArea: 400,
    guardCutoffValue: 2200,
    guardMultiplier: 2.2,
    guardReactionDistribution: [0, 5, 10, 20, 15, 0],
    biome: { type: "MatchZone", args: ["Spawn-B"] },
    roads: [
      road(connectionEndpoint("Spawn-B-Treasure-B"), connectionEndpoint("Treasure-B-Center"))
    ]
  })
];

const connections = [
  // Spawn to Expansion
  directConnection("Spawn-A-Expansion-A", "Spawn-A", "Expansion-A", "Expansion-A", 12000, "p1_guard_expansion"),
  directConnection("Spawn-B-Expansion-B", "Spawn-B", "Expansion-B", "Expansion-B", 12000, "p2_guard_expansion"),

  // Spawn to Treasure
  directConnection("Spawn-A-Treasure-A", "Spawn-A", "Treasure-A", "Treasure-A", 25000, "p1_guard_treasure"),
  directConnection("Spawn-B-Treasure-B", "Spawn-B", "Treasure-B", "Treasure-B", 25000, "p2_guard_treasure"),

  // Treasure to Center (Insanely hard guards)
  directConnection("Treasure-A-Center", "Treasure-A", "Center", "Center", 450000, "guard_center_a", 0.25),
  directConnection("Treasure-B-Center", "Treasure-B", "Center", "Center", 450000, "guard_center_b", 0.25)
];

const mandatoryContentGroups = [
  {
    name: "mandatory_content_spawn_a",
    content: [
      { name: "name_mine_wood", sid: "mine_wood", isMine: true },
      { name: "name_mine_ore", sid: "mine_ore", isMine: true },
      { sid: "mine_gold", isMine: true },
      { sid: "mana_well" }
    ]
  },
  {
    name: "mandatory_content_spawn_b",
    content: [
      { name: "name_mine_wood", sid: "mine_wood", isMine: true },
      { name: "name_mine_ore", sid: "mine_ore", isMine: true },
      { sid: "mine_gold", isMine: true },
      { sid: "mana_well" }
    ]
  },
  {
    name: "mandatory_content_expansion_a",
    content: [
      { sid: "mine_gold", isMine: true, isGuarded: true },
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
      { sid: "market" }
    ]
  },
  {
    name: "mandatory_content_expansion_b",
    content: [
      { sid: "mine_gold", isMine: true, isGuarded: true },
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
      { sid: "market" }
    ]
  },
  {
    name: "mandatory_content_treasure_a",
    content: [
      { sid: "mine_gold", isMine: true },
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
      { includeLists: ["content_list_building_utopia"], guardValue: 65000, designatedEncounter: true },
      { includeLists: ["content_list_building_epic_guarded_resource_banks"], guardValue: 65000, designatedEncounter: true },
      { sid: "random_item_legendary", soloEncounter: true }
    ]
  },
  {
    name: "mandatory_content_treasure_b",
    content: [
      { sid: "mine_gold", isMine: true },
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
      { includeLists: ["content_list_building_utopia"], guardValue: 65000, designatedEncounter: true },
      { includeLists: ["content_list_building_epic_guarded_resource_banks"], guardValue: 65000, designatedEncounter: true },
      { sid: "random_item_legendary", soloEncounter: true }
    ]
  },
  {
    name: "mandatory_content_center",
    content: [
      { includeLists: ["basic_content_list_building_hero_stats_and_skills_tier_3"] },
      { sid: "random_item_legendary", soloEncounter: true }
    ]
  }
];

function buildContentCountLimits() {
  const sidLimits = ["black_tower", "fountain", "fountain_2", "mana_well", "market", "forge", "stables", "watchtower", "wind_rose", "university", "wise_owl", "pandora_box"].map((sid) => ({
    sid,
    maxCount: sid === "black_tower" ? 0 : sid === "market" || sid === "stables" || sid === "wind_rose" ? 1 : sid === "pandora_box" ? 4 : 2
  }));
  const limits = [{ name: "content_limits_side", limits: sidLimits }, { name: "content_limits_side_0_0", playerMin: 0, playerMax: 0, limits: sidLimits }];
  for (let a = 1; a <= 5; a++) {
    for (let b = a + 1; b <= 6; b++) limits.push({ name: `content_limits_side_${a}_${b}`, playerMin: a, playerMax: b, limits: sidLimits });
  }
  return limits;
}

function buildZoneLayouts() {
  const layout = (name, obstaclesFill, obstaclesFillVoid, lakesFill, minLakeArea, elevationClusterScale, roadClusterArea, roadAttraction, ambientNoise, groupSizeWeights) => ({
    name,
    obstaclesFill,
    obstaclesFillVoid,
    lakesFill,
    minLakeArea,
    elevationClusterScale,
    elevationModes: [
      { weight: 2, minElevatedFraction: 0.2, maxElevatedFraction: 0.4 },
      { weight: 1, minElevatedFraction: 0.6, maxElevatedFraction: 0.8 }
    ],
    roadClusterArea,
    guardedEncounterResourceFractions: { countBounds: [], fractions: [0.66] },
    ambientPickupDistribution: { repulsion: 1, noise: ambientNoise, roadAttraction, obstacleAttraction: 0, groupSizeWeights }
  });
  return [
    layout("zone_layout_spawns", 0.24, 0.48, 0.3, 16, 0.16, 160, -0.3, 0.4, [20, 2, 1]),
    layout("zone_layout_sides", 0.36, 0.5, 0.25, 16, 0.128, 128, -0.3, 0.3, [20, 2, 1]),
    layout("zone_layout_treasure_zone", 0.5, 0.5, 0.45, 12, 0.12, 96, -0.3, 0.3, [12, 3, 1]),
    layout("zone_layout_center", 0.56, 0.6, 0.3, 10, 0.128, 96, -0.25, 0.3, [12, 4, 1])
  ];
}

const template = {
  name: "Tournament Duel Arena",
  gameMode: "Tournament",
  description: "1v1 tournament rules template. First fight on Week 3 Day 5 (Day 19), recurring every other week on Day 5, first to 7 points wins. Players start with mirrored zones: Spawn -> Matched Expansion -> Treasure Zone. The Center is a very small, insanely guarded chokepoint zone to prevent players from invading each other's territory before the late game. Validate actual map playability in game.",
  displayWinCondition: "win_condition_6",
  sizeX: 176,
  sizeZ: 176,
  gameRules: {
    heroCountMin: 2,
    heroCountMax: 8,
    heroCountIncrement: 1,
    heroHireBan: false,
    encounterHoles: false,
    factionLawsExpModifier: 1,
    astrologyExpModifier: 1,
    bonuses: [],
    winConditions: {
      classic: true,
      desertion: true,
      desertionDay: 3,
      desertionValue: 3000,
      heroLighting: true,
      heroLightingDay: 1,
      lostStartCity: false,
      lostStartHero: true,
      tournament: true,
      tournamentPointsToWin: 7,
      tournamentSaveArmy: true,
      tournamentDays: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      tournamentAnnounceDays: [14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168, 182, 196, 210]
    }
  },
  variants: [
    {
      orientation: {
        zeroAngleZone: "Center",
        baseAngleMin: 90,
        baseAngleMax: 90,
        randomAngleAmplitude: 180,
        randomAngleStep: 180
      },
      border: {
        cornerRadius: 0,
        obstaclesWidth: 3,
        obstaclesNoise: [{ amp: 1, freq: 12 }],
        waterWidth: 0,
        waterNoise: [{ amp: 1, freq: 12 }],
        waterType: "water grass"
      },
      zones,
      connections
    }
  ],
  zoneLayouts: buildZoneLayouts(),
  mandatoryContent: mandatoryContentGroups,
  contentCountLimits: buildContentCountLimits(),
  contentPools: [],
  contentLists: []
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
console.log(`Successfully generated tournament template: ${outputPath}`);
