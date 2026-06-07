export type HeroFaction = "Temple" | "Grove" | "Dungeon" | "Hive" | "Necropolis" | "Schism";
export type ItemRarity = "Minor" | "Major" | "Relic" | "Treasure";

export interface HeroBanCatalogEntry {
  id: string;
  title: string;
  faction: HeroFaction;
  heroClass: string;
  image: string;
  factionImage: string;
}

export interface ItemBanCatalogEntry {
  id: string;
  title: string;
  rarity: ItemRarity;
  image: string;
  note: string;
}

const assetRoot = "/assets/olden-era";

const factionIconByFaction: Record<HeroFaction, string> = {
  Temple: `${assetRoot}/factions/temple-icon.png`,
  Grove: `${assetRoot}/factions/grove-icon.png`,
  Dungeon: `${assetRoot}/factions/dungeon-icon.png`,
  Hive: `${assetRoot}/factions/hive-icon.png`,
  Necropolis: `${assetRoot}/factions/necropolis-icon.png`,
  Schism: `${assetRoot}/factions/schism-icon.png`
};

export const HERO_BAN_CATALOG: HeroBanCatalogEntry[] = [
  createHero("adahn", "Adahn", "Temple", "Knight"),
  createHero("artorius-veritas", "Artorius Veritas", "Temple", "Cleric"),
  createHero("clarissa", "Clarissa", "Temple", "Grand Inquisitor"),
  createHero("aeliniel", "Aeliniel", "Grove", "Druid"),
  createHero("aunt-daliar", "Aunt Daliar", "Grove", "Warden"),
  createHero("echolily", "Echolily", "Grove", "Herald"),
  createHero("creta-daughter-of-navarr", "Creta, Daughter of Navarr", "Dungeon", "Warlock"),
  createHero("dhuvri", "Dhuvri", "Dungeon", "Overlord"),
  createHero("changeling-urgo", "Changeling Urgo", "Dungeon", "Riftspeaker"),
  createHero("aeos-the-exalted", "Aeos the Exalted", "Hive", "Broodmother"),
  createHero("anastasia-the-meek", "Anastasia the Meek", "Hive", "Progenitor"),
  createHero("blackhorn", "Blackhorn", "Hive", "Enforcer"),
  createHero("alluring-sha", "Alluring Sha", "Necropolis", "Necromancer"),
  createHero("bulwark", "Bulwark", "Necropolis", "Death Knight"),
  createHero("devir-son-of-devir", "Devir, Son of Devir", "Necropolis", "Soul Eater"),
  createHero("abigor-duke-of-battle", "Abigor, Duke of Battle", "Schism", "Lord of Chaos"),
  createHero("bathym-duke-of-jewels", "Bathym, Duke of Jewels", "Schism", "Ascendant"),
  createHero("curson-duke-of-rage", "Curson, Duke of Rage", "Schism", "Paragon")
];

export const ITEM_BAN_CATALOG: ItemBanCatalogEntry[] = [
  createItem("swamp_boots_artifact", "Swamp Boots", "Minor", "stinging-sword.png", "Early mobility denial"),
  createItem("wanderers_way_backpack_artifact", "Wanderer's Way Backpack", "Minor", "resource-chest.png", "Travel utility"),
  createItem("ambassadors_word_ambassadors_sash_artifact", "Ambassador's Sash", "Minor", "flattering-mirror.png", "Diplomacy utility"),
  createItem("magic_key_ring_artifact", "Magic Key Ring", "Major", "magic-wheel.png", "Spell-pathing control"),
  createItem("pole_star_artifact", "Pole Star", "Major", "wind-rose.png", "Map movement shaping"),
  createItem("seven_league_boots_artifact", "Seven League Boots", "Major", "quixs-path.png", "High-impact mobility"),
  createItem("wanderers_way_boots_of_travel_artifact", "Wanderer's Boots of Travel", "Relic", "dragonslayer-base.png", "Long-range tempo swing"),
  createItem("shackles_of_war_artifact", "Shackles of War", "Relic", "trial-scales.png", "Locks retreat options"),
  createItem("ambassadors_word_diplomatic_gifts_artifact", "Diplomatic Gifts", "Relic", "point-of-balance.png", "Matchup-skewing diplomacy"),
  createItem("voodoosh_doll_artifact", "Voodoosh Doll", "Treasure", "sacrificial-shrine.png", "Common competitive ban"),
  createItem("flag_of_truce_artifact", "Flag of Truce", "Treasure", "watchtower.png", "Common competitive ban")
];

export const ITEM_RARITY_ORDER: ItemRarity[] = ["Minor", "Major", "Relic", "Treasure"];

function createHero(
  slug: string,
  title: string,
  faction: HeroFaction,
  heroClass: string
): HeroBanCatalogEntry {
  return {
    id: slug.replaceAll("-", "_"),
    title,
    faction,
    heroClass,
    image: `${assetRoot}/heroes/${slug}.png`,
    factionImage: factionIconByFaction[faction]
  };
}

function createItem(
  id: string,
  title: string,
  rarity: ItemRarity,
  imageName: string,
  note: string
): ItemBanCatalogEntry {
  return {
    id,
    title,
    rarity,
    image: `${assetRoot}/map-objects/${imageName}`,
    note
  };
}
