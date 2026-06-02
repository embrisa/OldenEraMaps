import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("generated/duel-gauntlet-city-hold.rmg.json");
const players = [1, 2];

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
    guardRandomization: 0.025,
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

function spawnZone(player) {
  return zone({
    name: `Spawn-${player}`,
    size: 0.68,
    layout: "zone_layout_spawns",
    connections: [`P${player}-S1-N2`],
    guardedContentPool: t2Guarded,
    unguardedContentPool: t2Unguarded,
    mandatoryContent: [`mandatory_content_p${player}_s1`],
    guardedContentValue: 110000,
    guardedContentValuePerArea: 900,
    unguardedContentValue: 9000,
    unguardedContentValuePerArea: 90,
    resourcesValue: 12000,
    resourcesValuePerArea: 130,
    guardCutoffValue: 850,
    guardMultiplier: 1.08,
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

function middleGauntletZone(player) {
  const playerTerrain = { type: "MatchZone", args: [`Spawn-${player}`] };
  return zone({
    name: `P${player}-N2`,
    size: 0.86,
    connections: [`P${player}-S1-N2`, `P${player}-N2-N3`],
    guardedContentPool: [...t2Guarded, ...t3Guarded],
    unguardedContentPool: [...t2Unguarded, ...t3Unguarded],
    mandatoryContent: [`mandatory_content_p${player}_n2`],
    guardedContentValue: 185000,
    guardedContentValuePerArea: 1350,
    unguardedContentValue: 16000,
    unguardedContentValuePerArea: 120,
    resourcesValue: 24000,
    resourcesValuePerArea: 190,
    guardCutoffValue: 1300,
    guardMultiplier: 1.32,
    guardReactionDistribution: [10, 20, 20, 10, 5, 0],
    biome: playerTerrain
  });
}

function lateGauntletZone(player) {
  const playerTerrain = { type: "MatchZone", args: [`Spawn-${player}`] };
  return zone({
    name: `P${player}-N3`,
    size: 1.08,
    connections: [`P${player}-N2-N3`, `P${player}-N3-N4`],
    guardedContentPool: [...t3Guarded, ...t4Guarded],
    unguardedContentPool: [...t3Unguarded, ...t4Unguarded],
    mandatoryContent: [`mandatory_content_p${player}_n3`],
    guardedContentValue: 300000,
    guardedContentValuePerArea: 2050,
    unguardedContentValue: 22000,
    unguardedContentValuePerArea: 150,
    resourcesValue: 38000,
    resourcesValuePerArea: 260,
    guardCutoffValue: 1550,
    guardMultiplier: 1.46,
    guardReactionDistribution: [0, 10, 15, 15, 10, 0],
    biome: playerTerrain
  });
}

function finalGauntletZone(player) {
  const castleFaction = { type: "Match", args: ["0", `Spawn-${player}`] };
  return zone({
    name: `P${player}-N4`,
    size: 1.38,
    layout: "zone_layout_treasure_zone",
    connections: [`P${player}-N3-N4`, `P${player}-N4-Center`],
    guardedContentPool: [...t3Guarded, ...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t3Unguarded, ...t4Unguarded],
    mandatoryContent: [`mandatory_content_p${player}_n4`],
    guardedContentValue: 520000,
    guardedContentValuePerArea: 3100,
    unguardedContentValue: 30000,
    unguardedContentValuePerArea: 190,
    resourcesValue: 62000,
    resourcesValuePerArea: 390,
    guardCutoffValue: 1850,
    guardMultiplier: 1.62,
    guardWeeklyIncrement: 0.18,
    guardReactionDistribution: [0, 5, 10, 20, 15, 0],
    mainObjects: [
      {
        type: "City",
        guardChance: 1,
        guardValue: 24000,
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
  const connections = players.map((player) => `P${player}-N4-Center`);
  return zone({
    name: "Center",
    size: 1.08,
    layout: "zone_layout_center",
    connections,
    guardedContentPool: [...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t4Unguarded],
    mandatoryContent: [],
    guardedContentValue: 300000,
    guardedContentValuePerArea: 2400,
    unguardedContentValue: 0,
    unguardedContentValuePerArea: 0,
    resourcesValue: 0,
    resourcesValuePerArea: 0,
    guardCutoffValue: 2100,
    guardMultiplier: 1.75,
    guardWeeklyIncrement: 0.22,
    guardReactionDistribution: [0, 0, 10, 20, 20, 0],
    mainObjects: [
      {
        type: "City",
        guardChance: 1,
        guardValue: 70000,
        guardWeeklyIncrement: 0.12,
        buildingsConstructionSid: "ultra_rich_buildings_construction",
        faction: { type: "FromList", args: [] },
        placement: "Center",
        placementArgs: [],
        holdCityWinCon: true
      }
    ]
  });
}

function gauntletConnections(player) {
  return [
    directConnection(`P${player}-S1-N2`, `Spawn-${player}`, `P${player}-N2`, `P${player}-N2`, 10000, `p${player}_guard_s1_n2`),
    directConnection(`P${player}-N2-N3`, `P${player}-N2`, `P${player}-N3`, `P${player}-N3`, 22000, `p${player}_guard_n2_n3`, 0.16),
    directConnection(`P${player}-N3-N4`, `P${player}-N3`, `P${player}-N4`, `P${player}-N4`, 34000, `p${player}_guard_n3_n4`, 0.17),
    directConnection(`P${player}-N4-Center`, `P${player}-N4`, "Center", "Center", 58000, `p${player}_guard_n4_center`, 0.18)
  ];
}

function mandatoryContent(player, step) {
  if (step === "s1") {
    return [
      { name: "name_mine_wood", sid: "mine_wood", isMine: true, isGuarded: true },
      { name: "name_mine_ore", sid: "mine_ore", isMine: true, isGuarded: true },
      { sid: "mana_well" },
      { sid: "market", isGuarded: true }
    ];
  }
  if (step === "n2") {
    return [
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true },
      { sid: "watchtower", isGuarded: true },
      { includeLists: ["basic_content_list_building_hero_stats_and_skills_tier_2"] },
      { includeLists: ["content_list_building_random_hires_low_tier"] },
      { sid: "pandora_box", soloEncounter: true }
    ];
  }
  if (step === "n3") {
    return [
      { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
      { includeLists: ["basic_content_list_building_hero_stats_and_skills_tier_2"] },
      { includeLists: ["content_list_building_random_hires_high_tier"] },
      { sid: "pandora_box", soloEncounter: true },
      { sid: "market", isGuarded: true }
    ];
  }
  return [
    { sid: "mine_gold", isMine: true, isGuarded: true },
    { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true, isGuarded: true },
    { includeLists: ["content_list_building_utopia"], guardValue: 56000, designatedEncounter: true },
    { includeLists: ["content_list_building_epic_guarded_resource_banks"], guardValue: 56000, designatedEncounter: true },
    { includeLists: ["content_list_building_random_hires_high_tier"] },
    { sid: "random_item_legendary", soloEncounter: true },
    { sid: "pandora_box", soloEncounter: true }
  ];
}

function buildMandatoryContent() {
  const groups = [];
  for (const player of players) {
    groups.push({ name: `mandatory_content_p${player}_s1`, content: mandatoryContent(player, "s1") });
    groups.push({ name: `mandatory_content_p${player}_n2`, content: mandatoryContent(player, "n2") });
    groups.push({ name: `mandatory_content_p${player}_n3`, content: mandatoryContent(player, "n3") });
    groups.push({ name: `mandatory_content_p${player}_n4`, content: mandatoryContent(player, "n4") });
  }
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
    layout("zone_layout_center", 0.44, 0.56, 0.24, 14, 0.14, 128, -0.28, 0.3, [16, 3, 1])
  ];
}

const zones = [centerZone()];
for (const player of players) {
  zones.push(spawnZone(player));
  zones.push(middleGauntletZone(player));
  zones.push(lateGauntletZone(player));
  zones.push(finalGauntletZone(player));
}

const template = {
  name: "Duel Gauntlet City Hold",
  gameMode: "Classic",
  description: "1v1 mirrored gauntlet. Each player progresses through four private zones: a starting castle zone, two increasingly larger farm-and-treasure zones, and a largest final castle zone before committing into a small high-risk center. The center city must be held for 50 days. Template validation only; validate actual map playability in game.",
  displayWinCondition: "win_condition_5",
  sizeX: 176,
  sizeZ: 176,
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
      cityHoldDays: 50
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
      connections: players.flatMap(gauntletConnections)
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
