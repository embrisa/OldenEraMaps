import type { JSX } from "react";
import { configHelp } from "@/configHelp";
import { Textarea } from "@/components/ui/form-controls";
import { formatLineList, parseLineList } from "@/components/builder/formHelpers";
import { displayNameForSid } from "@/displayNames";

interface ContentPoolCardOption {
  value: string;
  label: string;
  description?: string;
  image?: string;
  group?: string;
}

export function ContentPoolField({ label, configKey, values, onChange }: { label: string; configKey: string; values: string[]; onChange(values: string[]): void }): JSX.Element {
  const options = contentPoolCardOptions(configHelp[configKey]?.suggestions ?? []);
  const selected = new Set(values);
  const groups = groupContentPoolOptions(options);
  return (
    <div className="config-field config-field--content-pool">
      <span className="oe-field__label">{label}</span>
      <div className="content-pool-cards">
        {groups.map((group) => (
          <div key={group.label} className="content-pool-tier">
            <span className="content-pool-tier__label">{group.label}</span>
            <div className="content-pool-tier__cards">
              {group.options.map((option) => {
                const optionValues = parseLineList(option.value);
                const enabled = optionValues.length > 0 && optionValues.every((value) => selected.has(value));
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`content-pool-card ${enabled ? "is-selected" : ""}`}
                    aria-pressed={enabled}
                    title={option.description}
                    onClick={() => onChange(togglePoolValues(values, optionValues))}
                  >
                    {option.image ? <img src={option.image} alt="" loading="lazy" /> : null}
                    <span>{option.label}</span>
                    <small>{enabled ? "Enabled" : "Disabled"}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <details className="raw-details">
        <summary>Show IDs</summary>
        <Textarea rows={3} value={formatLineList(values)} onChange={(event) => onChange(parseLineList(event.currentTarget.value))} />
      </details>
    </div>
  );
}

export function SidListField({
  label,
  configKey,
  values,
  options: explicitOptions,
  onChange
}: {
  label: string;
  configKey: string;
  values: string[];
  options?: ContentPoolCardOption[];
  onChange(values: string[]): void;
}): JSX.Element {
  const options = explicitOptions ?? sidListOptions(configHelp[configKey]?.suggestions ?? []);
  const selected = new Set(values);
  return (
    <div className="config-field config-field--content-pool">
      <span className="oe-field__label">{label}</span>
      <div className="content-pool-cards">
        <div className="content-pool-tier">
          <span className="content-pool-tier__label">Available References</span>
          <div className="content-pool-tier__cards">
            {options.map((option) => {
              const optionValues = parseLineList(option.value);
              const enabled = optionValues.length > 0 && optionValues.every((value) => selected.has(value));
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`content-pool-card ${enabled ? "is-selected" : ""}`}
                  aria-pressed={enabled}
                  title={option.description}
                  onClick={() => onChange(togglePoolValues(values, optionValues))}
                >
                  <span>{option.label}</span>
                  <small>{enabled ? "Enabled" : "Disabled"}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="selected-sid-list" aria-label={`${label} selected values`}>
        {values.length ? values.map((value) => <span key={value}>{displayNameForSid(value)}</span>) : <span>None</span>}
      </div>
      <details className="raw-details">
        <summary>Show IDs</summary>
        <Textarea rows={3} value={formatLineList(values)} onChange={(event) => onChange(parseLineList(event.currentTarget.value))} />
      </details>
    </div>
  );
}

function contentPoolCardOptions(suggestions: Array<{ label: string; value: string | number | boolean; description?: string }>): ContentPoolCardOption[] {
  return suggestions.flatMap((suggestion) => {
    const value = String(suggestion.value);
    const poolSids = parseLineList(value);
    if (poolSids.length <= 1) return [{ label: suggestion.label, value, description: suggestion.description }];
    return poolSids.map((sid) => ({
      label: contentPoolSidLabel(sid),
      value: sid,
      description: contentPoolSidDescription(sid, suggestion.label),
      image: contentPoolSidImage(sid),
      group: contentPoolSidTier(sid) ?? suggestion.label
    }));
  });
}

function sidListOptions(suggestions: Array<{ label: string; value: string | number | boolean; description?: string }>): ContentPoolCardOption[] {
  return suggestions.map((suggestion) => ({
    label: suggestion.label,
    value: String(suggestion.value),
    description: suggestion.description
  }));
}

function groupContentPoolOptions(options: ContentPoolCardOption[]): Array<{ label: string; options: ContentPoolCardOption[] }> {
  const groups = new Map<string, ContentPoolCardOption[]>();
  options.forEach((option) => {
    const label = option.group ?? "Pools";
    groups.set(label, [...(groups.get(label) ?? []), option]);
  });
  return Array.from(groups, ([label, groupedOptions]) => ({ label, options: groupedOptions }));
}

function contentPoolSidLabel(sid: string): string {
  const category = sid.replace(/^.*_t[2-5]_/, "");
  const categoryLabels: Record<string, string> = {
    item: "Item",
    pandora: "Pandora",
    hire: "Hire",
    unit_bank: "Unit Bank",
    res_bank: "Resource Bank",
    stat: "Stat",
    magic: "Magic"
  };
  return categoryLabels[category] ?? category.replaceAll("_", " ");
}

function contentPoolSidDescription(sid: string, tierLabel: string): string {
  const guarded = !sid.includes("_unguarded_");
  const category = sid.replace(/^.*_t[2-5]_/, "");
  const categoryDescriptions: Record<string, string> = {
    item: "artifacts and item rewards",
    pandora: "Pandora Box style rewards",
    hire: "creature hire locations",
    unit_bank: "unit bank fights and rewards",
    res_bank: "resource bank fights and rewards",
    stat: "hero stat bonuses",
    magic: "spell and magic rewards"
  };
  return `${tierLabel} ${guarded ? "guarded" : "unguarded"} pool for ${categoryDescriptions[category] ?? category.replaceAll("_", " ")}.`;
}

function contentPoolSidTier(sid: string): string | undefined {
  const tier = sid.match(/_t([2-5])_/)?.[1];
  return tier ? `T${tier}` : undefined;
}

function contentPoolSidImage(sid: string): string {
  const category = sid.replace(/^.*_t[2-5]_/, "");
  const categoryImages: Record<string, string> = {
    item: "/assets/olden-era/map-objects/resource-chest.png",
    pandora: "/assets/olden-era/map-objects/pandora-box.png",
    hire: "/assets/olden-era/map-objects/barracks.png",
    unit_bank: "/assets/olden-era/map-objects/dragon-utopia.png",
    res_bank: "/assets/olden-era/map-objects/goblin-cache.png",
    stat: "/assets/olden-era/map-objects/arena.png",
    magic: "/assets/olden-era/map-objects/altar-of-magic-1.png"
  };
  return categoryImages[category] ?? "/assets/olden-era/map-objects/resource-chest.png";
}

function togglePoolValues(currentValues: string[], toggledValues: string[]): string[] {
  const current = new Set(currentValues);
  const enabled = toggledValues.length > 0 && toggledValues.every((value) => current.has(value));
  toggledValues.forEach((value) => {
    if (enabled) current.delete(value);
    else current.add(value);
  });
  return Array.from(current);
}
