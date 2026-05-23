import { describe, expect, it } from "vitest";
import { snapPointToBoardSlot } from "../src/boardSlots";
import {
  addConnectionBetween,
  addZone,
  applyRmgJsonToDesign,
  createDefaultDesign,
  createZone,
  designToTemplate,
  duplicateZone,
  parseDesignOrTemplateFile,
  parseDesignOrTemplateFileResult,
  serializeDesignFile,
  setDesignPlayerCount,
  templateToDesign,
  transferZoneSettings,
  validateDesign,
  zoneConfigSignature
} from "../src/design";
import { parseRmgTemplate, serializeRmgTemplate } from "../src/types";

describe("manual template design", () => {
  it("starts with a connected two-player starter design", () => {
    const design = createDefaultDesign();

    expect(design.templateDescription).toBe("Built with www.OldenEraMaps.com");
    expect(design.lockMapDimensions).toBe(true);
    expect(design.zones.map((zone) => zone.name)).toEqual(["Spawn-1", "Neutral-3", "Spawn-2"]);
    expect(design.zones.filter((zone) => zone.role === "Spawn")).toHaveLength(2);
    expect(design.connections.map((connection) => [connection.from, connection.to])).toEqual([
      ["zone-1", "zone-3"],
      ["zone-3", "zone-2"]
    ]);
    expect(validateDesign(design).errors).toEqual([]);
  });

  it("compiles a manual design to a parseable rmg template", () => {
    const design = createDefaultDesign();
    design.templateName = "Manual Vitest Template";
    design.templateDescription = "Custom description shown in game and browse.";
    design.zones[1].quality = "High";
    design.zones[1].holdCity = true;
    design.zones[1].layout = "zone_layout_treasure_zone";
    design.zones[1].guardCutoffValue = 4321;
    design.zones[1].guardMultiplier = 1.7;
    design.zones[1].guardReactionDistribution = [1, 2, 3, 4, 5, 6];
    design.zones[1].guardedContentPool = ["example_guarded_pool"];
    design.zones[1].resourcesContentPool = ["example_resources_pool"];
    design.zones[1].zoneBiome = { type: "FromList", args: ["Sand"] };
    design.gameEndConditions.cityHold = true;
    design.gameEndConditions.victoryCondition = "win_condition_5";

    const template = designToTemplate(design);
    const serialized = serializeRmgTemplate(template);
    const reparsed = parseRmgTemplate(serialized);
    const variant = reparsed.variants?.[0];

    expect(reparsed.name).toBe("Manual Vitest Template");
    expect(reparsed.description).toBe("Custom description shown in game and browse.");
    expect(variant?.zones?.map((zone) => zone.name)).toEqual(["Spawn-1", "Neutral-3", "Spawn-2"]);
    expect(variant?.connections?.map((connection) => connection.name)).toEqual(["Path-1-3", "Path-3-2"]);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.mainObjects?.[0].holdCityWinCon).toBe(true);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.layout).toBe("zone_layout_treasure_zone");
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.guardCutoffValue).toBe(4321);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.guardMultiplier).toBe(1.7);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.guardReactionDistribution).toEqual([1, 2, 3, 4, 5, 6]);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.guardedContentPool).toEqual(["example_guarded_pool"]);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.resourcesContentPool).toEqual(["example_resources_pool"]);
    expect(variant?.zones?.find((zone) => zone.name === "Neutral-3")?.zoneBiome).toEqual({ type: "FromList", args: ["Sand"] });
    expect(reparsed.gameRules?.winConditions?.cityHold).toBe(true);
    expect(serialized).not.toContain("generatorPosition");
  });

  it("can compile with validation skipped for forced export", () => {
    const design = createDefaultDesign();
    design.connections = [];

    expect(validateDesign(design).errors).toContain("Direct and portal connections must connect every zone.");
    expect(() => designToTemplate(design)).toThrow("Direct and portal connections must connect every zone.");
    expect(designToTemplate(design, { skipValidation: true }).variants?.[0].connections).toEqual([]);
  });

  it("round-trips exposed advanced global rule controls through rmg json", () => {
    const design = createDefaultDesign();
    design.gameMode = "Tournament";
    design.templateDescription = "Tournament-focused template description.";
    design.heroHireBan = true;
    design.encounterHoles = true;
    design.movementBonus = 7;
    design.factionLawsExpPercent = 125;
    design.astrologyExpPercent = 75;
    design.gameEndConditions.lostStartCity = true;
    design.gameEndConditions.lostStartCityDay = 9;
    design.gladiatorArenaRules.enabled = true;
    design.gladiatorArenaRules.daysDelayStart = 21;
    design.gladiatorArenaRules.countDay = 4;
    design.tournamentRules.enabled = true;
    design.tournamentRules.firstTournamentDay = 18;
    design.tournamentRules.interval = 5;
    design.tournamentRules.pointsToWin = 3;
    design.tournamentRules.saveArmy = false;

    const template = designToTemplate(design);
    const imported = templateToDesign(template);

    expect(template.gameMode).toBe("Tournament");
    expect(template.description).toBe("Tournament-focused template description.");
    expect(template.gameRules?.heroHireBan).toBe(true);
    expect(template.gameRules?.encounterHoles).toBe(true);
    expect(Array.isArray(template.gameRules?.bonuses) ? template.gameRules.bonuses[0]?.parameters : undefined).toEqual(["movementBonus", "7"]);
    expect(template.gameRules?.factionLawsExpModifier).toBe(1.25);
    expect(template.gameRules?.astrologyExpModifier).toBe(0.75);
    expect(template.gameRules?.winConditions?.lostStartCity).toBe(true);
    expect(template.gameRules?.winConditions?.lostStartCityDay).toBe(9);
    expect(template.gameRules?.winConditions?.gladiatorArena).toBe(true);
    expect(template.gameRules?.winConditions?.gladiatorArenaDaysDelayStart).toBe(21);
    expect(template.gameRules?.winConditions?.gladiatorArenaCountDay).toBe(4);
    expect(template.gameRules?.winConditions?.tournament).toBe(true);
    expect(template.gameRules?.winConditions?.tournamentDays).toEqual([17, 4, 4, 4, 4]);
    expect(template.gameRules?.winConditions?.tournamentPointsToWin).toBe(3);
    expect(template.gameRules?.winConditions?.tournamentSaveArmy).toBe(false);

    expect(imported.gameMode).toBe("Tournament");
    expect(imported.templateDescription).toBe("Tournament-focused template description.");
  expect(imported.heroHireBan).toBe(true);
  expect(imported.encounterHoles).toBe(true);
  expect(imported.movementBonus).toBe(7);
    expect(imported.factionLawsExpPercent).toBe(125);
    expect(imported.astrologyExpPercent).toBe(75);
    expect(imported.gameEndConditions.lostStartCityDay).toBe(9);
    expect(imported.gladiatorArenaRules).toEqual({ enabled: true, daysDelayStart: 21, countDay: 4 });
    expect(imported.tournamentRules).toEqual({ enabled: true, firstTournamentDay: 18, interval: 5, pointsToWin: 3, saveArmy: false });
  });

  it("exports edited top-level content count limits", () => {
    const design = createDefaultDesign();
    const sideLimit = design.contentCountLimits.find((limit) => limit.name === "content_limits_side");
    const marketLimit = sideLimit?.limits?.find((limit) => limit.sid === "market");
    expect(marketLimit).toBeTruthy();

    if (marketLimit) {
      marketLimit.maxCount = 3;
      marketLimit.variant = 2;
      marketLimit.includeLists = ["content_list_market_variants"];
      marketLimit.content = [{ sid: "market", isGuarded: false }];
    }

    const template = designToTemplate(design);
    const exportedMarketLimit = template.contentCountLimits
      ?.find((limit) => limit.name === "content_limits_side")
      ?.limits
      ?.find((limit) => limit.sid === "market");

    expect(exportedMarketLimit).toEqual({
      sid: "market",
      maxCount: 3,
      variant: 2,
      includeLists: ["content_list_market_variants"],
      content: [{ sid: "market", isGuarded: false }]
    });
  });

  it("imports and preserves custom top-level content count limits", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Custom Content Limits",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "contentCountLimits": ["content_limits_custom_market"], "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [{ "name": "Path-1-2", "from": "Spawn-1", "to": "Spawn-2", "guardValue": 1000 }]
      }],
      "contentCountLimits": [{
        "name": "content_limits_custom_market",
        "playerMin": 1,
        "playerMax": 4,
        "limits": [{
          "sid": "market",
          "variant": 7,
          "maxCount": 2,
          "includeLists": ["content_list_market"],
          "content": [{ "sid": "market", "isGuarded": false }]
        }]
      }]
    }`));

    const exported = designToTemplate(imported);

    expect(imported.contentCountLimits).toEqual([{
      name: "content_limits_custom_market",
      playerMin: 1,
      playerMax: 4,
      limits: [{
        sid: "market",
        variant: 7,
        maxCount: 2,
        includeLists: ["content_list_market"],
        content: [{ sid: "market", isGuarded: false }]
      }]
    }]);
    expect(imported.zones[0].contentCountLimits).toEqual(["content_limits_custom_market"]);
    expect(exported.contentCountLimits).toEqual(imported.contentCountLimits);
  });

  it("keeps default top-level content pools and content lists empty", () => {
    const template = designToTemplate(createDefaultDesign());

    expect(template.contentPools).toEqual([]);
    expect(template.contentLists).toEqual([]);
    expect(template.valueOverrides).toBeUndefined();
    expect(template.globalBans).toBeUndefined();
    expect(template.gameRules?.globalBans).toBeUndefined();
  });

  it("imports and exports top-level valueOverrides and globalBans", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Expert Settings Import",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [{ "name": "Path-1-2", "from": "Spawn-1", "to": "Spawn-2", "guardValue": 1000 }]
      }],
      "valueOverrides": [
        { "sid": "artifact_guard", "guardValue": 3200 },
        { "sid": "random_dwelling", "variant": 2, "guardValue": 8400, "weight": 3 }
      ],
      "globalBans": {
        "items": ["artifact_1"],
        "heroes": ["hero_1"],
        "magics": ["spell_1"]
      }
    }`));

    const exported = designToTemplate(imported);

    expect(imported.valueOverrides).toEqual([
      { sid: "artifact_guard", guardValue: 3200 },
      { sid: "random_dwelling", variant: 2, guardValue: 8400, weight: 3 }
    ]);
    expect(imported.globalBans).toEqual({
      items: ["artifact_1"],
      heroes: ["hero_1"],
      magics: ["spell_1"]
    });
    expect(exported.valueOverrides).toEqual(imported.valueOverrides);
    expect(exported.globalBans).toEqual(imported.globalBans);
  });

  it("preserves imported gameRules.globalBans on export", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Legacy Game Rules Bans",
      "sizeX": 160,
      "sizeZ": 160,
      "gameRules": {
        "globalBans": {
          "heroes": ["hero_legacy"],
          "items": ["item_legacy"]
        }
      },
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [{ "name": "Path-1-2", "from": "Spawn-1", "to": "Spawn-2", "guardValue": 1000 }]
      }]
    }`));

    const exported = designToTemplate(imported);

    expect(imported.importedGameRulesGlobalBans).toEqual({
      heroes: ["hero_legacy"],
      items: ["item_legacy"]
    });
    expect(exported.gameRules?.globalBans).toEqual({
      heroes: ["hero_legacy"],
      items: ["item_legacy"]
    });
  });

  it("imports and exports top-level content pools and content lists", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Advanced Content Library",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [{ "name": "Path-1-2", "from": "Spawn-1", "to": "Spawn-2", "guardValue": 1000 }]
      }],
      "contentPools": [
        {
          "name": "pool_neutral_rewards",
          "items": [
            { "sid": "pandora_box", "weight": 3 },
            { "sid": "treasure_chest", "weight": 1 }
          ]
        }
      ],
      "contentLists": [
        {
          "name": "list_resource_pickups",
          "entries": ["wood_pile", "ore_pile"]
        }
      ]
    }`));

    const exported = designToTemplate(imported);

    expect(imported.contentPools).toEqual([
      {
        name: "pool_neutral_rewards",
        items: [
          { sid: "pandora_box", weight: 3 },
          { sid: "treasure_chest", weight: 1 }
        ]
      }
    ]);
    expect(imported.contentLists).toEqual([
      {
        name: "list_resource_pickups",
        entries: ["wood_pile", "ore_pile"]
      }
    ]);
    expect(exported.contentPools).toEqual(imported.contentPools);
    expect(exported.contentLists).toEqual(imported.contentLists);
  });

  it("imports custom zone layouts and preserves zone references to them", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Custom Layout Import",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "layout": "custom_layout_alpha", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-2", "layout": "custom_layout_alpha", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [{ "name": "Path-1-2", "from": "Spawn-1", "to": "Spawn-2", "guardValue": 1000 }]
      }],
      "zoneLayouts": [{
        "name": "custom_layout_alpha",
        "obstaclesFill": 0.41,
        "obstaclesFillVoid": 0.53,
        "lakesFill": 0.12,
        "minLakeArea": 11,
        "elevationClusterScale": 0.09,
        "elevationModes": [{ "weight": 1, "minElevatedFraction": 0.1, "maxElevatedFraction": 0.3 }],
        "roadClusterArea": 77,
        "guardedEncounterResourceFractions": { "countBounds": [1, 2], "fractions": [0.5, 0.75] },
        "ambientPickupDistribution": { "repulsion": 2, "noise": 0.2, "roadAttraction": -0.1, "obstacleAttraction": 0.4, "groupSizeWeights": [5, 1] }
      }]
    }`));

    const exported = designToTemplate(imported);

    expect(imported.zoneLayouts).toEqual([{
      name: "custom_layout_alpha",
      obstaclesFill: 0.41,
      obstaclesFillVoid: 0.53,
      lakesFill: 0.12,
      minLakeArea: 11,
      elevationClusterScale: 0.09,
      elevationModes: [{ weight: 1, minElevatedFraction: 0.1, maxElevatedFraction: 0.3 }],
      roadClusterArea: 77,
      guardedEncounterResourceFractions: { countBounds: [1, 2], fractions: [0.5, 0.75] },
      ambientPickupDistribution: { repulsion: 2, noise: 0.2, roadAttraction: -0.1, obstacleAttraction: 0.4, groupSizeWeights: [5, 1] }
    }]);
    expect(imported.zones.map((zone) => zone.layout)).toEqual(["custom_layout_alpha", "custom_layout_alpha"]);
    expect(exported.zoneLayouts).toEqual(imported.zoneLayouts);
    expect(exported.variants?.[0].zones?.map((zone) => zone.layout)).toEqual(["custom_layout_alpha", "custom_layout_alpha"]);
  });

  it("exports edited zone layout numeric fields", () => {
    const design = createDefaultDesign();
    design.zoneLayouts[0].name = "custom_spawn_layout";
    design.zoneLayouts[0].obstaclesFill = 0.31;
    design.zoneLayouts[0].minLakeArea = 21;
    design.zoneLayouts[0].roadClusterArea = 175;
    for (const zone of design.zones.filter((zone) => zone.role === "Spawn")) {
      zone.layout = "custom_spawn_layout";
    }

    const template = designToTemplate(design);

    expect(template.zoneLayouts?.find((layout) => layout.name === "custom_spawn_layout")).toEqual(expect.objectContaining({
      obstaclesFill: 0.31,
      minLakeArea: 21,
      roadClusterArea: 175
    }));
    expect(template.variants?.[0].zones?.filter((zone) => zone.layout === "custom_spawn_layout")).toHaveLength(2);
  });

  it("keeps generated mandatory content behavior until explicitly customized", () => {
    const design = createDefaultDesign();
    design.zones[0].castleCount = 2;

    const template = designToTemplate(design);
    const spawnZone = template.variants?.[0].zones?.find((zone) => zone.name === "Spawn-1");
    const mandatorySide = template.mandatoryContent?.find((group) => group.name === "mandatory_content_side_1");
    const footholdRules = mandatorySide?.content?.find((item) => item.sid === "remote_foothold")?.rules;

    expect(design.useCustomMandatoryContent).toBe(false);
    expect(spawnZone?.mandatoryContent).toEqual(["mandatory_content_side_1"]);
    expect(footholdRules).toContainEqual(expect.objectContaining({ type: "MainObject", args: ["1"] }));
  });

  it("imports and exports custom mandatory content groups and zone references", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Custom Mandatory Content",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          {
            "name": "Spawn-1",
            "mandatoryContent": ["mandatory_content_custom_reward"],
            "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }]
          },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [{ "name": "Path-1-2", "from": "Spawn-1", "to": "Spawn-2", "guardValue": 1000 }]
      }],
      "mandatoryContent": [{
        "name": "mandatory_content_custom_reward",
        "content": [{
          "name": "name_custom_reward",
          "sid": "pandora_box",
          "variant": 3,
          "isGuarded": true,
          "isMine": false,
          "soloEncounter": true,
          "includeLists": ["content_list_reward"],
          "rules": [{ "type": "Crossroads", "targetMin": 0.2, "targetMax": 0.4, "weight": 2 }],
          "designatedEncounter": true,
          "guardValue": 12000,
          "owner": "Player1",
          "road": true,
          "content": [{ "sid": "market", "isGuarded": false }]
        }]
      }]
    }`));

    const exported = designToTemplate(imported);

    expect(imported.useCustomMandatoryContent).toBe(true);
    expect(imported.zones[0].mandatoryContent).toEqual(["mandatory_content_custom_reward"]);
    expect(imported.mandatoryContent).toEqual([{
      name: "mandatory_content_custom_reward",
      content: [{
        name: "name_custom_reward",
        sid: "pandora_box",
        variant: 3,
        isGuarded: true,
        isMine: false,
        soloEncounter: true,
        includeLists: ["content_list_reward"],
        rules: [{ type: "Crossroads", targetMin: 0.2, targetMax: 0.4, weight: 2 }],
        designatedEncounter: true,
        guardValue: 12000,
        owner: "Player1",
        road: true,
        content: [{ sid: "market", isGuarded: false }]
      }]
    }]);
    expect(exported.mandatoryContent).toEqual(imported.mandatoryContent);
    expect(exported.variants?.[0].zones?.find((zone) => zone.name === "Spawn-1")?.mandatoryContent).toEqual(["mandatory_content_custom_reward"]);
  });

  it("imports and exports per-zone rules without changing default zone output", () => {
    const defaults = designToTemplate(createDefaultDesign());
    const defaultZone = defaults.variants?.[0]?.zones?.find((zone) => zone.name === "Neutral-3");
    expect(defaultZone?.encounterHolesSettings).toBeUndefined();
    expect(defaultZone?.randomHireEnableWeeklyUnitIncrement).toBeUndefined();
    expect(defaultZone?.randomHireInitialUnitIncrement).toBeUndefined();

    const design = createDefaultDesign();
    design.zones[1].encounterHolesSettings = { affectedEncounters: 7, twoHoleEncounters: 3 };
    design.zones[1].randomHireEnableWeeklyUnitIncrement = true;
    design.zones[1].randomHireInitialUnitIncrement = 4;

    const template = designToTemplate(design);
    const zone = template.variants?.[0]?.zones?.find((candidate) => candidate.name === "Neutral-3");
    const imported = templateToDesign(template);

    expect(zone?.encounterHolesSettings).toEqual({ affectedEncounters: 7, twoHoleEncounters: 3 });
    expect(zone?.randomHireEnableWeeklyUnitIncrement).toBe(true);
    expect(zone?.randomHireInitialUnitIncrement).toBe(4);
    expect(imported.zones[1].encounterHolesSettings).toEqual({ affectedEncounters: 7, twoHoleEncounters: 3 });
    expect(imported.zones[1].randomHireEnableWeeklyUnitIncrement).toBe(true);
    expect(imported.zones[1].randomHireInitialUnitIncrement).toBe(4);
  });

  it("keeps default designs on generated main objects", () => {
    const design = createDefaultDesign();
    const template = designToTemplate(design);
    const spawn = template.variants?.[0]?.zones?.find((zone) => zone.name === "Spawn-1");
    const neutral = template.variants?.[0]?.zones?.find((zone) => zone.name === "Neutral-3");

    expect(design.zones.every((zone) => zone.useCustomMainObjects === false)).toBe(true);
    expect(spawn?.mainObjects?.[0]).toMatchObject({
      type: "Spawn",
      spawn: "Player1",
      buildingsConstructionSid: "default_buildings_construction"
    });
    expect(neutral?.mainObjects?.[0]).toMatchObject({
      type: "City",
      faction: { type: "FromList", args: [] }
    });
  });

  it("round-trips imported custom main objects without regenerating them", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Custom Objects",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          {
            "name": "Neutral-3",
            "mainObjects": [{
              "type": "Ruins",
              "spawn": "Player5",
              "guardChance": 0.75,
              "guardValue": 12345,
              "guardRandomization": 0.33,
              "guardWeeklyIncrement": 0.44,
              "removeGuardIfHasOwner": false,
              "buildingsConstructionSid": "custom_buildings",
              "faction": { "type": "Match", "args": ["0", "Spawn-1"] },
              "factions": { "type": "FromList", "args": ["Temple", "Hive"] },
              "owner": "Player2",
              "placement": "Center",
              "placementArgs": ["alpha", "beta"],
              "holdCityWinCon": true,
              "enableWeeklyUnitIncrement": true,
              "initialUnitIncrement": 7,
              "isKeyObject": true
            }] },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [
          { "name": "Path-1-3", "from": "Spawn-1", "to": "Neutral-3", "connectionType": "Direct" },
          { "name": "Path-3-2", "from": "Neutral-3", "to": "Spawn-2", "connectionType": "Direct" }
        ]
      }]
    }`));

    const customObject = imported.zones[1].customMainObjects[0];
    const exported = designToTemplate(imported);
    const exportedObject = exported.variants?.[0]?.zones?.find((zone) => zone.name === "Neutral-3")?.mainObjects?.[0];

    expect(imported.zones[1].useCustomMainObjects).toBe(true);
    expect(exportedObject).toEqual(customObject);
  });

  it("exports user-edited custom main objects exactly", () => {
    const design = createDefaultDesign();
    design.zones[1].holdCity = true;
    design.zones[1].neutralCastlesAsRuins = true;
    design.zones[1].useCustomMainObjects = true;
    design.zones[1].customMainObjects = [{
      type: "City",
      guardChance: 0.25,
      guardValue: 999,
      placement: "Uniform",
      placementArgs: ["false", "-0.8", "3"],
      faction: { type: "Random", args: [] },
      holdCityWinCon: false
    }];

    const exportedObject = designToTemplate(design).variants?.[0]?.zones?.find((zone) => zone.name === "Neutral-3")?.mainObjects?.[0];

    expect(exportedObject).toEqual(design.zones[1].customMainObjects[0]);
  });

  it("preserves explicit false random-hire weekly growth on import and export", () => {
    const design = templateToDesign(parseRmgTemplate(`{
      "name": "Explicit False",
      "sizeX": 160,
      "sizeZ": 160,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          {
            "name": "Neutral-3",
            "mainObjects": [{ "type": "City" }],
            "randomHireEnableWeeklyUnitIncrement": false,
            "randomHireInitialUnitIncrement": 2,
            "encounterHolesSettings": { "affectedEncounters": 5, "twoHoleEncounters": 1 }
          },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [
          { "name": "Path-1-3", "from": "Spawn-1", "to": "Neutral-3", "connectionType": "Direct" },
          { "name": "Path-3-2", "from": "Neutral-3", "to": "Spawn-2", "connectionType": "Direct" }
        ]
      }]
    }`));

    const exported = designToTemplate(design);
    const zone = exported.variants?.[0]?.zones?.find((candidate) => candidate.name === "Neutral-3");

    expect(design.zones[1].randomHireEnableWeeklyUnitIncrement).toBe(false);
    expect(zone?.randomHireEnableWeeklyUnitIncrement).toBe(false);
    expect(zone?.randomHireInitialUnitIncrement).toBe(2);
    expect(zone?.encounterHolesSettings).toEqual({ affectedEncounters: 5, twoHoleEncounters: 1 });
  });

  it("round-trips non-default orientation and border settings through rmg json", () => {
    const design = createDefaultDesign();
    design.orientation = {
      zeroAngleZone: "Neutral-3",
      baseAngleMin: 15,
      baseAngleMax: 75,
      randomAngleAmplitude: 120,
      randomAngleStep: 30
    };
    design.border = {
      cornerRadius: 8,
      obstaclesWidth: 5,
      obstaclesNoise: [{ amp: 2, freq: 9 }],
      waterWidth: 4,
      waterNoise: [{ amp: 3, freq: 6 }],
      waterType: "water snow"
    };

    const template = designToTemplate(design);
    const variant = template.variants?.[0];
    const imported = templateToDesign(template);

    expect(variant?.orientation).toEqual({
      zeroAngleZone: "Neutral-3",
      baseAngleMin: 15,
      baseAngleMax: 75,
      randomAngleAmplitude: 120,
      randomAngleStep: 30
    });
    expect(variant?.border).toEqual({
      cornerRadius: 8,
      obstaclesWidth: 5,
      obstaclesNoise: [{ amp: 2, freq: 9 }],
      waterWidth: 4,
      waterNoise: [{ amp: 3, freq: 6 }],
      waterType: "water snow"
    });
    expect(imported.orientation).toEqual(design.orientation);
    expect(imported.border).toEqual(design.border);
  });

  it("round-trips advanced direct connection fields through rmg json", () => {
    const design = createDefaultDesign();
    design.connections[0].guardRandomization = 0.42;
    design.connections[0].guardWeeklyIncrement = 0.35;
    design.connections[0].guardEscape = true;
    design.connections[0].simTurnSquad = false;
    design.connections[0].guardZone = "Spawn-2";
    design.connections[0].guardMatchGroup = "manual_shared_guard";

    const template = designToTemplate(design);
    const exported = template.variants?.[0]?.connections?.[0];
    const imported = templateToDesign(template);

    expect(exported).toMatchObject({
      connectionType: "Direct",
      guardRandomization: 0.42,
      guardWeeklyIncrement: 0.35,
      guardEscape: true,
      simTurnSquad: false,
      guardZone: "Spawn-2",
      guardMatchGroup: "manual_shared_guard"
    });
    expect(imported.connections[0]).toMatchObject({
      type: "Direct",
      guardRandomization: 0.42,
      guardWeeklyIncrement: 0.35,
      guardEscape: true,
      simTurnSquad: false,
      guardZone: "Spawn-2",
      guardMatchGroup: "manual_shared_guard"
    });
  });

  it("round-trips portal placement rules and advanced portal fields through rmg json", () => {
    const design = createDefaultDesign();
    design.connections[0].type = "Portal";
    design.connections[0].guardRandomization = 0.2;
    design.connections[0].guardWeeklyIncrement = 0.4;
    design.connections[0].guardEscape = true;
    design.connections[0].guardZone = "Neutral-3";
    design.connections[0].guardMatchGroup = "portal_guard_group";
    design.connections[0].portalPlacementRulesFrom = [
      { type: "Crossroads", args: [], targetMin: 0.2, targetMax: 0.4, weight: 3 }
    ];
    design.connections[0].portalPlacementRulesTo = [
      { type: "Crossroads", args: [], targetMin: 0.6, targetMax: 0.8, weight: 1 }
    ];

    const template = designToTemplate(design);
    const exported = template.variants?.[0]?.connections?.[0];
    const imported = templateToDesign(template);

    expect(exported).toMatchObject({
      connectionType: "Portal",
      guardRandomization: 0.2,
      guardWeeklyIncrement: 0.4,
      guardEscape: true,
      guardZone: "Neutral-3",
      guardMatchGroup: "portal_guard_group",
      portalPlacementRulesFrom: [{ type: "Crossroads", args: [], targetMin: 0.2, targetMax: 0.4, weight: 3 }],
      portalPlacementRulesTo: [{ type: "Crossroads", args: [], targetMin: 0.6, targetMax: 0.8, weight: 1 }]
    });
    expect(imported.connections[0]).toMatchObject({
      type: "Portal",
      guardRandomization: 0.2,
      guardWeeklyIncrement: 0.4,
      guardEscape: true,
      guardZone: "Neutral-3",
      guardMatchGroup: "portal_guard_group",
      portalPlacementRulesFrom: [{ type: "Crossroads", args: [], targetMin: 0.2, targetMax: 0.4, weight: 3 }],
      portalPlacementRulesTo: [{ type: "Crossroads", args: [], targetMin: 0.6, targetMax: 0.8, weight: 1 }]
    });
  });

  it("applies inherited terrain themes when a zone has not defined custom biome overrides", () => {
    const design = createDefaultDesign();
    design.terrainTheme = "Snow";
    design.zones[1].terrainTheme = "Desert";

    const template = designToTemplate(design);
    const zones = template.variants?.[0].zones ?? [];

    expect(zones.find((zone) => zone.name === "Spawn-1")?.zoneBiome).toEqual({ type: "FromList", args: ["Snow"] });
    expect(zones.find((zone) => zone.name === "Neutral-3")?.zoneBiome).toEqual({ type: "FromList", args: ["Sand"] });
    expect(zones.find((zone) => zone.name === "Spawn-2")?.zoneBiome).toEqual({ type: "FromList", args: ["Snow"] });
  });

  it("matches manual neutral castle factions for neutral zones with one adjacent spawn", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    const addedNeutral = design.zones.at(-1)!;
    addedNeutral.matchAdjacentNeutralCastleFactions = true;
    design = addConnectionBetween(design, "zone-1", addedNeutral.id);

    const template = designToTemplate(design);
    const zones = template.variants?.[0].zones ?? [];

    expect(zones.find((zone) => zone.name === addedNeutral.name)?.mainObjects?.[0].faction).toEqual({ type: "Match", args: ["0", "Spawn-1"] });
    expect(zones.find((zone) => zone.name === "Neutral-3")?.mainObjects?.[0].faction).toEqual({ type: "FromList", args: [] });
  });

  it("compiles manual neutral castle slots as ruins when enabled", () => {
    const design = createDefaultDesign();
    design.zones[1].castleCount = 2;
    design.zones[1].neutralCastlesAsRuins = true;

    const template = designToTemplate(design);
    const neutral = template.variants?.[0].zones?.find((zone) => zone.name === "Neutral-3");

    expect(neutral?.mainObjects?.map((object) => object.type)).toEqual(["Ruins", "Ruins"]);
    expect(neutral?.mainObjects?.[0].factions).toEqual({ type: "FromList", args: [] });
  });

  it("migrates legacy global neutral castle flags into per-zone settings", () => {
    const legacyFlags = createDefaultDesign();
    legacyFlags.matchAdjacentNeutralCastleFactions = true;
    legacyFlags.neutralCastlesAsRuins = true;
    const normalized = parseDesignOrTemplateFile(serializeDesignFile(legacyFlags));

    expect(normalized.zones.filter((zone) => zone.role === "Neutral").every((zone) => zone.matchAdjacentNeutralCastleFactions)).toBe(true);
    expect(normalized.zones.filter((zone) => zone.role === "Neutral").every((zone) => zone.neutralCastlesAsRuins)).toBe(true);
  });

  it("compiles selected manual neutral zones as ruins", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    const addedNeutral = design.zones.at(-1)!;
    addedNeutral.neutralCastlesAsRuins = true;
    design = addConnectionBetween(design, "zone-3", addedNeutral.id);

    const template = designToTemplate(design);
    const zones = template.variants?.[0].zones ?? [];

    expect(zones.find((zone) => zone.name === "Neutral-3")?.mainObjects?.[0].type).toBe("City");
    expect(zones.find((zone) => zone.name === addedNeutral.name)?.mainObjects?.[0].type).toBe("Ruins");
  });

  it("compiles selected manual neutral zones as natural expansions", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    const addedNeutral = design.zones.at(-1)!;
    addedNeutral.castleCount = 2;
    addedNeutral.naturalExpansion = true;
    design = addConnectionBetween(design, "zone-1", addedNeutral.id);

    const template = designToTemplate(design);
    const natural = template.variants?.[0].zones?.find((zone) => zone.name === addedNeutral.name);

    expect(natural?.mainObjects?.[0].faction).toEqual({ type: "Match", args: ["0", "Spawn-1"] });
    expect(natural?.mainObjects?.[1].faction).toEqual({ type: "Match", args: ["0"] });
  });

  it("requires manual natural expansion zones to have one adjacent spawn", () => {
    const design = createDefaultDesign();
    design.zones[1].naturalExpansion = true;

    expect(validateDesign(design).errors).toContain("Neutral-3 natural expansion must connect to exactly one spawn zone.");
  });

  it("validates duplicate names, disconnected graphs, zone limits, invalid connections, and city hold", () => {
    let design = createDefaultDesign();
    design.zones[1].name = "Spawn-1";
    design.connections = [];
    design.connections.push({ id: "bad", name: "Bad", from: "missing", to: "zone-1", type: "Direct", guardStrength: 1, road: true });
    design.gameEndConditions.cityHold = true;

    for (let i = 0; i < 29; i++) design = addZone(design, "Neutral");
    for (let i = 33; i <= 49; i++) design.zones.push(createZone(`zone-${i}`, `Neutral-${i}`, "Neutral"));

    const errors = validateDesign(design).errors.join("\n");
    expect(errors).toContain("Zone names must be unique");
    expect(errors).toContain("references a missing zone");
    expect(errors).toContain("Direct and portal connections must connect every zone");
    expect(errors).toContain("Templates support at most 48 zones");
    expect(errors).toContain("City Hold requires exactly one hold-city zone");
  });

  it("allows tournament designs with separate player lanes", () => {
    const design = createDefaultDesign();
    design.gameMode = "Tournament";
    design.gameEndConditions.victoryCondition = "win_condition_6";
    design.tournamentRules.enabled = true;
    design.zones = [
      createZone("spawn-1", "Spawn-1", "Spawn", { player: 1 }),
      createZone("neutral-1-a", "Neutral-1A", "Neutral"),
      createZone("neutral-1-b", "Neutral-1B", "Neutral"),
      createZone("spawn-2", "Spawn-2", "Spawn", { player: 2 }),
      createZone("neutral-2-a", "Neutral-2A", "Neutral"),
      createZone("neutral-2-b", "Neutral-2B", "Neutral")
    ];
    design.connections = [
      { id: "conn-1-a", name: "Path-1-A", from: "spawn-1", to: "neutral-1-a", type: "Direct", guardStrength: 12000, road: true },
      { id: "conn-1-b", name: "Path-1-B", from: "neutral-1-a", to: "neutral-1-b", type: "Direct", guardStrength: 18000, road: true },
      { id: "conn-2-a", name: "Path-2-A", from: "spawn-2", to: "neutral-2-a", type: "Direct", guardStrength: 12000, road: true },
      { id: "conn-2-b", name: "Path-2-B", from: "neutral-2-a", to: "neutral-2-b", type: "Direct", guardStrength: 18000, road: true }
    ];

    expect(validateDesign(design).errors).not.toContain("Direct and portal connections must connect every zone.");
    expect(validateDesign(design).errors).not.toContain("Tournament direct and portal connections must keep every zone attached to a player lane.");
  });

  it("rejects tournament designs with orphaned neutral lanes", () => {
    const design = createDefaultDesign();
    design.tournamentRules.enabled = true;
    design.zones = [
      createZone("spawn-1", "Spawn-1", "Spawn", { player: 1 }),
      createZone("spawn-2", "Spawn-2", "Spawn", { player: 2 }),
      createZone("neutral-1", "Neutral-1", "Neutral")
    ];
    design.connections = [];

    expect(validateDesign(design).errors).toContain("Tournament direct and portal connections must keep every zone attached to a player lane.");
  });

  it("validates spawn player numbers as unique integers from one to eight", () => {
    const duplicate = createDefaultDesign();
    duplicate.zones[2].player = 1;
    const outOfRange = createDefaultDesign();
    outOfRange.zones[0].player = 9;
    const fractional = createDefaultDesign();
    fractional.zones[0].player = 1.5;

    expect(validateDesign(duplicate).errors).toContain("Spawn player numbers must be unique.");
    expect(validateDesign(outOfRange).errors).toContain("Spawn player numbers must be integers from 1 to 8.");
    expect(validateDesign(fractional).errors).toContain("Spawn player numbers must be integers from 1 to 8.");
  });

  it("reconciles manual spawn zones to the selected player count", () => {
    let design = createDefaultDesign();

    design = setDesignPlayerCount(design, 4);

    expect(design.playerCount).toBe(4);
    expect(design.zones.filter((zone) => zone.role === "Spawn").map((zone) => [zone.name, zone.player])).toEqual([
      ["Spawn-1", 1],
      ["Spawn-2", 2],
      ["Spawn-3", 3],
      ["Spawn-4", 4]
    ]);
    expect(validateDesign(design).errors).toEqual([]);
    expect(design.connections.some((connection) => connection.from === "zone-spawn-3" || connection.to === "zone-spawn-3")).toBe(true);

    design = setDesignPlayerCount(design, 2);

    expect(design.playerCount).toBe(2);
    expect(design.zones.filter((zone) => zone.role === "Spawn").map((zone) => zone.player)).toEqual([1, 2]);
    expect(design.zones.some((zone) => zone.name === "Spawn-3")).toBe(false);
    expect(validateDesign(design).errors).toEqual([]);
  });

  it("requires the design to have exactly one spawn zone for every selected player", () => {
    const missingSpawn = createDefaultDesign();
    missingSpawn.playerCount = 3;
    const duplicatePlayer = createDefaultDesign();
    duplicatePlayer.zones[2].player = 1;

    expect(validateDesign(missingSpawn).errors).toContain("Player count is 3, so the design must have exactly 3 spawn zones.");
    expect(validateDesign(missingSpawn).errors).toContain("Every player must have one spawn zone. Missing player 3.");
    expect(validateDesign(duplicatePlayer).errors).toContain("Every player must have one spawn zone. Missing player 2.");
  });

  it("assigns available spawn player numbers when adding or duplicating spawn zones", () => {
    let design = createDefaultDesign();
    design.zones[0].player = 1;
    design.zones[2].player = 3;

    design = addZone(design, "Spawn");
    expect(design.zones.at(-1)?.player).toBe(2);

    design = duplicateZone(design, "zone-1");
    expect(design.zones.at(-1)?.player).toBe(4);

    for (let i = 0; i < 4; i++) design = addZone(design, "Spawn");
    expect(design.zones.filter((zone) => zone.role === "Spawn").map((zone) => zone.player).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const cappedDesign = addZone(design, "Spawn");
    expect(cappedDesign.zones.filter((zone) => zone.role === "Spawn")).toHaveLength(8);

    design = duplicateZone(design, "zone-1");
    expect(design.zones.filter((zone) => zone.role === "Spawn")).toHaveLength(8);
    expect(validateDesign(design).errors).not.toContain("Spawn player numbers must be unique.");
  });

  it("does not convert another zone into a ninth spawn when transferring settings", () => {
    let design = setDesignPlayerCount(createDefaultDesign(), 8);
    design = addZone(design, "Neutral");
    const neutral = design.zones.at(-1);

    const transferred = transferZoneSettings(design, "zone-1", neutral?.id ?? "");

    expect(transferred.zones.filter((zone) => zone.role === "Spawn")).toHaveLength(8);
    expect(transferred.zones.find((zone) => zone.id === neutral?.id)?.role).toBe("Neutral");
  });

  it("exports custom spawn main objects with the assigned zone player", () => {
    let design = createDefaultDesign();
    design.zones[0].useCustomMainObjects = true;
    design.zones[0].customMainObjects = [{
      type: "Spawn",
      spawn: "Player1",
      removeGuardIfHasOwner: true,
      guardChance: 1,
      placement: "Uniform",
      placementArgs: ["true", "0.7", "0"]
    }];

    design = duplicateZone(design, "zone-1");
    const duplicate = design.zones.at(-1);
    if (duplicate) design = addConnectionBetween(design, duplicate.id, "zone-3");
    expect(duplicate?.player).toBe(3);
    expect(duplicate?.customMainObjects[0]?.spawn).toBe("Player1");

    const exportedSpawnAssignments = designToTemplate(design).variants?.[0]?.zones
      ?.filter((zone) => zone.name.startsWith("Spawn-"))
      .map((zone) => ({ name: zone.name, spawn: zone.mainObjects?.find((object) => object.type === "Spawn")?.spawn }))
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(exportedSpawnAssignments).toEqual([
      { name: "Spawn-1", spawn: "Player1" },
      { name: "Spawn-1 Copy", spawn: "Player3" },
      { name: "Spawn-2", spawn: "Player2" }
    ]);
  });

  it("places added zones in open board space instead of stacking along one arc", () => {
    let design = createDefaultDesign();
    const originalPositions = design.zones.map((zone) => zone.position);

    for (let i = 0; i < 8; i++) design = addZone(design, "Neutral");

    expect(design.zones.slice(0, 3).map((zone) => zone.position)).toEqual(originalPositions);
    for (const zone of design.zones.slice(3)) {
      const distances = design.zones
        .filter((candidate) => candidate.id !== zone.id)
        .map((candidate) => Math.hypot(candidate.position.x - zone.position.x, candidate.position.y - zone.position.y));
      expect(Math.min(...distances)).toBeGreaterThan(0.12);
    }
  });

  it("adds direct connections between dropped zones without duplicating an existing pair", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    const connectionCount = design.connections.length;
    const from = design.zones[0].id;
    const to = design.zones.at(-1)!.id;

    const connected = addConnectionBetween(design, from, to);
    const duplicated = addConnectionBetween(connected, to, from);

    expect(connected.connections).toHaveLength(connectionCount + 1);
    expect(connected.connections.at(-1)).toMatchObject({
      name: `Path-${design.zones[0].name}-${design.zones.at(-1)!.name}`,
      from,
      to,
      type: "Direct",
      guardStrength: 30000,
      road: true
    });
    expect(duplicated.connections).toHaveLength(connectionCount + 1);
    expect(addConnectionBetween(connected, from, from)).toBe(connected);
  });

  it("uses deterministic unique ids for new manual connections", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    const neutral = design.zones.at(-1)!;
    design = addConnectionBetween(design, "zone-1", neutral.id);
    design = addConnectionBetween(design, "zone-2", neutral.id);

    expect(design.connections.at(-2)?.id).toBe("conn-1");
    expect(design.connections.at(-1)?.id).toBe("conn-2");
  });

  it("reuses the lowest available manual connection id after a deletion", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    design = addZone(design, "Neutral");
    const firstNeutral = design.zones.at(-2)!;
    const secondNeutral = design.zones.at(-1)!;

    design = addConnectionBetween(design, "zone-1", firstNeutral.id);
    design = addConnectionBetween(design, "zone-2", firstNeutral.id);
    design.connections = design.connections.filter((connection) => connection.id !== "conn-1");
    design = addConnectionBetween(design, "zone-1", secondNeutral.id);

    expect(design.connections.at(-1)?.id).toBe("conn-1");
    expect(new Set(design.connections.map((connection) => connection.id)).size).toBe(design.connections.length);
  });

  it("duplicates one zone config without carrying over its connections", () => {
    const design = createDefaultDesign();
    const duplicated = duplicateZone(design, "zone-3");
    const source = duplicated.zones.find((zone) => zone.id === "zone-3")!;
    const copy = duplicated.zones.at(-1)!;

    expect(duplicated.zones).toHaveLength(design.zones.length + 1);
    expect(duplicated.connections).toEqual(design.connections);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe("Neutral-3 Copy");
    expect(copy.position).not.toEqual(source.position);
    expect(zoneConfigSignature(copy)).toBe(zoneConfigSignature(source));
  });

  it("transfers one zone config onto another existing zone without carrying over identity or connections", () => {
    let design = createDefaultDesign();
    design = addZone(design, "Neutral");
    const source = design.zones.find((zone) => zone.id === "zone-3")!;
    const targetBefore = design.zones.at(-1)!;
    source.quality = "High";
    source.castleCount = 3;
    source.layout = "zone_layout_treasure_zone";
    source.guardedContentPool = ["source_guarded_pool"];
    source.zoneBiome = { type: "FromList", args: ["Snow"] };

    const transferred = transferZoneSettings(design, source.id, targetBefore.id);
    const targetAfter = transferred.zones.find((zone) => zone.id === targetBefore.id)!;

    expect(transferred.zones).toHaveLength(design.zones.length);
    expect(transferred.connections).toEqual(design.connections);
    expect(targetAfter.id).toBe(targetBefore.id);
    expect(targetAfter.name).toBe(targetBefore.name);
    expect(targetAfter.position).toEqual(targetBefore.position);
    expect(zoneConfigSignature(targetAfter)).toBe(zoneConfigSignature(transferred.zones.find((zone) => zone.id === source.id)!));
  });

  it("keeps duplicated zones individually addressable across repeated duplication", () => {
    const design = createDefaultDesign();
    const firstDuplicate = duplicateZone(design, "zone-3");
    const firstCopy = firstDuplicate.zones.at(-1)!;
    const secondDuplicate = duplicateZone(firstDuplicate, firstCopy.id);
    const secondCopy = secondDuplicate.zones.at(-1)!;
    const zoneIds = secondDuplicate.zones.map((zone) => zone.id);

    expect(new Set(zoneIds).size).toBe(zoneIds.length);
    expect(firstCopy.id).not.toBe("zone-3");
    expect(secondCopy.id).not.toBe(firstCopy.id);
    expect(secondDuplicate.zones.find((zone) => zone.id === firstCopy.id)).toBeTruthy();
    expect(secondDuplicate.zones.find((zone) => zone.id === secondCopy.id)).toBeTruthy();
  });

  it("groups zone colors by config without considering name, player, or position", () => {
    const design = createDefaultDesign();
    design.zones[0].position = { x: 0.1, y: 0.2 };
    design.zones[2].position = { x: 0.9, y: 0.8 };

    expect(design.zones[0].name).not.toBe(design.zones[2].name);
    expect(design.zones[0].player).not.toBe(design.zones[2].player);
    expect(zoneConfigSignature(design.zones[0])).toBe(zoneConfigSignature(design.zones[2]));
  });

  it("derives manual spawn mandatory content from spawn castle counts", () => {
    const design = createDefaultDesign();
    design.zones[0].castleCount = 2;

    const template = designToTemplate(design);
    const spawnZone = template.variants?.[0].zones?.find((zone) => zone.name === "Spawn-1");
    const mandatorySide = template.mandatoryContent?.find((group) => group.name === "mandatory_content_side_1");
    const footholdRules = mandatorySide?.content?.find((item) => item.sid === "remote_foothold")?.rules;

    expect(spawnZone?.mainObjects).toHaveLength(2);
    expect(footholdRules).toContainEqual(expect.objectContaining({ type: "MainObject", args: ["1"] }));
  });

  it("round-trips new design files", () => {
    const design = createDefaultDesign();
    design.lockMapDimensions = true;
    design.zones[0].layout = "zone_layout_spawns";
    design.zones[0].guardMultiplier = 1.25;
    design.zones[0].guardedContentPool = ["custom_spawn_pool"];
    design.zones[1].contentBiome = { type: "FromList", args: ["Snow"] };
    const reopened = parseDesignOrTemplateFile(serializeDesignFile(design));

    expect(reopened.zones).toHaveLength(3);
    expect(reopened.zones[0].layout).toBe("zone_layout_spawns");
    expect(reopened.zones[0].guardMultiplier).toBe(1.25);
    expect(reopened.zones[0].guardedContentPool).toEqual(["custom_spawn_pool"]);
    expect(reopened.zones[1].contentBiome).toEqual({ type: "FromList", args: ["Snow"] });
    expect(reopened.lockMapDimensions).toBe(true);
  });

  it("reports design-file strategy success for release design files", () => {
    const design = createDefaultDesign();
    const result = parseDesignOrTemplateFileResult(serializeDesignFile(design));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("design_file");
    expect(result.design.templateName).toBe(design.templateName);
    expect(result.attempts).toEqual([{ strategy: "design_file", ok: true }]);
  });

  it("reports rmg-template strategy success after design-file miss", () => {
    const design = createDefaultDesign();
    design.templateName = "Template Strategy";
    const result = parseDesignOrTemplateFileResult(serializeRmgTemplate(designToTemplate(design)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("rmg_template");
    expect(result.design.templateName).toBe("Template Strategy");
    expect(result.attempts).toEqual([
      expect.objectContaining({ strategy: "design_file", ok: false, category: "not_design_file" }),
      { strategy: "rmg_template", ok: true }
    ]);
  });

  it("rejects legacy settings-file json during import", () => {
    const result = parseDesignOrTemplateFileResult(`{
      "templateName": "Migrated Settings",
      "playerCount": 2,
      "neutralZoneCount": 1,
      "topology": "Chain",
      "generateRoads": true
    }`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorMessage).toContain("Legacy generator settings files are no longer supported");
    expect(result.attempts).toEqual([
      expect.objectContaining({ strategy: "design_file", ok: false, category: "not_design_file" }),
      expect.objectContaining({ strategy: "rmg_template", ok: false, category: "unsupported_legacy_settings" })
    ]);
    expect(() => parseDesignOrTemplateFile(`{
      "templateName": "Migrated Settings",
      "playerCount": 2,
      "neutralZoneCount": 1,
      "topology": "Chain",
      "generateRoads": true
    }`)).toThrow("Legacy generator settings files are no longer supported");
  });

  it("keeps current-template validation errors instead of replacing them with legacy fallback", () => {
    const result = parseDesignOrTemplateFileResult(`{
      "name": "Broken Template",
      "templateName": "Legacy-ish Name",
      "playerCount": 2,
      "sizeX": 144,
      "sizeZ": 144,
      "variants": [{
        "zones": [{ "name": "Spawn-1" }],
        "connections": [{ "from": "Spawn-1", "to": "Missing" }]
      }]
    }`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorMessage).toContain("references unknown zone");
    expect(result.errorMessage).not.toContain("Legacy generator settings files are no longer supported");
    expect(result.attempts.at(-1)).toEqual(expect.objectContaining({
      strategy: "rmg_template",
      ok: false,
      category: "invalid_rmg_template",
      message: expect.stringContaining("references unknown zone")
    }));
  });

  it("rejects malformed and structurally invalid RMG JSON during apply", () => {
    const design = createDefaultDesign();
    const malformed = applyRmgJsonToDesign("{", design);
    const invalidShape = applyRmgJsonToDesign(`{
      "name": "Broken",
      "sizeX": 144,
      "sizeZ": 144,
      "variants": [{
        "zones": [{ "name": "Spawn-1" }],
        "connections": [{ "from": "Spawn-1", "to": "Missing" }]
      }]
    }`, design);

    expect(malformed.ok).toBe(false);
    expect(invalidShape.ok).toBe(false);
    if (malformed.ok || invalidShape.ok) return;

    expect(malformed.parseError).toContain("Expected property name");
    expect(invalidShape.parseError).toContain("references unknown zone");
  });

  it("applies valid JSON back into builder state", () => {
    let source = createDefaultDesign();
    source.templateName = "JSON Applied Template";
    source = addZone(source, "Neutral");
    source = addConnectionBetween(source, "zone-1", source.zones.at(-1)!.id);

    const result = applyRmgJsonToDesign(
      serializeRmgTemplate(designToTemplate(source), { includeGeneratorPositions: true }),
      createDefaultDesign()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.design.templateName).toBe("JSON Applied Template");
    expect(result.design.zones).toHaveLength(4);
    expect(result.design.connections).toHaveLength(3);
    expect(result.design.zones.some((zone) => zone.name === source.zones.at(-1)?.name)).toBe(true);
  });

  it("preserves zone ids and board positions when imported names stay stable", () => {
    const previous = createDefaultDesign();
    previous.lockMapDimensions = true;
    previous.zones[1].position = { x: 0.23, y: 0.77 };
    previous.zones[1].resourceDensityPercent = 180;

    const result = applyRmgJsonToDesign(serializeRmgTemplate(designToTemplate(previous)), previous);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const preserved = result.design.zones.find((zone) => zone.name === "Neutral-3");
    expect(preserved?.id).toBe("zone-3");
    expect(preserved?.position).toEqual(snapPointToBoardSlot({ x: 0.23, y: 0.77 }));
    expect(preserved?.resourceDensityPercent).toBe(180);
    expect(result.design.lockMapDimensions).toBe(true);
  });

  it("clears the dimension lock after importing a rectangular template", () => {
    const previous = createDefaultDesign();
    previous.lockMapDimensions = true;
    previous.mapWidth = 160;
    previous.mapHeight = 160;

    const imported = applyRmgJsonToDesign(`{
      "name": "Rectangular",
      "sizeX": 200,
      "sizeZ": 216,
      "variants": [{
        "zones": [
          { "name": "Spawn-1", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Neutral-3", "mainObjects": [{ "type": "City" }] },
          { "name": "Spawn-2", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] }
        ],
        "connections": [
          { "name": "Path-1-3", "from": "Spawn-1", "to": "Neutral-3", "connectionType": "Direct" },
          { "name": "Path-3-2", "from": "Neutral-3", "to": "Spawn-2", "connectionType": "Direct" }
        ]
      }]
    }`, previous);

    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.design.mapWidth).toBe(200);
    expect(imported.design.mapHeight).toBe(216);
    expect(imported.design.lockMapDimensions).toBe(false);
  });

  it("keeps key builder fields stable across a design-template round-trip", () => {
    const design = createDefaultDesign();
    design.templateName = "Round Trip";
    design.terrainTheme = "Snow";
    design.zones[0].position = { x: 0.12, y: 0.34 };
    design.zones[0].guardCutoffValue = 3456;
    design.zones[1].roads = false;
    design.zones[2].player = 2;

    const reopened = templateToDesign(parseRmgTemplate(
      serializeRmgTemplate(designToTemplate(design), { includeGeneratorPositions: true })
    ));

    expect(reopened.templateName).toBe("Round Trip");
    expect(reopened.terrainTheme).toBe("Snow");
    expect(reopened.zones.map((zone) => zone.name)).toEqual(design.zones.map((zone) => zone.name));
    expect(reopened.zones[0].position).toEqual(snapPointToBoardSlot({ x: 0.12, y: 0.34 }));
    expect(reopened.zones[0].guardCutoffValue).toBe(3456);
    expect(reopened.zones[1].roads).toBe(false);
    expect(reopened.zones[2].player).toBe(2);
  });

  it("normalizes imported city hold templates onto the victory selector", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "City Hold Import",
      "displayWinCondition": "win_condition_5",
      "sizeX": 160,
      "sizeZ": 160,
      "gameRules": {
        "winConditions": {
          "classic": true,
          "cityHold": false,
          "cityHoldDays": 6
        }
      },
      "variants": [{
        "zones": [
          {
            "name": "Hub",
            "mainObjects": [
              {
                "type": "City",
                "holdCityWinCon": true
              }
            ]
          }
        ]
      }]
    }`));

    expect(imported.gameEndConditions.victoryCondition).toBe("win_condition_5");
    expect(imported.gameEndConditions.cityHold).toBe(true);
  });

  it("does not treat spawn-prefixed support zones as player starts unless they contain a spawn object", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Spawn Prefix Support Zones",
      "sizeX": 144,
      "sizeZ": 144,
      "variants": [{
        "zones": [
          { "name": "Spawn-A", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-B", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] },
          { "name": "Spawn-B-Side-1", "mainObjects": [{ "type": "City" }] }
        ],
        "connections": [
          { "name": "Path-A-Side", "from": "Spawn-A", "to": "Spawn-B-Side-1" },
          { "name": "Path-Side-B", "from": "Spawn-B-Side-1", "to": "Spawn-B" }
        ]
      }]
    }`));

    expect(imported.playerCount).toBe(2);
    expect(imported.zones.find((zone) => zone.name === "Spawn-B-Side-1")?.role).toBe("Neutral");
    expect(validateDesign(imported).errors).toEqual([]);
  });

  it("accepts official-template import shapes outside the manual generator presets", () => {
    const imported = templateToDesign(parseRmgTemplate(`{
      "name": "Official Shape Import",
      "sizeX": 80,
      "sizeZ": 80,
      "gameRules": {
        "bonuses": { "sid": "add_bonus_hero_item", "parameters": ["swamp_boots_artifact"] },
        "winConditions": { "cityHold": true, "cityHoldDays": 7 }
      },
      "variants": [{
        "zones": [
          { "name": "Spawn-A", "mainObjects": [{ "type": "Spawn", "spawn": "Player1" }] },
          { "name": "Spawn-B", "mainObjects": [{ "type": "Spawn", "spawn": "Player2" }] },
          { "name": "Island" }
        ],
        "connections": [
          { "name": "Path-A-B", "from": "Spawn-A", "to": "Spawn-B" }
        ]
      }]
    }`));

    expect(imported.gameEndConditions.cityHold).toBe(false);
    expect(validateDesign(imported).errors).toEqual([]);
  });
});
