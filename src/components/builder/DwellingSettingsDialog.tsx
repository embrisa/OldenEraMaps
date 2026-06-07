import { Castle, Minus, Plus, Search, Settings2, X } from "lucide-react";
import { useMemo, useState, type JSX } from "react";
import { defaultDwellingSettingsForZone, dwellingCountFromSettings, normalizeDwellingSettings, type DesignZone, type DwellingSettings, type DwellingSpecificEntry } from "@/design";
import { highTierRandomHireList, lowTierRandomHireList, maxDwellingCount } from "@/generator/templateContentBuilder";
import { Button } from "@/components/ui/button";
import { Input, SteppedValueSlider } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, ScrollArea } from "@/components/ui/radix";

interface DwellingCatalogEntry {
  id: string;
  title: string;
  faction: string;
  tier: number;
  sid: string;
  image: string;
  factionImage?: string;
}

const assetRoot = "/assets/olden-era";
const factionIcons: Record<string, string | undefined> = {
  Human: `${assetRoot}/factions/temple-icon.png`,
  Nature: `${assetRoot}/factions/grove-icon.png`,
  Dungeon: `${assetRoot}/factions/dungeon-icon.png`,
  Necropolis: `${assetRoot}/factions/necropolis-icon.png`,
  Demon: undefined,
  Unfrozen: undefined,
  Neutral: undefined
};

const factionDwellingTitles: Record<string, string> = {
  Human: "Human Dwelling",
  Nature: "Nature Dwelling",
  Dungeon: "Dungeon Dwelling",
  Necropolis: "Necropolis Dwelling",
  Demon: "Demon Dwelling",
  Unfrozen: "Unfrozen Dwelling"
};

const neutralDwellings: Array<{ id: string, title: string, tier: number, imageName: string }> = [
  { id: "neutral-peasant", title: "Peasant Dwelling", tier: 1, imageName: "barracks-neutral-peasant.png" },
  { id: "neutral-halfling", title: "Halfling Dwelling", tier: 2, imageName: "barracks-neutral-halfling.png" },
  { id: "neutral-kitten-horn", title: "Kittenhorn Dwelling", tier: 3, imageName: "barracks-neutral-kitten-horn.png" },
  { id: "neutral-coatle", title: "Couatl Dwelling", tier: 4, imageName: "barracks-neutral-coatle.png" },
  { id: "neutral-giant-frog", title: "Giant Frog Dwelling", tier: 5, imageName: "barracks-neutral-giand-frog.png" },
  { id: "neutral-world-watcher", title: "World Watcher Dwelling", tier: 6, imageName: "barracks-neutral-world-watcher.png" },
  { id: "neutral-fairy-dragon", title: "Faerie Dragon Dwelling", tier: 7, imageName: "barracks-neutral-fairy-dragon.png" },
  { id: "neutral-dragon-lich", title: "Dragon Lich Dwelling", tier: 7, imageName: "barracks-neutral-dragon-lich.png" }
];

export const DWELLING_CATALOG: DwellingCatalogEntry[] = [
  ...["Human", "Nature", "Dungeon", "Necropolis", "Demon", "Unfrozen"].flatMap((faction) => (
    Array.from({ length: 7 }, (_, index) => {
      const tier = index + 1;
      return {
        id: `${faction.toLowerCase()}-${tier}`,
        title: `${factionDwellingTitles[faction]} ${tier}`,
        faction,
        tier,
        sid: `random_hire_${tier}`,
        image: `${assetRoot}/map-objects/barracks-${faction.toLowerCase()}-${tier}.png`,
        factionImage: factionIcons[faction]
      };
    })
  )),
  ...neutralDwellings.map((dwelling) => ({
    id: dwelling.id,
    title: dwelling.title,
    faction: "Neutral",
    tier: dwelling.tier,
    sid: `random_hire_${dwelling.tier}`,
    image: `${assetRoot}/map-objects/${dwelling.imageName}`
  }))
];

export function DwellingSettingsDialog({
  open,
  onOpenChange,
  zone,
  onChange
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  zone: DesignZone;
  onChange(settings: DwellingSettings): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [factionFilter, setFactionFilter] = useState("All");
  const settings = normalizeDwellingSettings(zone.dwellingSettings, defaultDwellingSettingsForZone(zone, zone.dwellingCount));
  const selectedById = useMemo(() => new Map(settings.specific.map((entry) => [entry.id, entry])), [settings.specific]);
  const totalCount = dwellingCountFromSettings(settings);
  const factions = useMemo(() => ["All", ...Array.from(new Set(DWELLING_CATALOG.map((entry) => entry.faction)))], []);
  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return DWELLING_CATALOG.filter((entry) => {
      if (factionFilter !== "All" && entry.faction !== factionFilter) return false;
      if (!normalizedQuery) return true;
      return entry.title.toLowerCase().includes(normalizedQuery)
        || entry.faction.toLowerCase().includes(normalizedQuery)
        || entry.sid.toLowerCase().includes(normalizedQuery);
    });
  }, [factionFilter, query]);

  function commit(nextSettings: DwellingSettings): void {
    onChange(normalizeDwellingSettings(nextSettings, defaultDwellingSettingsForZone(zone, zone.dwellingCount)));
  }

  function setMode(mode: DwellingSettings["mode"]): void {
    if (settings.mode === mode) return;
    commit({
      mode,
      lowTierCount: settings.lowTierCount,
      highTierCount: settings.highTierCount,
      specific: settings.specific
    });
  }

  function updateGeneratedCount(field: "lowTierCount" | "highTierCount", value: number): void {
    const next = {
      ...settings,
      mode: "Generated" as const,
      [field]: value
    };
    if (next.lowTierCount + next.highTierCount > maxDwellingCount) {
      const otherField = field === "lowTierCount" ? "highTierCount" : "lowTierCount";
      next[otherField] = Math.max(0, maxDwellingCount - next[field]);
    }
    commit(next);
  }

  function setSpecificCount(entry: DwellingCatalogEntry, nextCount: number): void {
    const boundedCount = Math.max(0, Math.min(maxDwellingCount, Math.trunc(nextCount)));
    const withoutEntry = settings.specific.filter((item) => item.id !== entry.id);
    const otherCount = withoutEntry.reduce((sum, item) => sum + item.count, 0);
    const generatedCount = settings.lowTierCount + settings.highTierCount;
    const count = Math.min(boundedCount, maxDwellingCount - generatedCount - otherCount);
    const nextEntry: DwellingSpecificEntry = {
      id: entry.id,
      sid: entry.sid,
      count,
      title: entry.title,
      image: entry.image,
      faction: entry.faction,
      tier: entry.tier
    };
    commit({
      mode: "Specific",
      lowTierCount: settings.lowTierCount,
      highTierCount: settings.highTierCount,
      specific: count > 0 ? [...withoutEntry, nextEntry] : withoutEntry
    });
  }

  const previewItems = [
    settings.lowTierCount > 0 ? `${lowTierRandomHireList} x${settings.lowTierCount}` : undefined,
    settings.highTierCount > 0 ? `${highTierRandomHireList} x${settings.highTierCount}` : undefined,
    ...(settings.mode === "Specific" ? settings.specific.map((entry) => `${entry.sid} x${entry.count}`) : [])
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dwelling-settings-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Dwelling Settings</DialogTitle>
            <DialogDescription>Guaranteed random-hire dwellings for {zone.name}.</DialogDescription>
          </div>
          <div className="dwelling-settings-dialog__count">
            <Castle size={15} />{totalCount}
          </div>
        </div>

        <div className="dwelling-mode-tabs" role="tablist" aria-label="Dwelling settings mode">
          <button type="button" role="tab" aria-selected={settings.mode === "Generated"} onClick={() => setMode("Generated")}>
            <Settings2 size={14} />Generated Mix
          </button>
          <button type="button" role="tab" aria-selected={settings.mode === "Specific"} onClick={() => setMode("Specific")}>
            <Castle size={14} />Specific Dwellings
          </button>
        </div>

        {settings.mode === "Generated" ? (
          <div className="dwelling-generated-panel">
            <label>
              <span>Low-tier dwellings</span>
              <SteppedValueSlider min={0} max={maxDwellingCount} value={settings.lowTierCount} onChange={(event) => updateGeneratedCount("lowTierCount", Number(event.currentTarget.value))} defaultValue={zone.role === "Hub" ? 0 : 1} badgeColor="gold" />
            </label>
            <label>
              <span>High-tier dwellings</span>
              <SteppedValueSlider min={0} max={maxDwellingCount} value={settings.highTierCount} onChange={(event) => updateGeneratedCount("highTierCount", Number(event.currentTarget.value))} defaultValue={0} badgeColor="gold" />
            </label>
          </div>
        ) : (
          <>
            <div className="dwelling-toolbar">
              <label className="dwelling-search">
                <Search size={15} aria-hidden="true" />
                <Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search dwellings or IDs" aria-label="Search dwellings" />
              </label>
              <Button type="button" variant="ghost" disabled={settings.specific.length === 0} onClick={() => commit({ ...settings, specific: [] })}>
                <X size={14} />Clear
              </Button>
            </div>
            <div className="filter-chip-row" aria-label="Dwelling faction filter" style={{ marginTop: "10px", marginBottom: "10px" }}>
              {factions.map((faction) => (
                <button
                  key={faction}
                  type="button"
                  className="filter-chip"
                  aria-pressed={factionFilter === faction}
                  onClick={() => setFactionFilter(faction)}
                >
                  {factionIcons[faction] ? (
                    <img src={factionIcons[faction]} alt="" style={{ width: "14px", height: "14px", borderRadius: "2px", objectFit: "cover" }} />
                  ) : null}
                  <span>{faction}</span>
                </button>
              ))}
            </div>
            <div className="spell-ban-selected" aria-label="Selected dwellings" style={{ marginBottom: "12px" }}>
              {settings.specific.length === 0 ? <span>No specific dwellings selected.</span> : null}
              {settings.specific.map((entry) => {
                const catalogEntry = DWELLING_CATALOG.find((cat) => cat.id === entry.id);
                if (!catalogEntry) return null;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="spell-ban-chip"
                    onClick={() => setSpecificCount(catalogEntry, entry.count - 1)}
                    aria-label={`Remove ${catalogEntry.title}`}
                  >
                    <img src={catalogEntry.image} alt="" style={{ width: "14px", height: "14px", borderRadius: "2px", objectFit: "cover" }} />
                    <span>{catalogEntry.title} x{entry.count}</span>
                    <X size={12} />
                  </button>
                );
              })}
            </div>
            <ScrollArea className="dwelling-card-scroll">
              <div className="dwelling-card-grid">
                {filteredCatalog.map((entry) => {
                  const selectedCount = selectedById.get(entry.id)?.count ?? 0;
                  const canAdd = totalCount < maxDwellingCount;
                  return (
                    <div
                      key={entry.id}
                      className="dwelling-card"
                      data-selected={selectedCount > 0 ? "true" : undefined}
                      style={{ cursor: canAdd ? "pointer" : "default" }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest(".dwelling-card__controls")) {
                          return;
                        }
                        if (canAdd) {
                          setSpecificCount(entry, selectedCount + 1);
                        }
                      }}
                    >
                      <img src={entry.image} alt={`${entry.title} art`} />
                      <div className="dwelling-card__body">
                        <strong>{entry.title}</strong>
                        <span>{entry.faction} · Tier {entry.tier}</span>
                        <code>{entry.sid}</code>
                      </div>
                      <div className="dwelling-card__controls">
                        <button
                          type="button"
                          aria-label={`Remove ${entry.title}`}
                          disabled={selectedCount === 0}
                          onClick={() => setSpecificCount(entry, selectedCount - 1)}
                        >
                          <Minus size={13} />
                        </button>
                        <span>{selectedCount}</span>
                        <button
                          type="button"
                          aria-label={`Add ${entry.title}`}
                          disabled={totalCount >= maxDwellingCount && selectedCount === 0}
                          onClick={() => setSpecificCount(entry, selectedCount + 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <div className="dwelling-preview" aria-label="Dwelling export preview">
          {previewItems.length === 0 ? <span>No generated dwelling entries.</span> : null}
          {previewItems.map((item) => item ? <code key={item}>{item}</code> : null)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
