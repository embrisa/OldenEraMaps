const poolCategoryLabels: Record<string, string> = {
  item: "Items",
  pandora: "Pandora Boxes",
  hire: "Hire Locations",
  unit_bank: "Unit Banks",
  res_bank: "Resource Banks",
  stat: "Stat Boosts",
  magic: "Magic Rewards"
};

const resourcePoolLabels: Record<string, string> = {
  content_pool_general_resources_start_zone_poor: "Poor Starting Resources",
  content_pool_general_resources_start_zone_medium: "Standard Starting Resources",
  content_pool_general_resources_start_zone_rich: "Rich Starting Resources"
};

const playerBorderContentLimits = Array.from({ length: 5 }, (_, index) => {
  const first = index + 1;
  return Array.from({ length: 6 - first }, (_unused, offset) => `content_limits_side_${first}_${first + offset + 1}`);
}).flat();

export function displayNameForSid(sid: string): string {
  const resourcePoolLabel = resourcePoolLabels[sid];
  if (resourcePoolLabel) return resourcePoolLabel;

  const contentPoolMatch = sid.match(/^classic_template_pool_random(_unguarded)?_t([2-5])_(.+)$/);
  if (contentPoolMatch) {
    const guardedLabel = contentPoolMatch[1] ? "Unguarded" : "Guarded";
    const tier = contentPoolMatch[2];
    const category = contentPoolMatch[3];
    return `T${tier} ${guardedLabel} ${poolCategoryLabels[category] ?? titleCaseWords(category)}`;
  }

  if (sid === "content_limits_side") return "Standard Neutral Zone Preset";
  if (sid === "content_limits_side_0_0") return "Neutral-Only Zone Preset";

  const sideLimitMatch = sid.match(/^content_limits_side_(\d+)_(\d+)$/);
  if (sideLimitMatch) return `Neutral Zone Between Player ${sideLimitMatch[1]} and Player ${sideLimitMatch[2]}`;

  return sid;
}

export function formatSidListForDisplay(values: string[] | undefined): string {
  if (!values || values.length === 0) return "None";
  if (isAllPlayerBorderContentLimits(values)) return "Every Player-to-Player Neutral Zone Preset";
  return values.map(displayNameForSid).join(", ");
}

function isAllPlayerBorderContentLimits(values: string[]): boolean {
  if (values.length !== playerBorderContentLimits.length) return false;
  const valueSet = new Set(values);
  return playerBorderContentLimits.every((sid) => valueSet.has(sid));
}

function titleCaseWords(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
