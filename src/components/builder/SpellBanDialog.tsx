import { Ban, Plus, Search, X } from "lucide-react";
import { useMemo, useState, type JSX } from "react";
import { SPELL_BAN_CATALOG } from "@/spellCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, ScrollArea } from "@/components/ui/radix";
import { parseLineList } from "@/components/builder/formHelpers";

export function SpellBanDialog({
  open,
  onOpenChange,
  bannedSpellIds,
  onChange
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  bannedSpellIds: string[];
  onChange(ids: string[]): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Adventure" | "Combat">("All");

  const selectedIds = useMemo(() => new Set(bannedSpellIds), [bannedSpellIds]);
  const catalogById = useMemo(() => new Map(SPELL_BAN_CATALOG.map((spell) => [spell.id, spell])), []);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSpells = useMemo(() => {
    let list = SPELL_BAN_CATALOG;
    if (categoryFilter !== "All") {
      list = list.filter((spell) => getSpellCategory(spell.id) === categoryFilter);
    }
    if (!normalizedQuery) return list;
    return list.filter((spell) => (
      spell.title.toLowerCase().includes(normalizedQuery)
      || spell.id.toLowerCase().includes(normalizedQuery)
    ));
  }, [categoryFilter, normalizedQuery]);

  function commitIds(ids: string[]): void {
    onChange([...new Set(ids)]);
  }

  function toggleSpell(id: string): void {
    if (selectedIds.has(id)) {
      commitIds(bannedSpellIds.filter((spellId) => spellId !== id));
      return;
    }
    commitIds([...bannedSpellIds, id]);
  }

  function addCustomIds(): void {
    const ids = parseLineList(customDraft);
    if (ids.length === 0) return;
    commitIds([...bannedSpellIds, ...ids]);
    setCustomDraft("");
  }

  const selectedCatalogSpells = bannedSpellIds.map((id) => catalogById.get(id)).filter(Boolean);
  const customIds = bannedSpellIds.filter((id) => !catalogById.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="spell-ban-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Ban Spells</DialogTitle>
            <DialogDescription>Wiki spell catalog, local spell art, and custom magic IDs.</DialogDescription>
          </div>
          <div className="spell-ban-dialog__count">
            <Ban size={15} />{bannedSpellIds.length}
          </div>
        </div>
        <div className="spell-ban-toolbar">
          <label className="spell-ban-search">
            <Search size={15} aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search spells or IDs" aria-label="Search spells" />
          </label>
          <Button type="button" variant="ghost" disabled={bannedSpellIds.length === 0} onClick={() => commitIds([])}>
            <X size={14} />Clear
          </Button>
        </div>
        <div className="filter-chip-row" aria-label="Spell category filter">
          {(["All", "Adventure", "Combat"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className="filter-chip"
              aria-pressed={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            >
              <span>{cat}</span>
            </button>
          ))}
        </div>
        <div className="spell-ban-custom">
          <Input
            value={customDraft}
            onChange={(event) => setCustomDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomIds();
              }
            }}
            placeholder="custom_magic_id"
            aria-label="Custom spell ban ID"
          />
          <Button type="button" variant="blue" onClick={addCustomIds}><Plus size={14} />Add ID</Button>
        </div>
        <div className="spell-ban-selected" aria-label="Selected banned spells">
          {bannedSpellIds.length === 0 ? <span>No spell bans selected.</span> : null}
          {selectedCatalogSpells.map((spell) => spell ? (
            <button key={spell.id} type="button" className="spell-ban-chip" onClick={() => toggleSpell(spell.id)} aria-label={`Remove ${spell.title}`}>
              <img src={spell.image} alt="" />
              <span>{spell.title}</span>
              <X size={12} />
            </button>
          ) : null)}
          {customIds.map((id) => (
            <button key={id} type="button" className="spell-ban-chip spell-ban-chip--custom" onClick={() => toggleSpell(id)} aria-label={`Remove ${id}`}>
              <span>{id}</span>
              <X size={12} />
            </button>
          ))}
        </div>
        <ScrollArea className="spell-ban-scroll">
          <div className="spell-ban-grid">
            {filteredSpells.map((spell) => {
              const selected = selectedIds.has(spell.id);
              return (
                <button
                  key={spell.id}
                  type="button"
                  className="spell-ban-card"
                  aria-pressed={selected}
                  aria-label={selected ? `Unban ${spell.title}` : `Ban ${spell.title}`}
                  data-selected={selected ? "true" : undefined}
                  onClick={() => toggleSpell(spell.id)}
                >
                  <img src={spell.image} alt={`${spell.title} icon`} />
                  <span className="spell-ban-card__body">
                    <strong>{spell.title}</strong>
                    <code>{spell.id}</code>
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function getSpellCategory(id: string): "Adventure" | "Combat" {
  if (
    id.startsWith("neutral_magic_") ||
    [
      "back_to_town",
      "dimension_door",
      "gate_of_light",
      "town_portal",
      "shadow_form",
      "pocket_dimension",
      "groundsight",
      "read_minds",
      "relocation",
      "clear_fog"
    ].includes(id)
  ) {
    return "Adventure";
  }
  return "Combat";
}
