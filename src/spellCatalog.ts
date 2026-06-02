export interface SpellBanCatalogEntry {
  id: string;
  title: string;
  image: string;
}

const knownNeutralSpells: SpellBanCatalogEntry[] = [
  {
    id: "neutral_magic_pocket_dimension",
    title: "Pocket Dimension",
    image: "/assets/olden-era/map-objects/pocket-dimension.png"
  },
  {
    id: "neutral_magic_light_gate",
    title: "Light Gate",
    image: "/assets/olden-era/spells/gate-of-light.png"
  },
  {
    id: "neutral_magic_town_portal",
    title: "Town Portal",
    image: "/assets/olden-era/spells/town-portal.png"
  },
  {
    id: "neutral_magic_dimension_door",
    title: "Dimension Door",
    image: "/assets/olden-era/spells/dimension-door.png"
  },
  {
    id: "neutral_magic_shadow_form",
    title: "Shadow Form",
    image: "/assets/olden-era/spells/shadowflight.png"
  }
];

const wikiSpellSlugs = [
  "anti-magic",
  "arinas-chosen",
  "arinas-touch",
  "armageddon",
  "assemble",
  "back-to-town",
  "berserk",
  "black-hole",
  "blessing",
  "blink",
  "carapace",
  "cave-in",
  "chain-lightning",
  "circle-of-winter",
  "clear-fog",
  "coup-de-grace",
  "crystal-crown",
  "despair",
  "dorearths-tide",
  "early-start",
  "earths-rage",
  "energize",
  "energy-explosion",
  "enlarge-shadow",
  "fatal-decay",
  "favorable-wind",
  "fireball",
  "firewall",
  "from-a-birds-eye",
  "groundsight",
  "guillotine",
  "haste",
  "healing-water",
  "heavenly-blades",
  "hksmillas-rampage",
  "ice-bolt",
  "impending-fate",
  "inner-light",
  "judgement",
  "lightning-bolt",
  "magic-arrow",
  "mana-rite",
  "mirror-copy",
  "nairas-kiss",
  "nairas-veil",
  "optical-illusion",
  "primordial-chaos",
  "radiant-armour",
  "read-minds",
  "reality-distortion",
  "reinforcements",
  "relocation",
  "rewind-life",
  "riposte",
  "second-wind",
  "shackles",
  "shade-cloak",
  "shadow-army",
  "shorten-shadow",
  "silence",
  "sleep",
  "song-of-power",
  "spacial-snare",
  "stone-fangs",
  "summon-avatar",
  "summon-primal-remnant",
  "summon-starchild",
  "taunt",
  "temporal-spheres",
  "thick-hide",
  "twilight",
  "umbral-grip",
  "unnatural-calm",
  "vengeance",
  "vulnerability",
  "weakening-ray",
  "wean",
  "web"
] as const;

const neutralImageSlugs = new Set(["dimension-door", "gate-of-light", "shadowflight", "town-portal"]);

export const SPELL_BAN_CATALOG: SpellBanCatalogEntry[] = [
  ...knownNeutralSpells,
  ...wikiSpellSlugs
    .filter((slug) => !neutralImageSlugs.has(slug))
    .map((slug) => ({
      id: slug.replaceAll("-", "_"),
      title: titleFromSlug(slug),
      image: `/assets/olden-era/spells/${slug}.png`
    }))
];

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ")
    .replace("Arinas", "Arina's")
    .replace("Dorearths", "Dorearth's")
    .replace("Hksmillas", "Hksmilla's")
    .replace("Nairas", "Naira's");
}
