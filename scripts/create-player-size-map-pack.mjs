import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const outputDir = resolve("generated/player-size-map-pack");

const mapConfigs = [
  {
    playerCount: 2,
    fileName: "2p-twin-crown-rift.rmg.json",
    name: "Twin Crown Rift",
    description: "2-player city-hold duel: mirrored starts push into two safe side markets before a guarded crown city in the rift decides the game. Strict 2-hero limit.",
    settings: {
      seed: 1202,
      mapWidth: 168,
      mapHeight: 168,
      topology: "HubAndSpoke",
      connectionStyle: "Chokepoints",
      contentPreset: "HighRiskHighReward",
      terrainTheme: "Mixed",
      noDirectPlayerConnections: true,
      minNeutralZonesBetweenPlayers: 1,
      experimentalBalancedZonePlacement: true,
      naturalExpansionZone: true,
      matchAdjacentNeutralCastleFactions: true,
      zoneCfg: {
        neutralZoneCount: 4,
        playerZoneCastles: 1,
        neutralZoneCastles: 1,
        hubZoneSize: 1.7,
        hubZoneCastles: 1,
        neutralStackStrengthPercent: 125,
        borderGuardStrengthPercent: 135,
        advanced: { guardRandomization: 0.02 }
      },
      gameEndConditions: { victoryCondition: "win_condition_5", cityHold: true, cityHoldDays: 8 }
    }
  },
  {
    playerCount: 3,
    fileName: "3p-obsidian-triad.rmg.json",
    name: "Obsidian Triad",
    description: "3-player triangle: each corner has a guarded natural, side pressure lanes, and a lava-themed center fortress that creates a three-way final race. Strict 2-hero limit.",
    settings: {
      seed: 1303,
      mapWidth: 180,
      mapHeight: 180,
      topology: "Triangle",
      contentPreset: "ArtifactRich",
      terrainTheme: "Lava",
      noDirectPlayerConnections: true,
      naturalExpansionZone: true,
      zoneCfg: {
        playerZoneCastles: 1,
        hubZoneSize: 1.65,
        hubZoneCastles: 1,
        structureDensityPercent: 125,
        neutralStackStrengthPercent: 120,
        borderGuardStrengthPercent: 130,
        advanced: { guardRandomization: 0.03 }
      },
      gameEndConditions: { victoryCondition: "win_condition_5", cityHold: true, cityHoldDays: 9 }
    }
  },
  {
    playerCount: 4,
    fileName: "4p-compass-keep.rmg.json",
    name: "Compass Keep",
    description: "4-player compass hub: natural expansions give every player a foothold, while four contested approach zones aim everyone toward a rich keep in the middle. Strict 2-hero limit.",
    settings: {
      seed: 1404,
      mapWidth: 192,
      mapHeight: 192,
      topology: "HubAndSpoke",
      connectionStyle: "Balanced",
      contentPreset: "TownFocused",
      terrainTheme: "FactionMatched",
      noDirectPlayerConnections: true,
      minNeutralZonesBetweenPlayers: 1,
      experimentalBalancedZonePlacement: true,
      naturalExpansionZone: true,
      matchAdjacentNeutralCastleFactions: true,
      zoneCfg: {
        neutralZoneCount: 4,
        playerZoneCastles: 1,
        neutralZoneCastles: 1,
        hubZoneSize: 1.75,
        hubZoneCastles: 1,
        structureDensityPercent: 120,
        neutralStackStrengthPercent: 115,
        borderGuardStrengthPercent: 125,
        advanced: { guardRandomization: 0.025 }
      },
      gameEndConditions: { victoryCondition: "win_condition_5", cityHold: true, cityHoldDays: 10 }
    }
  },
  {
    playerCount: 5,
    fileName: "5p-starfall-web.rmg.json",
    name: "Starfall Web",
    description: "5-player shared web: every start touches two contested neutrals, neutral-to-neutral routes create rotating pressure, and portals add late-game raids. Strict 2-hero limit.",
    settings: {
      seed: 1505,
      mapWidth: 208,
      mapHeight: 208,
      topology: "SharedWeb",
      connectionStyle: "ManyRoutes",
      contentPreset: "HighRiskHighReward",
      terrainTheme: "Mixed",
      randomPortals: true,
      maxPortalConnections: 7,
      experimentalBalancedZonePlacement: true,
      matchAdjacentNeutralCastleFactions: true,
      zoneCfg: {
        neutralZoneCount: 7,
        playerZoneCastles: 1,
        neutralZoneCastles: 1,
        resourceDensityPercent: 125,
        structureDensityPercent: 130,
        neutralStackStrengthPercent: 120,
        borderGuardStrengthPercent: 120,
        advanced: { guardRandomization: 0.08 }
      }
    }
  },
  {
    playerCount: 6,
    fileName: "6p-iron-petal-ring.rmg.json",
    name: "Iron Petal Ring",
    description: "6-player protected ring: two neutral petals separate each neighbor, with connector guards delaying rushes and castle zones rewarding calculated expansion. Strict 2-hero limit.",
    settings: {
      seed: 1606,
      mapWidth: 216,
      mapHeight: 216,
      topology: "Default",
      connectionStyle: "SafeLanes",
      contentPreset: "TownFocused",
      terrainTheme: "FactionMatched",
      noDirectPlayerConnections: true,
      minNeutralZonesBetweenPlayers: 2,
      experimentalBalancedZonePlacement: true,
      matchAdjacentNeutralCastleFactions: true,
      zoneCfg: {
        neutralZoneCount: 12,
        playerZoneCastles: 1,
        neutralZoneCastles: 1,
        resourceDensityPercent: 110,
        structureDensityPercent: 120,
        neutralStackStrengthPercent: 110,
        borderGuardStrengthPercent: 120,
        advanced: { guardRandomization: 0.025 }
      }
    }
  },
  {
    playerCount: 7,
    fileName: "7p-sevenfold-ladder.rmg.json",
    name: "Sevenfold Ladder",
    description: "7-player ladder: players fight for staggered rungs on a long treasure spine, so tempo and choosing the right crossing matter more than raw early aggression. Strict 2-hero limit.",
    settings: {
      seed: 1707,
      mapWidth: 224,
      mapHeight: 224,
      topology: "Ladder",
      connectionStyle: "Chokepoints",
      contentPreset: "ArtifactRich",
      terrainTheme: "Snow",
      noDirectPlayerConnections: true,
      minNeutralZonesBetweenPlayers: 1,
      experimentalBalancedZonePlacement: true,
      zoneCfg: {
        neutralZoneCount: 10,
        playerZoneCastles: 1,
        neutralZoneCastles: 1,
        resourceDensityPercent: 105,
        structureDensityPercent: 125,
        neutralStackStrengthPercent: 120,
        borderGuardStrengthPercent: 130,
        advanced: { guardRandomization: 0.035 }
      }
    }
  },
  {
    playerCount: 8,
    fileName: "8p-octant-storm.rmg.json",
    name: "Octant Storm",
    description: "8-player storm hub: eight starts orbit eight contested markets around a dangerous center, with sparse portals creating comeback raids without removing the main race. Strict 2-hero limit.",
    settings: {
      seed: 1808,
      mapWidth: 232,
      mapHeight: 232,
      topology: "HubAndSpoke",
      contentPreset: "CreatureHeavy",
      terrainTheme: "Mixed",
      noDirectPlayerConnections: true,
      randomPortals: true,
      maxPortalConnections: 6,
      minNeutralZonesBetweenPlayers: 1,
      experimentalBalancedZonePlacement: true,
      matchAdjacentNeutralCastleFactions: true,
      zoneCfg: {
        neutralZoneCount: 8,
        playerZoneCastles: 1,
        neutralZoneCastles: 1,
        hubZoneSize: 1.9,
        hubZoneCastles: 1,
        resourceDensityPercent: 115,
        structureDensityPercent: 130,
        neutralStackStrengthPercent: 125,
        borderGuardStrengthPercent: 130,
        advanced: { guardRandomization: 0.06 }
      },
      gameEndConditions: { victoryCondition: "win_condition_5", cityHold: true, cityHoldDays: 12 }
    }
  }
];

const runnerSource = `
  import { mkdirSync, writeFileSync } from "node:fs";
  import { join, resolve } from "node:path";
  import { generateTemplate, serializeTemplate } from "./src/generator.ts";
  import { createDefaultSettings, validateSettings } from "./src/settings.ts";

  const outputDir = ${JSON.stringify(outputDir)};
  const mapConfigs = ${JSON.stringify(mapConfigs, null, 2)};

  function mergeSettings(config) {
    const settings = createDefaultSettings();
    const overrides = config.settings;
    Object.assign(settings, overrides);
    settings.templateName = config.name;
    settings.playerCount = config.playerCount;
    settings.heroSettings = {
      ...settings.heroSettings,
      ...(overrides.heroSettings ?? {}),
      heroCountMin: 2,
      heroCountMax: 2,
      heroCountIncrement: 0
    };
    settings.zoneCfg = {
      ...settings.zoneCfg,
      ...(overrides.zoneCfg ?? {}),
      advanced: {
        ...settings.zoneCfg.advanced,
        ...(overrides.zoneCfg?.advanced ?? {})
      }
    };
    settings.gameEndConditions = {
      ...settings.gameEndConditions,
      ...(overrides.gameEndConditions ?? {})
    };
    settings.gladiatorArenaRules = {
      ...settings.gladiatorArenaRules,
      ...(overrides.gladiatorArenaRules ?? {})
    };
    settings.tournamentRules = {
      ...settings.tournamentRules,
      ...(overrides.tournamentRules ?? {})
    };
    return settings;
  }

  mkdirSync(outputDir, { recursive: true });
  for (const config of mapConfigs) {
    const settings = mergeSettings(config);
    const validation = validateSettings(settings);
    if (validation.errors.length > 0) {
      throw new Error(config.name + " is invalid: " + validation.errors.join("; "));
    }

    const template = generateTemplate(settings);
    template.description = config.description;
    writeFileSync(join(outputDir, config.fileName), serializeTemplate(template), "utf8");
  }
`;

const tmpDir = mkdtempSync(join(tmpdir(), "oldenera-player-size-pack-"));
const bundlePath = join(tmpDir, "runner.mjs");

await esbuild.build({
  stdin: {
    contents: runnerSource,
    resolveDir: process.cwd(),
    sourcefile: "create-player-size-map-pack-runner.ts",
    loader: "ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundlePath,
  logLevel: "silent"
});

await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`);
rmSync(tmpDir, { recursive: true, force: true });

writeFileSync(resolve(outputDir, "README.txt"), [
  "Generated Heroes of Might and Magic: Olden Era .rmg.json map pack.",
  "One template is provided for each supported player count from 2 through 8.",
  "All templates use a strict 2-hero cap: heroCountMin=2, heroCountMax=2, heroCountIncrement=0.",
  "",
  ...mapConfigs.map((item) => `${item.playerCount}P - ${item.name}: ${item.fileName}`),
  ""
].join("\n"), "utf8");
