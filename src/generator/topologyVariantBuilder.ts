import type { Connection, GeneratorSettings, Point, Variant, Zone } from "../types.ts";
import { addAlternateNeutralRoutes, buildRandomPortalConnections, buildRingConnections, directConnection, ensurePlayerZonesConnected, plainRoad, mainObjectEndpoint, connectionEndpoint, zoneName } from "./connectionBuilder.ts";
import { buildBalancedNeutralRing, buildBalancedRingLetters, buildOrderedLetters, ladderNeutralIndexes, type NeutralZonePlan } from "./neutralZonePlanner.ts";
import { buildHubZone, buildNaturalExpansionZone, buildNeutralZone, buildSpawnZone } from "./templateContentBuilder.ts";
import type { GenerationTuning, RandomSource } from "./math.ts";
import { byRandom } from "./math.ts";

export function buildVariant(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, holdCityNeutralLetter?: string, hubIsHoldCity = false): Variant {
  playerLetters = byRandom(playerLetters, rng);
  const isTournament = settings.tournamentRules.enabled || settings.gameEndConditions.victoryCondition === "win_condition_6";
  if (isTournament && playerLetters.length === 2) {
    const tournament = buildVariantTournament(settings, playerLetters, neutralZones, tuning, rng);
    if (settings.naturalExpansionZone) addNaturalExpansionZones(tournament, playerLetters, settings, tuning);
    if (settings.matchAdjacentNeutralCastleFactions) applyAdjacentNeutralCastleFactionMatches(tournament);
    if (settings.neutralCastlesAsRuins) applyNeutralCastleRuins(tournament);
    return tournament;
  }

  let variant: Variant;
  switch (settings.topology) {
    case "HubAndSpoke": variant = buildVariantHubAndSpoke(settings, playerLetters, neutralZones, tuning, rng, hubIsHoldCity); break;
    case "Chain": variant = buildVariantChain(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter); break;
    case "SharedWeb": variant = buildVariantSharedWeb(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter); break;
    case "Ladder": variant = buildVariantLadder(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter); break;
    case "Triangle": variant = buildVariantTriangle(settings, playerLetters, neutralZones, tuning, rng, hubIsHoldCity); break;
    case "Random": variant = buildVariantRandom(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter); break;
    default: variant = buildVariantDefault(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter); break;
  }
  if (settings.naturalExpansionZone && settings.topology !== "Triangle") addNaturalExpansionZones(variant, playerLetters, settings, tuning);
  if (settings.matchAdjacentNeutralCastleFactions) applyAdjacentNeutralCastleFactionMatches(variant);
  if (settings.neutralCastlesAsRuins) applyNeutralCastleRuins(variant);
  return variant;
}

function buildVariantDefault(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, holdCityNeutralLetter?: string): Variant {
  const neutralByLetter = mapByLetter(neutralZones);
  const orderedLetters = buildOrderedLetters(settings, playerLetters, neutralZones, true);
  const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;
  const left = Array<string | undefined>(orderedLetters.length);
  const right = Array<string | undefined>(orderedLetters.length);
  for (let i = 0; i < orderedLetters.length; i++) {
    const next = (i + 1) % orderedLetters.length;
    if (isolate && playerLetters.includes(orderedLetters[i]) && playerLetters.includes(orderedLetters[next])) continue;
    const name = orderedLetters.length === 2
      ? `Ring-${orderedLetters[i] < orderedLetters[next] ? orderedLetters[i] : orderedLetters[next]}-${orderedLetters[i] < orderedLetters[next] ? orderedLetters[next] : orderedLetters[i]}`
      : `Ring-${orderedLetters[i]}-${orderedLetters[next]}`;
    right[i] = name;
    left[next] = name;
  }
  const zones = orderedLetters.map((letter, i) => {
    const conns = [...new Set([left[i], right[i]].filter(Boolean) as string[])];
    const playerIdx = playerLetters.indexOf(letter);
    return playerIdx >= 0
      ? buildSpawnZone(letter, playerNameForLetter(letter), conns, settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning)
      : buildNeutralZone(neutralByLetter.get(letter)!, conns, settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning, letter === holdCityNeutralLetter);
  });
  const connections = buildRingConnections(playerLetters, orderedLetters, tuning, isolate);
  addCommonExtras(settings, playerLetters, orderedLetters, zones, connections, neutralZones.length, tuning, rng);
  if (isolate) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning, settings.generateRoads);
  stampRingPositions(zones);
  return makeVariant(playerLetters, orderedLetters[0], orderedLetters.length, zones, connections);
}

function buildVariantChain(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, holdCityNeutralLetter?: string): Variant {
  const neutralByLetter = mapByLetter(neutralZones);
  const orderedLetters = buildOrderedLetters(settings, playerLetters, neutralZones, false);
  const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;
  const connNames = Array<string | undefined>(Math.max(0, orderedLetters.length - 1));
  for (let i = 0; i < orderedLetters.length - 1; i++) {
    if (isolate && playerLetters.includes(orderedLetters[i]) && playerLetters.includes(orderedLetters[i + 1])) continue;
    connNames[i] = `Chain-${orderedLetters[i]}-${orderedLetters[i + 1]}`;
  }
  const zones = orderedLetters.map((letter, i) => {
    const conns = [i > 0 ? connNames[i - 1] : undefined, i < connNames.length ? connNames[i] : undefined].filter(Boolean) as string[];
    const playerIdx = playerLetters.indexOf(letter);
    return playerIdx >= 0
      ? buildSpawnZone(letter, playerNameForLetter(letter), conns, settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning)
      : buildNeutralZone(neutralByLetter.get(letter)!, conns, settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning, letter === holdCityNeutralLetter);
  });
  const connections = connNames.flatMap((name, i) => name ? [directConnection(name, zoneName(playerLetters, orderedLetters[i]), zoneName(playerLetters, orderedLetters[i + 1]), zoneName(playerLetters, orderedLetters[i]), 30000, `chain_guard_${orderedLetters[i]}_${orderedLetters[i + 1]}`, tuning)] : []);
  addCommonExtras(settings, playerLetters, orderedLetters, zones, connections, neutralZones.length, tuning, rng);
  if (isolate) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning, settings.generateRoads);
  stampChainPositions(zones);
  return makeVariant(playerLetters, orderedLetters[0], orderedLetters.length, zones, connections);
}

function buildVariantHubAndSpoke(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, hubIsHoldCity = false): Variant {
  const neutralByLetter = mapByLetter(neutralZones);
  const neutralLetters = neutralZones.map((zone) => zone.letter);
  const outerLetters = settings.experimentalBalancedZonePlacement ? buildBalancedRingLetters(playerLetters, neutralZones, settings.minNeutralZonesBetweenPlayers) : [...playerLetters, ...neutralLetters];
  const zones: Zone[] = [buildHubZone(outerLetters.map((letter) => `Hub-${letter}`), tuning, hubIsHoldCity, settings.zoneCfg.hubZoneSize, settings.zoneCfg.hubZoneCastles, settings.generateRoads)];
  zones[0].generatorPosition = { x: 0.5, y: 0.5 };
  for (const letter of outerLetters) {
    const playerIdx = playerLetters.indexOf(letter);
    zones.push(playerIdx >= 0
      ? buildSpawnZone(letter, playerNameForLetter(letter), [`Hub-${letter}`], settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning)
      : buildNeutralZone(neutralByLetter.get(letter)!, [`Hub-${letter}`], settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning));
  }
  const connections: Connection[] = [];
  for (const letter of outerLetters) connections.push(directConnection(`Hub-${letter}`, "Hub", zoneName(playerLetters, letter), "Hub", 30000, `hub_guard_${letter}`, tuning));
  for (let i = 0; i < outerLetters.length; i++) {
    const next = (i + 1) % outerLetters.length;
    if (settings.noDirectPlayerConnections && playerLetters.includes(outerLetters[i]) && playerLetters.includes(outerLetters[next])) continue;
    connections.push({ name: `Pseudo-${outerLetters[i]}-${outerLetters[next]}`, from: zoneName(playerLetters, outerLetters[i]), to: zoneName(playerLetters, outerLetters[next]), connectionType: "Proximity" });
  }
  addCommonExtras(settings, playerLetters, outerLetters, zones, connections, neutralZones.length, tuning, rng);
  stampRingPositions(zones.filter((zone) => zone.name !== "Hub"));
  return makeVariant(playerLetters, outerLetters[0], outerLetters.length + 1, zones, connections);
}

function buildVariantSharedWeb(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, holdCityNeutralLetter?: string): Variant {
  const neutralByLetter = mapByLetter(neutralZones);
  const neutrals = settings.experimentalBalancedZonePlacement ? buildBalancedNeutralRing(neutralZones, playerLetters.length) : neutralZones.map((zone) => zone.letter);
  if (neutrals.length === 0) return buildVariantDefault(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
  const connsByPlayer = new Map(playerLetters.map((letter) => [letter, [] as string[]]));
  const connsByNeutral = new Map(neutrals.map((letter) => [letter, [] as string[]]));
  const ringConns = neutrals.map((letter, i) => `NRing-${letter}-${neutrals[(i + 1) % neutrals.length]}`);
  for (let i = 0; i < playerLetters.length; i++) {
    const n1 = Math.floor(i * neutrals.length / playerLetters.length) % neutrals.length;
    for (const neutral of [...new Set([neutrals[n1], neutrals[(n1 + 1) % neutrals.length]])]) {
      const name = `Web-${playerLetters[i]}-${neutral}`;
      connsByPlayer.get(playerLetters[i])!.push(name);
      connsByNeutral.get(neutral)!.push(name);
    }
  }
  const zones: Zone[] = neutrals.map((letter, i) => buildNeutralZone(neutralByLetter.get(letter)!, [...(neutrals.length > 1 ? [ringConns[(i - 1 + neutrals.length) % neutrals.length], ringConns[i]] : []), ...connsByNeutral.get(letter)!], settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning, letter === holdCityNeutralLetter));
  zones.push(...playerLetters.map((letter) => buildSpawnZone(letter, playerNameForLetter(letter), connsByPlayer.get(letter)!, settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning)));
  const connections: Connection[] = [];
  for (const player of playerLetters) for (const name of connsByPlayer.get(player)!) {
    const neutral = name.split("-")[2];
    connections.push(directConnection(name, `Spawn-${player}`, `Neutral-${neutral}`, `Neutral-${neutral}`, 30000, `web_guard_${player}_${neutral}`, tuning));
  }
  if (neutrals.length > 1) for (let i = 0; i < neutrals.length; i++) connections.push(directConnection(ringConns[i], `Neutral-${neutrals[i]}`, `Neutral-${neutrals[(i + 1) % neutrals.length]}`, `Neutral-${neutrals[i]}`, 20000, `nring_guard_${neutrals[i]}_${neutrals[(i + 1) % neutrals.length]}`, tuning));
  addCommonExtras(settings, playerLetters, [...playerLetters, ...neutrals], zones, connections, neutrals.length, tuning, rng);
  stampRingPositions(zones);
  return makeVariant(playerLetters, playerLetters[0], zones.length, zones, connections);
}

function buildVariantLadder(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, holdCityNeutralLetter?: string): Variant {
  if (neutralZones.length === 0) return buildVariantChain(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
  const neutralByLetter = mapByLetter(neutralZones);
  const neutrals = settings.experimentalBalancedZonePlacement ? buildBalancedNeutralRing(neutralZones, playerLetters.length) : neutralZones.map((zone) => zone.letter);
  const connsByPlayer = new Map(playerLetters.map((letter) => [letter, [] as string[]]));
  const connsByNeutral = new Map(neutrals.map((letter) => [letter, [] as string[]]));
  const connections: Connection[] = [];
  for (let i = 0; i < neutrals.length - 1; i++) {
    const name = `LadderRail-${neutrals[i]}-${neutrals[i + 1]}`;
    connsByNeutral.get(neutrals[i])!.push(name);
    connsByNeutral.get(neutrals[i + 1])!.push(name);
    connections.push(directConnection(name, `Neutral-${neutrals[i]}`, `Neutral-${neutrals[i + 1]}`, `Neutral-${neutrals[i]}`, 22000, `ladder_rail_guard_${neutrals[i]}_${neutrals[i + 1]}`, tuning));
  }
  for (let i = 0; i < playerLetters.length; i++) for (const neutralIndex of ladderNeutralIndexes(i, playerLetters.length, neutrals.length)) {
    const name = `Ladder-${playerLetters[i]}-${neutrals[neutralIndex]}`;
    connsByPlayer.get(playerLetters[i])!.push(name);
    connsByNeutral.get(neutrals[neutralIndex])!.push(name);
    connections.push(directConnection(name, `Spawn-${playerLetters[i]}`, `Neutral-${neutrals[neutralIndex]}`, `Neutral-${neutrals[neutralIndex]}`, 30000, `ladder_guard_${playerLetters[i]}_${neutrals[neutralIndex]}`, tuning));
  }
  const zones = [
    ...neutrals.map((letter) => buildNeutralZone(neutralByLetter.get(letter)!, [...new Set(connsByNeutral.get(letter)!)], settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning, letter === holdCityNeutralLetter)),
    ...playerLetters.map((letter) => buildSpawnZone(letter, playerNameForLetter(letter), [...new Set(connsByPlayer.get(letter)!)], settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning))
  ];
  addCommonExtras(settings, playerLetters, [...playerLetters, ...neutrals], zones, connections, neutrals.length, tuning, rng);
  stampChainPositions(zones);
  return makeVariant(playerLetters, neutrals[0], zones.length, zones, connections);
}

function buildVariantRandom(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, holdCityNeutralLetter?: string): Variant {
  const neutralByLetter = mapByLetter(neutralZones);
  const allLetters = settings.experimentalBalancedZonePlacement ? buildBalancedRingLetters(playerLetters, neutralZones, 0) : byRandom([...playerLetters, ...neutralZones.map((zone) => zone.letter)], rng);
  const positions = allLetters.map((_, i) => settings.experimentalBalancedZonePlacement ? ringPoint(i, allLetters.length, 0.43) : ({ x: rng.nextDouble() * 0.9 + 0.05, y: rng.nextDouble() * 0.9 + 0.05 }));
  const pairs = delaunayEdges(positions);
  const connsByZone = new Map(allLetters.map((letter) => [letter, [] as string[]]));
  const connections: Connection[] = [];
  const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;
  for (const [a, b] of pairs) {
    const fromLetter = allLetters[a], toLetter = allLetters[b];
    if (isolate && playerLetters.includes(fromLetter) && playerLetters.includes(toLetter)) continue;
    const name = `Rnd-${fromLetter}-${toLetter}`;
    connsByZone.get(fromLetter)!.push(name);
    connsByZone.get(toLetter)!.push(name);
    connections.push(directConnection(name, zoneName(playerLetters, fromLetter), zoneName(playerLetters, toLetter), zoneName(playerLetters, fromLetter), 30000, `rnd_guard_${fromLetter}_${toLetter}`, tuning));
  }
  ensureRandomGraphConnected(playerLetters, allLetters, positions, connsByZone, connections, isolate, tuning);
  const zones = allLetters.map((letter, i) => {
    const playerIdx = playerLetters.indexOf(letter);
    const zone = playerIdx >= 0 ? buildSpawnZone(letter, playerNameForLetter(letter), connsByZone.get(letter)!, settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning) : buildNeutralZone(neutralByLetter.get(letter)!, connsByZone.get(letter)!, settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning, letter === holdCityNeutralLetter);
    zone.generatorPosition = positions[i];
    return zone;
  });
  addCommonExtras(settings, playerLetters, allLetters, zones, connections, neutralZones.length, tuning, rng);
  if (isolate) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning, settings.generateRoads);
  return makeVariant(playerLetters, allLetters[0], allLetters.length, zones, connections);
}

function buildVariantTriangle(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource, hubIsHoldCity = false): Variant {
  const players = playerLetters.slice(0, 3);
  if (settings.naturalExpansionZone && players.length === 3) return buildVariantTriangleWithNaturalExpansions(settings, players, tuning, rng, hubIsHoldCity);

  const contested = neutralZones.slice(0, 3);
  if (players.length !== 3 || contested.length !== 3) return buildVariantHubAndSpoke(settings, playerLetters, neutralZones, tuning, rng, hubIsHoldCity);
  const connections: Connection[] = [];
  const hubConns: string[] = [];
  const connsByPlayer = new Map(players.map((letter) => [letter, [] as string[]]));
  const connsByNeutral = new Map(contested.map((zone) => [zone.letter, [] as string[]]));
  const add = (name: string, from: string, to: string, guardZone: string, guardValue: number, group: string) => { connections.push(directConnection(name, from, to, guardZone, guardValue, group, tuning)); };
  for (let i = 0; i < 3; i++) {
    const contest = contested[i].letter, left = players[i], right = players[(i + 1) % 3];
    for (const [name, from, to, guard, value, group] of [
      [`Triangle-${left}-${contest}`, `Spawn-${left}`, `Neutral-${contest}`, `Neutral-${contest}`, 40000, `triangle_guard_${left}_${contest}`],
      [`Triangle-${contest}-${right}`, `Neutral-${contest}`, `Spawn-${right}`, `Neutral-${contest}`, 40000, `triangle_guard_${contest}_${right}`],
      [`TriangleHub-${contest}`, "Hub", `Neutral-${contest}`, "Hub", 50000, `triangle_hub_guard_${contest}`]
    ] as const) {
      add(name, from, to, guard, value, group);
      if (from.startsWith("Spawn-")) connsByPlayer.get(from.slice(6))!.push(name);
      if (to.startsWith("Spawn-")) connsByPlayer.get(to.slice(6))!.push(name);
      if (from.startsWith("Neutral-")) connsByNeutral.get(from.slice(8))!.push(name);
      if (to.startsWith("Neutral-")) connsByNeutral.get(to.slice(8))!.push(name);
      if (name.includes("Hub")) hubConns.push(name);
    }
  }
  const zones: Zone[] = [buildHubZone(hubConns, tuning, hubIsHoldCity, settings.zoneCfg.hubZoneSize, 1, settings.generateRoads)];
  zones[0].generatorPosition = { x: 0.5, y: 0.5 };
  zones.push(...players.map((letter, i) => Object.assign(buildSpawnZone(letter, playerNameForLetter(letter), [...new Set(connsByPlayer.get(letter)!)], settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning), { generatorPosition: triangleCornerPoint(i) })));
  zones.push(...contested.map((plan, i) => Object.assign(buildNeutralZone(plan, [...new Set(connsByNeutral.get(plan.letter)!)], settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning), { generatorPosition: triangleSidePoint(i) })));
  addCommonExtras(settings, players, [...players, ...contested.map((z) => z.letter)], zones, connections, contested.length, tuning, rng);
  return makeVariant(players, players[0], zones.length, zones, connections);
}

function buildVariantTriangleWithNaturalExpansions(settings: GeneratorSettings, players: string[], tuning: GenerationTuning, rng: RandomSource, hubIsHoldCity = false): Variant {
  const connections: Connection[] = [];
  const hubConns: string[] = [];
  const connsByPlayer = new Map(players.map((letter) => [letter, [] as string[]]));
  const connsByNatural = new Map(players.map((letter) => [letter, [] as string[]]));

  const add = (name: string, from: string, to: string, guardZone: string, guardValue: number, group: string) => {
    connections.push(directConnection(name, from, to, guardZone, guardValue, group, tuning));
    if (from.startsWith("Spawn-")) connsByPlayer.get(from.slice(6))!.push(name);
    if (to.startsWith("Spawn-")) connsByPlayer.get(to.slice(6))!.push(name);
    if (from.startsWith("Natural-")) connsByNatural.get(from.slice(8))!.push(name);
    if (to.startsWith("Natural-")) connsByNatural.get(to.slice(8))!.push(name);
    if (from === "Hub" || to === "Hub") hubConns.push(name);
  };

  for (const player of players) {
    add(`Natural-${player}`, `Spawn-${player}`, `Natural-${player}`, `Natural-${player}`, 12000, `natural_guard_${player}`);
    add(`TriangleHub-${player}`, `Natural-${player}`, "Hub", "Hub", 50000, `triangle_hub_guard_${player}`);
  }

  for (let i = 0; i < players.length; i++) {
    const left = players[i];
    const right = players[(i + 1) % players.length];
    add(`TriangleSide-${left}-${right}`, `Natural-${left}`, `Natural-${right}`, `Natural-${left}`, 28000, `triangle_side_guard_${left}_${right}`);
  }

  const zones: Zone[] = [buildHubZone(hubConns, tuning, hubIsHoldCity, Math.max(settings.zoneCfg.hubZoneSize, hubIsHoldCity ? 1.6 : 1.25), 1, settings.generateRoads)];
  zones[0].generatorPosition = { x: 0.5, y: 0.5 };
  zones.push(...players.map((letter, i) => Object.assign(buildSpawnZone(letter, playerNameForLetter(letter), connsByPlayer.get(letter)!, settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning), { generatorPosition: triangleCornerPoint(i) })));
  zones.push(...players.map((letter, i) => Object.assign(buildNaturalExpansionZone(letter, [...new Set(connsByNatural.get(letter)!)], settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning), { generatorPosition: triangleSidePoint(i) })));

  addCommonExtras(settings, players, players, zones, connections, 0, tuning, rng);
  return makeVariant(players, players[0], zones.length, zones, connections);
}

function buildVariantTournament(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], tuning: GenerationTuning, rng: RandomSource): Variant {
  const sorted = [...neutralZones].sort((a, b) => (b.quality === "High" ? 3 : b.quality === "Medium" ? 2 : 1) - (a.quality === "High" ? 3 : a.quality === "Medium" ? 2 : 1) || b.castleCount - a.castleCount || a.letter.localeCompare(b.letter));
  const split = [[], []] as NeutralZonePlan[][];
  sorted.forEach((zone, i) => split[i % 2].push(zone));
  const zones: Zone[] = [];
  const connections: Connection[] = [];
  for (let p = 0; p < 2; p++) {
    const chain = [playerLetters[p], ...split[p].map((zone) => zone.letter)];
    for (let i = 0; i < chain.length; i++) {
      const conns = [i > 0 ? `Tourney-${chain[i - 1]}-${chain[i]}` : undefined, i < chain.length - 1 ? `Tourney-${chain[i]}-${chain[i + 1]}` : undefined].filter(Boolean) as string[];
      zones.push(i === 0 ? buildSpawnZone(chain[i], playerNameForLetter(chain[i]), conns, settings.zoneCfg.playerZoneCastles, settings.matchPlayerCastleFactions, settings.zoneCfg.advanced.playerZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning) : buildNeutralZone(split[p][i - 1], conns, settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning));
      zones[zones.length - 1].generatorPosition = { x: p === 0 ? 0.1 + i * 0.1 : 0.9 - i * 0.1, y: 0.15 + i * 0.1 };
    }
    for (let i = 0; i < chain.length - 1; i++) connections.push(directConnection(`Tourney-${chain[i]}-${chain[i + 1]}`, i === 0 ? `Spawn-${chain[i]}` : `Neutral-${chain[i]}`, `Neutral-${chain[i + 1]}`, i === 0 ? `Spawn-${chain[i]}` : `Neutral-${chain[i]}`, 30000, `tourney_guard_${chain[i]}_${chain[i + 1]}`, tuning));
  }
  void rng;
  return makeVariant(playerLetters, playerLetters[0], zones.length, zones, connections);
}

function addCommonExtras(settings: GeneratorSettings, playerLetters: string[], orderedLetters: string[], zones: Zone[], connections: Connection[], neutralCount: number, tuning: GenerationTuning, rng: RandomSource): void {
  if (settings.randomPortals) connections.push(...buildRandomPortalConnections(playerLetters, orderedLetters, tuning, rng, settings.maxPortalConnections));
  if (settings.connectionStyle === "ManyRoutes") addAlternateNeutralRoutes(playerLetters, orderedLetters, zones, connections, tuning, settings.generateRoads, neutralCount);
}

function makeVariant(playerLetters: string[], firstLetter: string, totalZones: number, zones: Zone[], connections: Connection[]): Variant {
  return {
    orientation: { zeroAngleZone: playerLetters.includes(firstLetter) ? `Spawn-${firstLetter}` : `Neutral-${firstLetter}`, baseAngleMin: 45, baseAngleMax: 45, randomAngleAmplitude: 360, randomAngleStep: 360 / totalZones },
    border: { cornerRadius: 0, obstaclesWidth: 3, obstaclesNoise: [{ amp: 1, freq: 12 }], waterWidth: 0, waterNoise: [{ amp: 1, freq: 12 }], waterType: "water grass" },
    zones,
    connections
  };
}

function playerNameForLetter(letter: string): string {
  const player = Number(letter);
  return Number.isInteger(player) && player >= 1 ? `Player${player}` : `Player${letter}`;
}

function addNaturalExpansionZones(variant: Variant, playerLetters: string[], settings: GeneratorSettings, tuning: GenerationTuning): void {
  if (!variant.zones || !variant.connections) return;
  for (const playerLetter of playerLetters) {
    const connectionName = `Natural-${playerLetter}`;
    const naturalZone = buildNaturalExpansionZone(playerLetter, [connectionName], settings.zoneCfg.advanced.neutralZoneSize, settings.spawnRemoteFootholds, settings.generateRoads, tuning);
    stampNaturalExpansionPosition(variant.zones.find((zone) => zone.name === `Spawn-${playerLetter}`), naturalZone);
    variant.zones.push(naturalZone);
    variant.connections.push(directConnection(connectionName, `Spawn-${playerLetter}`, `Natural-${playerLetter}`, `Natural-${playerLetter}`, 12000, `natural_guard_${playerLetter}`, tuning));
    if (settings.generateRoads) variant.zones.find((zone) => zone.name === `Spawn-${playerLetter}`)?.roads?.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(connectionName)));
  }
  if (variant.orientation) variant.orientation.randomAngleStep = 360 / variant.zones.length;
}

export function applyAdjacentNeutralCastleFactionMatches(variant: Variant): void {
  const zones = variant.zones ?? [];
  const connections = variant.connections ?? [];
  const zoneNames = new Set(zones.map((zone) => zone.name));
  const spawnNames = new Set([...zoneNames].filter((name) => name.startsWith("Spawn-")));

  for (const zone of zones) {
    if (!zone.name.startsWith("Neutral-")) continue;
    const adjacentSpawns = new Set<string>();
    for (const connection of connections) {
      if (connection.connectionType !== "Direct" && connection.connectionType !== "Portal") continue;
      if (connection.from === zone.name && spawnNames.has(connection.to)) adjacentSpawns.add(connection.to);
      if (connection.to === zone.name && spawnNames.has(connection.from)) adjacentSpawns.add(connection.from);
    }
    if (adjacentSpawns.size !== 1) continue;
    matchNeutralCityFactions(zone, [...adjacentSpawns][0]);
  }
}

function matchNeutralCityFactions(zone: Zone, spawnZoneName: string): void {
  const cityObjects = (zone.mainObjects ?? []).filter((object) => object.type === "City");
  if (cityObjects.length === 0) return;
  cityObjects[0].faction = { type: "Match", args: ["0", spawnZoneName] };
  for (const city of cityObjects.slice(1)) city.faction = { type: "Match", args: ["0"] };
}

export function applyNeutralCastleRuins(variant: Variant): void {
  for (const zone of variant.zones ?? []) {
    if (zone.name.startsWith("Neutral-")) applyNeutralCastleRuinsToZone(zone);
  }
}

export function applyNeutralCastleRuinsToZone(zone: Zone): void {
  for (const object of zone.mainObjects ?? []) {
    if (object.type !== "City" || object.holdCityWinCon === true) continue;
    object.type = "Ruins";
    delete object.faction;
    object.factions = { type: "FromList", args: [] };
  }
}

function stampNaturalExpansionPosition(spawnZone: Zone | undefined, naturalZone: Zone): void {
  if (!spawnZone?.generatorPosition) return;
  let dx = spawnZone.generatorPosition.x - 0.5, dy = spawnZone.generatorPosition.y - 0.5;
  let length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.001) { dx = 1; dy = 0; length = 1; }
  naturalZone.generatorPosition = { x: Math.min(0.95, Math.max(0.05, spawnZone.generatorPosition.x - dx / length * 0.08)), y: Math.min(0.95, Math.max(0.05, spawnZone.generatorPosition.y - dy / length * 0.08)) };
}

function stampRingPositions(zones: Zone[]): void {
  zones.forEach((zone, i) => { zone.generatorPosition ??= ringPoint(i, zones.length, 0.38); });
}

function stampChainPositions(zones: Zone[]): void {
  zones.forEach((zone, i) => { zone.generatorPosition ??= { x: (i + 1) / (zones.length + 1), y: 0.35 + (i % 2) * 0.3 }; });
}

const ringPoint = (i: number, count: number, radius: number): Point => ({ x: 0.5 + Math.cos(2 * Math.PI * i / count - Math.PI / 2) * radius, y: 0.5 + Math.sin(2 * Math.PI * i / count - Math.PI / 2) * radius });
const triangleCornerPoint = (i: number): Point => i === 0 ? { x: 0.5, y: 0.08 } : i === 1 ? { x: 0.12, y: 0.82 } : { x: 0.88, y: 0.82 };
const triangleSidePoint = (i: number): Point => i === 0 ? { x: 0.31, y: 0.45 } : i === 1 ? { x: 0.5, y: 0.82 } : { x: 0.69, y: 0.45 };

function mapByLetter(neutralZones: NeutralZonePlan[]): Map<string, NeutralZonePlan> {
  return new Map(neutralZones.map((zone) => [zone.letter, zone]));
}

function delaunayEdges(points: Point[]): Array<[number, number]> {
  if (points.length <= 1) return [];
  if (points.length === 2) return [[0, 1]];
  const edges = new Set<string>();
  for (let i = 0; i < points.length; i++) {
    const nearest = [...Array(points.length).keys()].filter((j) => j !== i).sort((a, b) => dist(points[i], points[a]) - dist(points[i], points[b])).slice(0, 3);
    for (const j of nearest) edges.add(i < j ? `${i},${j}` : `${j},${i}`);
  }
  return [...edges].map((edge) => edge.split(",").map(Number) as [number, number]);
}

function ensureRandomGraphConnected(playerLetters: string[], allLetters: string[], positions: Point[], connsByZone: Map<string, string[]>, connections: Connection[], isolate: boolean, tuning: GenerationTuning): void {
  const connectedPairs = new Set(connections.map((connection) => edgeKey(connection.from, connection.to)));
  while (true) {
    const components = directComponents(allLetters, connections);
    if (components.length <= 1) return;

    let best: { a: string; b: string; distance: number } | undefined;
    for (const left of components[0]) {
      for (const component of components.slice(1)) {
        for (const right of component) {
          if (isolate && playerLetters.includes(left) && playerLetters.includes(right)) continue;
          const from = zoneName(playerLetters, left);
          const to = zoneName(playerLetters, right);
          if (connectedPairs.has(edgeKey(from, to))) continue;
          const distance = dist(positions[allLetters.indexOf(left)], positions[allLetters.indexOf(right)]);
          if (!best || distance < best.distance) best = { a: left, b: right, distance };
        }
      }
    }

    if (!best) return;
    const name = `RndBridge-${best.a}-${best.b}`;
    connsByZone.get(best.a)!.push(name);
    connsByZone.get(best.b)!.push(name);
    connections.push(directConnection(name, zoneName(playerLetters, best.a), zoneName(playerLetters, best.b), zoneName(playerLetters, best.a), 30000, `rnd_bridge_guard_${best.a}_${best.b}`, tuning));
    connectedPairs.add(edgeKey(zoneName(playerLetters, best.a), zoneName(playerLetters, best.b)));
  }
}

function directComponents(allLetters: string[], connections: Connection[]): string[][] {
  const graph = new Map(allLetters.map((letter) => [letter, [] as string[]]));
  for (const connection of connections.filter((candidate) => candidate.connectionType === "Direct" || candidate.connectionType === "Portal")) {
    const from = letterFromZoneName(connection.from);
    const to = letterFromZoneName(connection.to);
    graph.get(from)?.push(to);
    graph.get(to)?.push(from);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const letter of allLetters) {
    if (visited.has(letter)) continue;
    const component: string[] = [];
    const queue = [letter];
    visited.add(letter);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of graph.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

function edgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function letterFromZoneName(zoneName: string): string {
  const index = zoneName.indexOf("-");
  return index >= 0 ? zoneName.slice(index + 1) : zoneName;
}

const dist = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
