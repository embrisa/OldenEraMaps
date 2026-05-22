import type { BiomeSelector, TerrainTheme, Zone } from "./types.ts";

const allTerrainBiomes = ["Grass", "Sand", "Snow", "Lava", "Deathland", "Dirt"] as const;

export const matchZoneBiomeSelector: BiomeSelector = { type: "MatchZone", args: [] };

export function terrainSelector(
  terrainTheme: TerrainTheme,
  fallback: BiomeSelector = { type: "FromList", args: [...allTerrainBiomes] },
): BiomeSelector {
  switch (terrainTheme) {
    case "Random":
    case "Mixed":
      return { type: "FromList", args: [...allTerrainBiomes] };
    case "Grass":
      return { type: "FromList", args: ["Grass"] };
    case "Snow":
      return { type: "FromList", args: ["Snow"] };
    case "Desert":
      return { type: "FromList", args: ["Sand"] };
    case "Lava":
      return { type: "FromList", args: ["Lava"] };
    case "Swamp":
      return { type: "FromList", args: ["Deathland"] };
    default:
      return fallback;
  }
}

export function mixedTerrainSelector(zone: Pick<Zone, "name" | "layout">): BiomeSelector {
  if (zone.name.startsWith("Spawn-")) return { type: "MatchMainObject", args: ["0"] };
  const biomes = zone.name.startsWith("Hub") || zone.layout === "zone_layout_treasure_zone"
    ? ["Lava", "Deathland", "Snow", "Dirt"]
    : [...allTerrainBiomes];
  return { type: "FromList", args: biomes };
}
