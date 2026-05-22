export type CommunityTagKind = "factual" | "descriptive";
export type CommunityTagCategory =
  | "players"
  | "size"
  | "size-class"
  | "win-condition"
  | "zones"
  | "roads"
  | "portals"
  | "topology"
  | "neutral"
  | "risk"
  | "audience"
  | "economy"
  | "layout"
  | "pacing";

export type CommunitySizeClass = "small" | "medium" | "large";
export type CommunityWinConditionKind = "classic" | "city-hold" | "tournament" | "other";
export type CommunityTopologyHint = "ring" | "chain" | "hub" | "shared-web" | "balanced" | "random";
export type CommunityNeutralMix = "low" | "medium" | "high";
export type CommunityBinaryTagState = "on" | "off";
export type CommunityRiskHint = "experimental-size" | "high-zone-density" | "many-castles";

export interface CommunityTag {
  slug: string;
  label: string;
  kind: CommunityTagKind;
  category: CommunityTagCategory;
}

export interface CommunityFactualTagContext {
  mapWidth: number;
  mapHeight: number;
  playerCount: number;
  zoneCount: number;
  sizeClass: CommunitySizeClass;
  winConditionKind: CommunityWinConditionKind;
  topologyHints: CommunityTopologyHint[];
  roads: CommunityBinaryTagState | null;
  portals: CommunityBinaryTagState | null;
  neutralMix: CommunityNeutralMix | null;
  neutralCastles: boolean;
  riskHints: CommunityRiskHint[];
}

export interface DescriptiveTagConstraint {
  minPlayerCount?: number;
  winConditionKinds?: readonly CommunityWinConditionKind[];
}

export interface DescriptiveTagDefinition extends CommunityTag {
  constraints?: DescriptiveTagConstraint;
  exclusiveWith?: readonly string[];
}

const WIN_CONDITION_LABELS: Record<CommunityWinConditionKind, string> = {
  classic: "Classic",
  "city-hold": "City Hold",
  tournament: "Tournament",
  other: "Other win"
};

export function formatWinConditionLabel(winCondition: string): string {
  const kind = deriveWinConditionKind(winCondition);
  return kind === "other" ? winCondition : WIN_CONDITION_LABELS[kind];
}

const TOPOLOGY_LABELS: Record<CommunityTopologyHint, string> = {
  ring: "Ring",
  chain: "Chain",
  hub: "Hub",
  "shared-web": "Shared web",
  balanced: "Balanced",
  random: "Random"
};

const DESCRIPTIVE_TAG_DEFINITIONS: readonly DescriptiveTagDefinition[] = [
  {
    slug: "competitive",
    label: "Competitive",
    kind: "descriptive",
    category: "audience",
    constraints: {
      minPlayerCount: 2,
      winConditionKinds: ["classic"]
    },
    exclusiveWith: ["casual"]
  },
  {
    slug: "casual",
    label: "Casual",
    kind: "descriptive",
    category: "audience",
    exclusiveWith: ["competitive"]
  },
  {
    slug: "macro",
    label: "Macro",
    kind: "descriptive",
    category: "pacing"
  },
  {
    slug: "tempo",
    label: "Tempo",
    kind: "descriptive",
    category: "pacing"
  },
  {
    slug: "high-resource",
    label: "High resource",
    kind: "descriptive",
    category: "economy",
    exclusiveWith: ["low-resource"]
  },
  {
    slug: "low-resource",
    label: "Low resource",
    kind: "descriptive",
    category: "economy",
    exclusiveWith: ["high-resource"]
  },
  {
    slug: "chokepoints",
    label: "Chokepoints",
    kind: "descriptive",
    category: "layout"
  },
  {
    slug: "wide",
    label: "Wide",
    kind: "descriptive",
    category: "layout"
  },
  {
    slug: "beginner-friendly",
    label: "Beginner friendly",
    kind: "descriptive",
    category: "audience"
  },
  {
    slug: "high-risk",
    label: "High risk",
    kind: "descriptive",
    category: "layout"
  },
  {
    slug: "exploration-heavy",
    label: "Exploration heavy",
    kind: "descriptive",
    category: "pacing"
  }
] as const;

const DESCRIPTIVE_TAGS_BY_SLUG = new Map(DESCRIPTIVE_TAG_DEFINITIONS.map((tag) => [tag.slug, tag]));

export function getAllowedDescriptiveTags(): readonly DescriptiveTagDefinition[] {
  return DESCRIPTIVE_TAG_DEFINITIONS;
}

export function normalizeTagSlug(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "-")
    .replace(/-+:/g, ":")
    .replace(/:-+/g, ":")
    .replace(/^-+|-+$/g, "")
    .replace(/:+$/, "");
}

export function normalizeTagSlugs(values: readonly string[], maxCount = 8): string[] {
  const tags = values.map(normalizeTagSlug).filter(Boolean);
  return [...new Set(tags)].slice(0, maxCount);
}

export function deriveSizeClass(mapWidth: number, mapHeight: number): CommunitySizeClass {
  const largestDimension = Math.max(mapWidth, mapHeight);
  if (largestDimension <= 144) return "small";
  if (largestDimension <= 200) return "medium";
  return "large";
}

export function deriveWinConditionKind(winCondition: string): CommunityWinConditionKind {
  if (winCondition === "win_condition_1") return "classic";
  if (winCondition === "win_condition_5") return "city-hold";
  if (winCondition === "win_condition_6") return "tournament";
  return "other";
}

export function deriveFactualTags(context: CommunityFactualTagContext): CommunityTag[] {
  const factualSlugs = [
    `players:${context.playerCount}`,
    `size:${context.mapWidth}x${context.mapHeight}`,
    `size-class:${context.sizeClass}`,
    `win:${context.winConditionKind}`,
    `zones:${context.zoneCount}`,
    ...(context.roads ? [`roads:${context.roads}`] : []),
    ...(context.portals ? [`portals:${context.portals}`] : []),
    ...context.topologyHints.map((hint) => `topology:${hint}`),
    ...(context.neutralMix ? [`neutral:${context.neutralMix}`] : []),
    ...(context.neutralCastles ? ["neutral-castles:on"] : []),
    ...context.riskHints
  ];

  return normalizeTagSlugs(factualSlugs, factualSlugs.length).map((slug) => createTagFromSlug(slug, "factual"));
}

export function validateDescriptiveTagSelection(
  requestedSlugs: readonly string[],
  context: CommunityFactualTagContext,
  factualTags: readonly CommunityTag[]
): { tags: CommunityTag[]; errors: string[] } {
  const normalized = normalizeTagSlugs(requestedSlugs);
  const factualSlugs = new Set(factualTags.map((tag) => tag.slug));
  const selectedDefinitions: DescriptiveTagDefinition[] = [];
  const errors: string[] = [];

  for (const slug of normalized) {
    if (factualSlugs.has(slug)) {
      errors.push(`Descriptive tag "${slug}" duplicates factual map metadata.`);
      continue;
    }
    const definition = DESCRIPTIVE_TAGS_BY_SLUG.get(slug);
    if (!definition) {
      errors.push(`Unknown descriptive tag "${slug}".`);
      continue;
    }
    selectedDefinitions.push(definition);
    const violation = firstConstraintViolation(definition, context);
    if (violation) errors.push(violation);
  }

  const selectedSlugs = new Set(selectedDefinitions.map((tag) => tag.slug));
  for (const definition of selectedDefinitions) {
    const conflictingSlug = definition.exclusiveWith?.find((slug) => selectedSlugs.has(slug));
    if (!conflictingSlug) continue;
    if (definition.slug.localeCompare(conflictingSlug) > 0) continue;
    errors.push(`Descriptive tags "${definition.slug}" and "${conflictingSlug}" cannot be combined.`);
  }

  return {
    tags: selectedDefinitions.map((definition) => ({ ...definition })),
    errors: [...new Set(errors)]
  };
}

export function createTagFromSlug(slug: string, fallbackKind: CommunityTagKind = "descriptive"): CommunityTag {
  const normalized = normalizeTagSlug(slug);
  const descriptive = DESCRIPTIVE_TAGS_BY_SLUG.get(normalized);
  if (descriptive) return { ...descriptive };

  const factual = createKnownFactualTag(normalized);
  if (factual) return factual;

  return {
    slug: normalized,
    label: humanizeTagSlug(normalized),
    kind: fallbackKind,
    category: fallbackKind === "factual" ? "risk" : "layout"
  };
}

export function sortTags(tags: readonly CommunityTag[]): CommunityTag[] {
  return [...tags].sort((left, right) =>
    left.kind.localeCompare(right.kind) ||
    left.category.localeCompare(right.category) ||
    left.label.localeCompare(right.label)
  );
}

function firstConstraintViolation(tag: DescriptiveTagDefinition, context: CommunityFactualTagContext): string | null {
  if (tag.constraints?.minPlayerCount && context.playerCount < tag.constraints.minPlayerCount) {
    return `Descriptive tag "${tag.slug}" requires at least ${tag.constraints.minPlayerCount} players.`;
  }
  if (tag.constraints?.winConditionKinds && !tag.constraints.winConditionKinds.includes(context.winConditionKind)) {
    return `Descriptive tag "${tag.slug}" is not allowed for ${WIN_CONDITION_LABELS[context.winConditionKind].toLowerCase()} maps.`;
  }
  return null;
}

function createKnownFactualTag(slug: string): CommunityTag | null {
  const playersMatch = /^players:(\d+)$/.exec(slug);
  if (playersMatch) {
    const value = Number(playersMatch[1]);
    return { slug, label: `${value} players`, kind: "factual", category: "players" };
  }

  const sizeMatch = /^size:(\d+)x(\d+)$/.exec(slug);
  if (sizeMatch) {
    return { slug, label: `${sizeMatch[1]}x${sizeMatch[2]}`, kind: "factual", category: "size" };
  }

  const sizeClassMatch = /^size-class:(small|medium|large)$/.exec(slug);
  if (sizeClassMatch) {
    return { slug, label: titleCase(sizeClassMatch[1]), kind: "factual", category: "size-class" };
  }

  const winMatch = /^win:(classic|city-hold|tournament|other)$/.exec(slug);
  if (winMatch) {
    return {
      slug,
      label: WIN_CONDITION_LABELS[winMatch[1] as CommunityWinConditionKind],
      kind: "factual",
      category: "win-condition"
    };
  }

  const zonesMatch = /^zones:(\d+)$/.exec(slug);
  if (zonesMatch) {
    const value = Number(zonesMatch[1]);
    return { slug, label: `${value} zones`, kind: "factual", category: "zones" };
  }

  const roadsMatch = /^roads:(on|off)$/.exec(slug);
  if (roadsMatch) {
    return { slug, label: `Roads ${roadsMatch[1]}`, kind: "factual", category: "roads" };
  }

  const portalsMatch = /^portals:(on|off)$/.exec(slug);
  if (portalsMatch) {
    return { slug, label: `Portals ${portalsMatch[1]}`, kind: "factual", category: "portals" };
  }

  const topologyMatch = /^topology:(ring|chain|hub|shared-web|balanced|random)$/.exec(slug);
  if (topologyMatch) {
    return {
      slug,
      label: TOPOLOGY_LABELS[topologyMatch[1] as CommunityTopologyHint],
      kind: "factual",
      category: "topology"
    };
  }

  const neutralMatch = /^neutral:(low|medium|high)$/.exec(slug);
  if (neutralMatch) {
    return {
      slug,
      label: `${titleCase(neutralMatch[1])} neutrals`,
      kind: "factual",
      category: "neutral"
    };
  }

  if (slug === "neutral-castles:on") {
    return { slug, label: "Neutral castles", kind: "factual", category: "neutral" };
  }
  if (slug === "experimental-size") {
    return { slug, label: "Experimental size", kind: "factual", category: "risk" };
  }
  if (slug === "high-zone-density") {
    return { slug, label: "High zone density", kind: "factual", category: "risk" };
  }
  if (slug === "many-castles") {
    return { slug, label: "Many castles", kind: "factual", category: "risk" };
  }

  return null;
}

function humanizeTagSlug(slug: string): string {
  const [prefix, rest] = slug.split(":");
  if (!rest) return titleCase(prefix.replace(/-/g, " "));
  return `${titleCase(prefix.replace(/-/g, " "))}: ${titleCase(rest.replace(/-/g, " "))}`;
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0] ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}
