import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("generated/4-player-gauntlet-city-hold.rmg.json");

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

function roadNetwork(connections, mainObjectCount) {
  if (mainObjectCount > 0) {
    const roads = connections.map((connection) => road(mainObject(0), connectionEndpoint(connection)));
    for (let i = 1; i < mainObjectCount; i++) roads.push(road(mainObject(0), mainObject(i)));
    return roads;
  }
  const [first, ...rest] = connections;
  if (!first) return [];
  if (rest.length === 0) return [road(connectionEndpoint(first), connectionEndpoint(first))];
  return rest.map((connection) => road(connectionEndpoint(first), connectionEndpoint(connection)));
}

function zone({
  name,
  size,
  layout = "zone_layout_sides",
  connections,
  guardedContentPool,
  unguardedContentPool,
  mandatoryContent,
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
  biome = mainObjects.length > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] }
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
    roads: roadNetwork(connections, mainObjects.length)
  };
}

function directConnection(name, from, to, guardZone, guardValue, guardMatchGroup) {
  return {
    name,
    from,
    to,
    connectionType: "Direct",
    guardZone,
    guardEscape: false,
    simTurnSquad: true,
    guardValue,
    guardWeeklyIncrement: 0.15,
    guardMatchGroup
  };
}

function spawnZone(player) {
  const name = `Spawn-${player}`;
  const connections = [`P${player}-S1-N2`];
  return zone({
    name,
    size: 0.55,
    connections,
    guardedContentPool: t2Guarded,
    unguardedContentPool: t2Unguarded,
    mandatoryContent: [`mandatory_content_p${player}_s1`],
    guardedContentValue: 90000,
    guardedContentValuePerArea: 750,
    unguardedContentValue: 8000,
    unguardedContentValuePerArea: 80,
    resourcesValue: 9000,
    resourcesValuePerArea: 120,
    guardCutoffValue: 800,
    guardMultiplier: 1.05,
    guardReactionDistribution: [70, 20, 5, 5, 0, 0],
    mainObjects: [
      {
        type: "Spawn",
        spawn: `Player${player}`,
        removeGuardIfHasOwner: true,
        guardChance: 1,
        guardValue: 2500,
        guardWeeklyIncrement: 0.08,
        buildingsConstructionSid: "poor_buildings_construction",
        placement: "Uniform",
        placementArgs: ["true", "0.7", "0"]
      }
    ]
  });
}

function neutralZone(player, step) {
  const name = `P${player}-N${step}`;
  const previous = step === 2 ? `Spawn-${player}` : `P${player}-N${step - 1}`;
  const next = step === 5 ? "Center" : `P${player}-N${step + 1}`;
  const incoming = `P${player}-${step === 2 ? "S1" : `N${step - 1}`}-N${step}`;
  const outgoing = `P${player}-N${step}-${step === 5 ? "Center" : `N${step + 1}`}`;
  const connections = [incoming, outgoing];
  void previous;
  void next;
  const castleFaction = { type: "Match", args: ["0", `Spawn-${player}`] };
  const playerTerrain = { type: "MatchZone", args: [`Spawn-${player}`] };

  if (step === 2) {
    return zone({
      name,
      size: 0.72,
      connections,
      guardedContentPool: t2Guarded,
      unguardedContentPool: t2Unguarded,
      mandatoryContent: [`mandatory_content_p${player}_n2`],
      guardedContentValue: 135000,
      guardedContentValuePerArea: 1050,
      unguardedContentValue: 12000,
      unguardedContentValuePerArea: 100,
      resourcesValue: 14000,
      resourcesValuePerArea: 130,
      guardCutoffValue: 1200,
      guardMultiplier: 1.2,
      biome: playerTerrain
    });
  }

  if (step === 3) {
    return zone({
      name,
      size: 0.86,
      connections,
      guardedContentPool: [...t2Guarded, ...t3Guarded],
      unguardedContentPool: [...t2Unguarded, ...t3Unguarded],
      mandatoryContent: [`mandatory_content_p${player}_n3`],
      guardedContentValue: 190000,
      guardedContentValuePerArea: 1400,
      unguardedContentValue: 16000,
      unguardedContentValuePerArea: 120,
      resourcesValue: 22000,
      resourcesValuePerArea: 180,
      guardCutoffValue: 1400,
      guardMultiplier: 1.32,
      mainObjects: [
        {
          type: "City",
          guardChance: 1,
          guardValue: 9000,
          guardWeeklyIncrement: 0.1,
          buildingsConstructionSid: "poor_buildings_construction",
          faction: castleFaction,
          placement: "Uniform",
          placementArgs: ["true", "0.8", "2"]
        }
      ]
    });
  }

  if (step === 4) {
    return zone({
      name,
      size: 1,
      connections,
      guardedContentPool: [...t3Guarded, ...t4Guarded],
      unguardedContentPool: [...t3Unguarded, ...t4Unguarded],
      mandatoryContent: [`mandatory_content_p${player}_n4`],
      guardedContentValue: 280000,
      guardedContentValuePerArea: 1900,
      unguardedContentValue: 22000,
      unguardedContentValuePerArea: 160,
      resourcesValue: 34000,
      resourcesValuePerArea: 260,
      guardCutoffValue: 1500,
      guardMultiplier: 1.45,
      guardReactionDistribution: [0, 10, 15, 15, 10, 0],
      biome: playerTerrain
    });
  }

  return zone({
    name,
    size: 1.25,
    layout: "zone_layout_treasure_zone",
    connections,
    guardedContentPool: [...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t4Unguarded, ...t5Unguarded],
    mandatoryContent: [`mandatory_content_p${player}_n5`],
    guardedContentValue: 520000,
    guardedContentValuePerArea: 3000,
    unguardedContentValue: 28000,
    unguardedContentValuePerArea: 200,
    resourcesValue: 52000,
    resourcesValuePerArea: 360,
    guardCutoffValue: 1800,
    guardMultiplier: 1.65,
    guardReactionDistribution: [0, 5, 10, 20, 15, 0],
    mainObjects: [
      {
        type: "City",
        guardChance: 1,
        guardValue: 25000,
        guardWeeklyIncrement: 0.12,
        buildingsConstructionSid: "rich_buildings_construction",
        faction: castleFaction,
        placement: "Uniform",
        placementArgs: ["true", "0.8", "2"]
      }
    ]
  });
}

function centerZone() {
  const connections = [1, 2, 3, 4].map((player) => `P${player}-N5-Center`);
  return zone({
    name: "Center",
    size: 1.6,
    layout: "zone_layout_center",
    connections,
    guardedContentPool: [...t5Guarded],
    unguardedContentPool: [...t5Unguarded],
    mandatoryContent: ["mandatory_content_center"],
    guardedContentValue: 650000,
    guardedContentValuePerArea: 3600,
    unguardedContentValue: 0,
    unguardedContentValuePerArea: 0,
    resourcesValue: 0,
    resourcesValuePerArea: 0,
    guardCutoffValue: 2200,
    guardMultiplier: 1.8,
    guardWeeklyIncrement: 0.2,
    guardReactionDistribution: [0, 5, 10, 20, 15, 0],
    mainObjects: [
      {
        type: "City",
        guardChance: 1,
        guardValue: 60000,
        guardWeeklyIncrement: 0.12,
        buildingsConstructionSid: "ultra_rich_buildings_construction",
        faction: { type: "FromList", args: [] },
        placement: "Center",
        placementArgs: [],
        holdCityWinCon: true
      },
      {
        type: "Ruins",
        guardChance: 1,
        guardValue: 18000,
        guardWeeklyIncrement: 0.1,
        buildingsConstructionSid: "rich_buildings_construction",
        factions: { type: "FromList", args: [] },
        placement: "Uniform",
        placementArgs: ["false", "-0.8", "3"]
      }
    ]
  });
}

function gauntletConnections(player) {
  return [
    directConnection(`P${player}-S1-N2`, `Spawn-${player}`, `P${player}-N2`, `P${player}-N2`, 8000, `p${player}_guard_s1_n2`),
    directConnection(`P${player}-N2-N3`, `P${player}-N2`, `P${player}-N3`, `P${player}-N3`, 14000, `p${player}_guard_n2_n3`),
    directConnection(`P${player}-N3-N4`, `P${player}-N3`, `P${player}-N4`, `P${player}-N4`, 22000, `p${player}_guard_n3_n4`),
    directConnection(`P${player}-N4-N5`, `P${player}-N4`, `P${player}-N5`, `P${player}-N5`, 32000, `p${player}_guard_n4_n5`),
    directConnection(`P${player}-N5-Center`, `P${player}-N5`, "Center", "Center", 45000, `p${player}_guard_n5_center`)
  ];
}

function mandatoryContent(player, step) {
  if (step === "s1") {
    return [
      { name: "name_mine_wood", sid: "mine_wood", isMine: true, isGuarded: true },
      { name: "name_mine_ore", sid: "mine_ore", isMine: true, isGuarded: true },
      { sid: "mana_well" }
    ];
  }
  if (step === "n2") {
    return [
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true },
      { sid: "market", isGuarded: true },
      { includeLists: ["content_list_building_random_hires_low_tier"] }
    ];
  }
  if (step === "n3") {
    return [
      { sid: "mine_gold", isMine: true, isGuarded: true },
      { sid: "watchtower", isGuarded: true },
      { sid: "market", isGuarded: true }
    ];
  }
  if (step === "n4") {
    return [
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
      { includeLists: ["basic_content_list_building_hero_stats_and_skills_tier_2"] },
      { includeLists: ["content_list_building_random_hires_high_tier"] },
      { sid: "pandora_box", soloEncounter: true }
    ];
  }
  return [
    { sid: "mine_gold", isMine: true },
    { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
    { includeLists: ["content_list_building_utopia"], guardValue: 60000, designatedEncounter: true },
    { includeLists: ["content_list_building_epic_guarded_resource_banks"], guardValue: 60000, designatedEncounter: true },
    { includeLists: ["content_list_building_random_hires_high_tier"] },
    { sid: "random_item_legendary", soloEncounter: true },
    { sid: "pandora_box", soloEncounter: true }
  ];
}

function buildMandatoryContent() {
  const groups = [];
  for (let player = 1; player <= 4; player++) {
    groups.push({ name: `mandatory_content_p${player}_s1`, content: mandatoryContent(player, "s1") });
    groups.push({ name: `mandatory_content_p${player}_n2`, content: mandatoryContent(player, "n2") });
    groups.push({ name: `mandatory_content_p${player}_n3`, content: mandatoryContent(player, "n3") });
    groups.push({ name: `mandatory_content_p${player}_n4`, content: mandatoryContent(player, "n4") });
    groups.push({ name: `mandatory_content_p${player}_n5`, content: mandatoryContent(player, "n5") });
  }
  groups.push({
    name: "mandatory_content_center",
    content: [
      { includeLists: ["basic_content_list_building_hero_stats_and_skills_tier_3"] },
      { sid: "random_item_legendary", soloEncounter: true }
    ]
  });
  return groups;
}

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

const zones = [centerZone()];
for (let player = 1; player <= 4; player++) {
  zones.push(spawnZone(player));
  for (let step = 2; step <= 5; step++) zones.push(neutralZone(player, step));
}

const template = {
  name: "Four Player Gauntlet City Hold",
  gameMode: "Classic",
  description: "Four isolated player gauntlets. Each player progresses Spawn S1 -> N2 -> N3 faction castle -> N4 -> N5 high-end faction castle -> Center. The center hold city must be held for 40 days; validate generated maps in game.",
  displayWinCondition: "win_condition_5",
  sizeX: 200,
  sizeZ: 200,
  gameRules: {
    heroCountMin: 3,
    heroCountMax: 8,
    heroCountIncrement: 1,
    heroHireBan: false,
    encounterHoles: false,
    factionLawsExpModifier: 1,
    astrologyExpModifier: 1,
    bonuses: [{ sid: "add_bonus_hero_stat", receiverSide: -1, receiverFilter: "all_heroes", parameters: ["movementBonus", "0"] }],
    winConditions: {
      classic: true,
      desertion: true,
      desertionDay: 3,
      desertionValue: 3000,
      heroLighting: true,
      heroLightingDay: 1,
      lostStartCity: false,
      lostStartCityDay: 3,
      lostStartHero: false,
      cityHold: true,
      cityHoldDays: 40
    }
  },
  variants: [
    {
      orientation: {
        zeroAngleZone: "Spawn-1",
        baseAngleMin: 45,
        baseAngleMax: 45,
        randomAngleAmplitude: 360,
        randomAngleStep: 360 / zones.length
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
      connections: [1, 2, 3, 4].flatMap(gauntletConnections)
    }
  ],
  zoneLayouts: buildZoneLayouts(),
  mandatoryContent: buildMandatoryContent(),
  contentCountLimits: buildContentCountLimits(),
  contentPools: [],
  contentLists: []
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
console.log(outputPath);
