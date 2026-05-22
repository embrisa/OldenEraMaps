const PREVIEW_RENDERER_VERSION = 1;
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_MAX_BATCHES = 50;
const FAILURE_LIMIT = 25;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the preview backfill.");
  }

  const batchSize = clampPositiveInt(readArg("--batch-size"), DEFAULT_BATCH_SIZE);
  const maxBatches = clampPositiveInt(readArg("--max-batches"), DEFAULT_MAX_BATCHES);
  const dryRun = hasFlag("--dry-run");
  let cursor = readArg("--cursor") ?? null;

  const totalRows = await countMaps(supabaseUrl, serviceRoleKey);

  const failures = [];
  let examined = 0;
  let updated = 0;
  let skippedValid = 0;
  let batches = 0;
  let hasMore = false;

  while (batches < maxBatches) {
    const rows = await fetchMapsBatch(supabaseUrl, serviceRoleKey, batchSize, cursor);
    if (rows.length === 0) {
      hasMore = false;
      break;
    }

    batches += 1;
    hasMore = rows.length === batchSize;

    for (const row of rows) {
      cursor = row.id;
      examined += 1;

      const currentPreview = parsePreview(row.preview_design_json);
      if (currentPreview && row.preview_renderer_version === PREVIEW_RENDERER_VERSION) {
        skippedValid += 1;
        continue;
      }

      const nextPreview = buildPreviewFromStoredDesign(row.design_json)
        ?? buildPreviewFromTemplate(row.template_json);

      if (!nextPreview) {
        if (failures.length < FAILURE_LIMIT) {
          failures.push({
            id: row.id,
            title: row.title ?? "Untitled Map",
            reason: "Could not derive preview payload from stored design_json or template_json.",
          });
        }
        continue;
      }

      if (dryRun) {
        updated += 1;
        continue;
      }

      try {
        await updateMapPreview(supabaseUrl, serviceRoleKey, row.id, nextPreview);
      } catch (error) {
        if (failures.length < FAILURE_LIMIT) {
          failures.push({
            id: row.id,
            title: row.title ?? "Untitled Map",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        continue;
      }

      updated += 1;
    }

    if (rows.length < batchSize) {
      hasMore = false;
      break;
    }
  }

  console.log(JSON.stringify({
    totalRows,
    examined,
    updated,
    skippedValid,
    failed: failures.length,
    failures,
    batches,
    dryRun,
    hasMore,
    nextCursor: hasMore ? cursor : null,
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
  }, null, 2));
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function clampPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function countMaps(supabaseUrl, serviceRoleKey) {
  const response = await fetch(`${supabaseUrl}/rest/v1/maps?select=id`, {
    method: "HEAD",
    headers: buildHeaders(serviceRoleKey, { Prefer: "count=exact" }),
  });
  if (!response.ok) {
    throw new Error(`Failed to count maps: ${await response.text()}`);
  }
  const contentRange = response.headers.get("content-range");
  const total = contentRange?.split("/")[1];
  return total ? Number.parseInt(total, 10) : null;
}

async function fetchMapsBatch(supabaseUrl, serviceRoleKey, batchSize, cursor) {
  const params = new URLSearchParams({
    select: "id,title,template_json,design_json,preview_design_json,preview_renderer_version",
    order: "id.asc",
    limit: String(batchSize),
  });
  if (cursor) {
    params.set("id", `gt.${cursor}`);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/maps?${params.toString()}`, {
    headers: buildHeaders(serviceRoleKey),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch map batch: ${await response.text()}`);
  }
  return await response.json();
}

async function updateMapPreview(supabaseUrl, serviceRoleKey, mapId, previewDesignJson) {
  const response = await fetch(`${supabaseUrl}/rest/v1/maps?id=eq.${encodeURIComponent(mapId)}`, {
    method: "PATCH",
    headers: buildHeaders(serviceRoleKey, {
      "content-type": "application/json",
      Prefer: "return=minimal",
    }),
    body: JSON.stringify({
      preview_design_json: previewDesignJson,
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update map ${mapId}: ${await response.text()}`);
  }
}

function buildHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

function parseJson(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? value : null;
}

function parsePreview(value) {
  const preview = parseJson(value);
  if (!isObject(preview)) return null;
  if (preview.version !== PREVIEW_RENDERER_VERSION) return null;
  if (!Number.isFinite(preview.mapWidth) || !Number.isFinite(preview.mapHeight) || typeof preview.templateName !== "string") return null;
  if (!Array.isArray(preview.zones) || !Array.isArray(preview.connections)) return null;
  return preview;
}

function buildPreviewFromStoredDesign(raw) {
  const parsed = parseJson(raw);
  if (!isObject(parsed)) return null;
  const design = isObject(parsed.design) ? parsed.design : parsed;
  if (!isObject(design)) return null;
  if (!Number.isFinite(design.mapWidth) || !Number.isFinite(design.mapHeight) || typeof design.templateName !== "string") return null;
  if (!Array.isArray(design.zones) || !Array.isArray(design.connections)) return null;

  const fallbackPositions = buildFallbackPositions(
    design.zones.map((zone) => ({
      name: typeof zone?.name === "string" ? zone.name : "",
      role: inferDesignRole(zone),
      holdCity: Boolean(zone?.holdCity),
    })),
    design.connections.map((connection) => ({
      from: typeof connection?.from === "string" ? connection.from : "",
      to: typeof connection?.to === "string" ? connection.to : "",
    })),
  );

  return {
    version: PREVIEW_RENDERER_VERSION,
    mapWidth: design.mapWidth,
    mapHeight: design.mapHeight,
    templateName: design.templateName,
    zones: design.zones.map((zone, index) => ({
      id: stringOrFallback(zone?.id, `zone-${index + 1}`),
      name: stringOrFallback(zone?.name, `Zone ${index + 1}`),
      signature: designSignature(zone),
      role: inferDesignRole(zone),
      player: Number.isFinite(zone?.player) ? zone.player : null,
      quality: stringOrFallback(zone?.quality, inferQualityFromLayout(zone?.layout)),
      castleCount: numberOrFallback(zone?.castleCount, 0),
      size: numberOrFallback(zone?.size, 1),
      terrainTheme: stringOrFallback(zone?.terrainTheme, "Grass"),
      resourceDensityPercent: numberOrFallback(zone?.resourceDensityPercent, 100),
      structureDensityPercent: numberOrFallback(zone?.structureDensityPercent, 100),
      neutralStackStrengthPercent: numberOrFallback(zone?.neutralStackStrengthPercent, 100),
      guardMultiplier: numberOrFallback(zone?.guardMultiplier, 1),
      guardWeeklyIncrement: numberOrFallback(zone?.guardWeeklyIncrement, 0.25),
      resourcesValue: numberOrFallback(zone?.resourcesValue, 0),
      resourcesValuePerArea: numberOrFallback(zone?.resourcesValuePerArea, 0),
      roads: Boolean(zone?.roads),
      footholds: Boolean(zone?.footholds),
      holdCity: Boolean(zone?.holdCity),
      neutralCastlesAsRuins: Boolean(zone?.neutralCastlesAsRuins),
      naturalExpansion: Boolean(zone?.naturalExpansion),
      zoneBiome: objectOrNull(zone?.zoneBiome),
      contentBiome: objectOrNull(zone?.contentBiome),
      metaObjectsBiome: objectOrNull(zone?.metaObjectsBiome),
      position: normalizePosition(zone?.position, fallbackPositions.get(stringOrFallback(zone?.name, `Zone ${index + 1}`))),
    })),
    connections: design.connections.map((connection, index) => ({
      id: stringOrFallback(connection?.id, `conn-${index + 1}`),
      fromZoneId: stringOrFallback(connection?.from, ""),
      toZoneId: stringOrFallback(connection?.to, ""),
      type: inferConnectionType(connection?.type),
      road: Boolean(connection?.road),
    })).filter((connection) => connection.fromZoneId && connection.toZoneId),
  };
}

function buildPreviewFromTemplate(raw) {
  const template = parseJson(raw);
  if (!isObject(template)) return null;
  const variant = Array.isArray(template.variants) ? template.variants[0] : null;
  if (!isObject(variant)) return null;
  const templateZones = Array.isArray(variant.zones) ? variant.zones.filter(isObject) : [];
  const templateConnections = Array.isArray(variant.connections) ? variant.connections.filter(isObject) : [];
  if (templateZones.length === 0) return null;

  const roadNamesByZone = new Map(templateZones.map((zone) => [zone.name, extractRoadConnectionNames(zone)]));
  const positions = buildFallbackPositions(
    templateZones.map((zone) => ({
      name: stringOrFallback(zone.name, ""),
      role: inferTemplateRole(zone, templateConnections),
      holdCity: hasHoldCity(zone),
    })),
    templateConnections.map((connection) => ({
      from: stringOrFallback(connection.from, ""),
      to: stringOrFallback(connection.to, ""),
    })),
  );

  return {
    version: PREVIEW_RENDERER_VERSION,
    mapWidth: numberOrFallback(template.sizeX, 160),
    mapHeight: numberOrFallback(template.sizeZ, 160),
    templateName: stringOrFallback(template.name, "Untitled Map"),
    zones: templateZones.map((zone, index) => ({
      id: stringOrFallback(zone.name, `zone-${index + 1}`),
      name: stringOrFallback(zone.name, `Zone ${index + 1}`),
      signature: templateSignature(zone),
      role: inferTemplateRole(zone, templateConnections),
      player: inferTemplatePlayer(zone),
      quality: inferQualityFromLayout(zone.layout),
      castleCount: countCastles(zone),
      size: numberOrFallback(zone.size, 1),
      terrainTheme: "Grass",
      resourceDensityPercent: percentFromValue(zone.resourcesValuePerArea, 300),
      structureDensityPercent: percentFromValue(zone.guardedContentValuePerArea, 2000),
      neutralStackStrengthPercent: percentFromMultiplier(zone.guardMultiplier, 1),
      guardMultiplier: numberOrFallback(zone.guardMultiplier, 1),
      guardWeeklyIncrement: numberOrFallback(zone.guardWeeklyIncrement, 0.25),
      resourcesValue: numberOrFallback(zone.resourcesValue, 0),
      resourcesValuePerArea: numberOrFallback(zone.resourcesValuePerArea, 0),
      roads: extractRoadConnectionNames(zone).size > 0,
      footholds: hasFoothold(zone),
      holdCity: hasHoldCity(zone),
      neutralCastlesAsRuins: hasRuins(zone),
      naturalExpansion: false,
      zoneBiome: objectOrNull(zone.zoneBiome),
      contentBiome: objectOrNull(zone.contentBiome),
      metaObjectsBiome: objectOrNull(zone.metaObjectsBiome),
      position: positions.get(stringOrFallback(zone.name, `zone-${index + 1}`)) ?? { x: 0.5, y: 0.5 },
    })),
    connections: templateConnections.map((connection, index) => ({
      id: stringOrFallback(connection.name, `conn-${index + 1}`),
      fromZoneId: stringOrFallback(connection.from, ""),
      toZoneId: stringOrFallback(connection.to, ""),
      type: inferConnectionType(connection.connectionType),
      road: Boolean(roadNamesByZone.get(connection.from)?.has(connection.name) || roadNamesByZone.get(connection.to)?.has(connection.name)),
    })).filter((connection) => connection.fromZoneId && connection.toZoneId),
  };
}

function buildFallbackPositions(zones, connections) {
  const positions = new Map();
  const names = zones.map((zone) => zone.name).filter(Boolean);
  if (names.length === 0) return positions;

  const degreeByName = new Map(names.map((name) => [name, 0]));
  for (const connection of connections) {
    if (degreeByName.has(connection.from)) degreeByName.set(connection.from, (degreeByName.get(connection.from) ?? 0) + 1);
    if (degreeByName.has(connection.to)) degreeByName.set(connection.to, (degreeByName.get(connection.to) ?? 0) + 1);
  }

  const spawnZones = zones.filter((zone) => zone.role === "Spawn").sort(compareZoneNames);
  const centralZones = zones
    .filter((zone) => zone.role !== "Spawn" && (zone.holdCity || (degreeByName.get(zone.name) ?? 0) >= 3))
    .sort(compareZoneNames);

  if (centralZones.length > 0) {
    positions.set(centralZones[0].name, { x: 0.5, y: 0.5 });
  }

  if (spawnZones.length > 0) {
    placeRing(spawnZones.map((zone) => zone.name), 0.38, -Math.PI / 2, positions);
  }

  const assigned = new Set(positions.keys());
  const remaining = zones.filter((zone) => !assigned.has(zone.name)).sort(compareZoneNames);
  if (remaining.length === 0) return positions;

  const sources = spawnZones.length > 0
    ? spawnZones.map((zone) => zone.name)
    : centralZones.length > 0
      ? centralZones.map((zone) => zone.name)
      : [remaining[0].name];
  const distances = shortestDistances(names, connections, sources);
  const groups = new Map();
  for (const zone of remaining) {
    const distance = distances.get(zone.name) ?? 1;
    const key = zone.holdCity && !positions.has(zone.name) ? 0 : Math.max(1, distance);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(zone.name);
  }

  const sortedLevels = [...groups.keys()].sort((left, right) => left - right);
  for (const level of sortedLevels) {
    const radius = level === 0 ? 0.18 : Math.min(0.42, 0.18 + level * 0.12);
    const namesAtLevel = groups.get(level).sort();
    const offset = level === 0 ? 0 : -Math.PI / 2 + (level - 1) * 0.55;
    placeRing(namesAtLevel, radius, offset, positions);
  }

  return positions;
}

function shortestDistances(names, connections, sourceNames) {
  const adjacency = new Map(names.map((name) => [name, []]));
  for (const connection of connections) {
    if (adjacency.has(connection.from) && adjacency.has(connection.to)) {
      adjacency.get(connection.from).push(connection.to);
      adjacency.get(connection.to).push(connection.from);
    }
  }

  const distances = new Map();
  const queue = [];
  for (const source of sourceNames) {
    if (!adjacency.has(source) || distances.has(source)) continue;
    distances.set(source, 0);
    queue.push(source);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const distance = distances.get(current) ?? 0;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, distance + 1);
      queue.push(neighbor);
    }
  }

  return distances;
}

function placeRing(names, radius, startAngle, positions) {
  if (names.length === 0) return;
  if (names.length === 1 && radius <= 0.2) {
    positions.set(names[0], { x: 0.5, y: 0.5 });
    return;
  }
  const step = (Math.PI * 2) / Math.max(names.length, 2);
  names.forEach((name, index) => {
    const angle = startAngle + step * index;
    positions.set(name, {
      x: clamp01(0.5 + Math.cos(angle) * radius),
      y: clamp01(0.5 + Math.sin(angle) * radius),
    });
  });
}

function normalizePosition(position, fallback) {
  if (isObject(position) && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    return {
      x: clamp01(position.x),
      y: clamp01(position.y),
    };
  }
  return fallback ?? { x: 0.5, y: 0.5 };
}

function inferTemplateRole(zone, connections) {
  if (inferTemplatePlayer(zone) !== null) return "Spawn";
  const degree = connections.reduce((count, connection) => count + (connection.from === zone.name || connection.to === zone.name ? 1 : 0), 0);
  if (hasHoldCity(zone) || /hub|center|crossroads/i.test(stringOrFallback(zone.name, "")) || degree >= 3) return "Hub";
  return "Neutral";
}

function inferDesignRole(zone) {
  if (zone?.role === "Spawn" || zone?.role === "Hub" || zone?.role === "Neutral") return zone.role;
  return Number.isFinite(zone?.player) ? "Spawn" : "Neutral";
}

function inferTemplatePlayer(zone) {
  const spawnObject = objectList(zone.mainObjects).find((entry) => entry.type === "Spawn" && typeof entry.spawn === "string");
  if (!spawnObject) return null;
  const match = /^Player(\d+)$/i.exec(spawnObject.spawn);
  return match ? Number.parseInt(match[1], 10) : null;
}

function inferConnectionType(value) {
  return value === "Portal" || value === "Proximity" ? value : "Direct";
}

function inferQualityFromLayout(layout) {
  const name = stringOrFallback(layout, "").toLowerCase();
  if (name.includes("side")) return "Low";
  if (name.includes("treasure")) return "Medium";
  return "High";
}

function countCastles(zone) {
  return objectList(zone.mainObjects).filter((entry) => entry.type === "City" || entry.type === "Ruins").length;
}

function hasFoothold(zone) {
  return objectList(zone.mainObjects).some((entry) => {
    const type = stringOrFallback(entry.type, "").toLowerCase();
    const sid = stringOrFallback(entry.sid, "").toLowerCase();
    return type.includes("foothold") || sid.includes("foothold");
  });
}

function hasHoldCity(zone) {
  return objectList(zone.mainObjects).some((entry) => entry.holdCityWinCon === true);
}

function hasRuins(zone) {
  return objectList(zone.mainObjects).some((entry) => entry.type === "Ruins");
}

function extractRoadConnectionNames(zone) {
  const names = new Set();
  const roads = Array.isArray(zone?.roads) ? zone.roads : [];
  for (const road of roads) {
    const args = road?.to?.args;
    if (Array.isArray(args) && typeof args[0] === "string") names.add(args[0]);
  }
  return names;
}

function percentFromValue(value, baseline) {
  const numeric = numberOrFallback(value, baseline);
  return Math.max(20, Math.min(300, Math.round((numeric / baseline) * 100)));
}

function percentFromMultiplier(value, baseline) {
  const numeric = numberOrFallback(value, baseline);
  return Math.max(20, Math.min(300, Math.round((numeric / baseline) * 100)));
}

function designSignature(zone) {
  return [
    inferDesignRole(zone),
    stringOrFallback(zone?.quality, "Medium"),
    numberOrFallback(zone?.castleCount, 0),
    numberOrFallback(zone?.size, 1),
    stringOrFallback(zone?.terrainTheme, "Grass"),
    Boolean(zone?.roads),
    Boolean(zone?.footholds),
    Boolean(zone?.holdCity),
  ].join("|");
}

function templateSignature(zone) {
  return [
    inferTemplateRole(zone, []),
    inferQualityFromLayout(zone.layout),
    countCastles(zone),
    numberOrFallback(zone.size, 1),
    Boolean(zone.roads && zone.roads.length),
    hasFoothold(zone),
    hasHoldCity(zone),
  ].join("|");
}

function compareZoneNames(left, right) {
  return left.name.localeCompare(right.name, undefined, { numeric: true });
}

function stringOrFallback(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function numberOrFallback(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function objectOrNull(value) {
  return isObject(value) ? value : null;
}

function objectList(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clamp01(value) {
  return Math.max(0.12, Math.min(0.88, value));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});