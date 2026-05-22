import { centerLayoutName, sideLayoutName, spawnLayoutName, treasureLayoutName } from "./generator/math";

export interface ConfigSuggestion {
  label: string;
  value: string | number | boolean;
  description?: string;
}

export interface ConfigHelp {
  tooltip: string;
  detail?: string;
  suggestions?: ConfigSuggestion[];
}

const blankSuggestion: ConfigSuggestion = { label: "Blank", value: "", description: "Clear this field" };

const guardedT2 = [
  "classic_template_pool_random_t2_item",
  "classic_template_pool_random_t2_pandora",
  "classic_template_pool_random_t2_hire",
  "classic_template_pool_random_t2_unit_bank",
  "classic_template_pool_random_t2_res_bank",
  "classic_template_pool_random_t2_stat",
  "classic_template_pool_random_t2_magic"
];
const guardedT3 = guardedT2.map((name) => name.replace("_t2_", "_t3_"));
const guardedRich = [
  ...guardedT2.map((name) => name.replace("_t2_", "_t4_")),
  ...guardedT2.map((name) => name.replace("_t2_", "_t5_"))
];
const unguardedT2 = guardedT2.map((name) => name.replace("pool_random_", "pool_random_unguarded_"));
const unguardedT3 = unguardedT2.map((name) => name.replace("_t2_", "_t3_"));
const unguardedRich = [
  ...unguardedT2.map((name) => name.replace("_t2_", "_t4_")),
  ...unguardedT2.map((name) => name.replace("_t2_", "_t5_"))
];
const sideContentLimits = Array.from({ length: 5 }, (_, index) => {
  const first = index + 1;
  return Array.from({ length: 6 - first }, (_unused, offset) => `content_limits_side_${first}_${first + offset + 1}`);
}).flat();

function optionalSuggestions(...suggestions: ConfigSuggestion[]): ConfigSuggestion[] {
  return [blankSuggestion, ...suggestions];
}


export const configHelp: Record<string, ConfigHelp> = {
  "generation.preset": {
    tooltip: "Apply an opinionated identity bundle before any lower-level tuning.",
    detail: "These presets combine map shape, rule flags, and pressure settings to mimic broad reference families. You can still adjust the lower-level controls afterward, but specialized formats such as encounter-hole maps should be treated as generator-assisted starting points rather than guaranteed in-game replicas.",
    suggestions: [
      { label: "Single Hero", value: "SingleHero", description: "Locks the map into a start-hero format with hiring banned and a one-hero cap" },
      { label: "Blitz-Like", value: "BlitzLike", description: "Small, fast-contact layout with stricter guard pressure and lighter economy" },
      { label: "Jebus-Like Objective", value: "JebusLikeObjective", description: "Hub-centered city-hold contest with a jackpot-style middle" },
      { label: "Anarchy-Like", value: "AnarchyLike", description: "Chaotic shared-web format with encounter holes and volatile routes" }
    ]
  },
  "global.templateName": {
    tooltip: "The display name for your template and the default filename when exporting.",
    detail: "This is what players see in the map selection screen. Use a descriptive name like \"Two Player Duel\" or \"4P Ring of Fire\".",
    suggestions: [
      { label: "Duel", value: "Two Player Duel", description: "1v1 template with two spawn zones facing each other" },
      { label: "Ring", value: "Four Player Ring", description: "Four spawns arranged in a ring with shared neutral zones" },
      { label: "City Hold", value: "City Hold Contest", description: "Players race to capture and hold a central city" }
    ]
  },
  "global.gameMode": {
    tooltip: "Top-level game mode string written to the exported template.",
    detail: "Most current examples use Classic. Keep imported custom values if you need to preserve a template variant exactly, or switch it deliberately when testing a different mode.",
    suggestions: [
      { label: "Classic", value: "Classic", description: "Default mode used by the shipped example templates" },
      { label: "Single Hero", value: "SingleHero", description: "Reference-style mode used by specialized single-hero competitive templates" },
      { label: "Arena", value: "Arena", description: "Example custom value when experimenting with alternate top-level modes" },
      { label: "Tournament", value: "Tournament", description: "Useful when preserving a hand-authored competitive template mode string" }
    ]
  },
  "global.playerCount": {
    tooltip: "The exact number of players and player start zones in the template.",
    detail: "Changing this adds or removes spawn zones and keeps player assignments to one spawn per player."
  },
  "global.mapWidth": {
    tooltip: "Horizontal map size in game tiles.",
    detail: "Smaller maps (120) create tight, fast-paced games. Larger maps (240) suit 4+ players with room for exploration. Official templates cap at 240.",
    suggestions: [
      { label: "Small", value: 120, description: "120 tiles — tight maps for fast 1v1 games" },
      { label: "Standard", value: 160, description: "160 tiles — balanced size for most player counts" },
      { label: "Large", value: 240, description: "240 tiles — spacious maps for 4+ players or exploration-heavy games" }
    ]
  },
  "global.mapHeight": {
    tooltip: "Vertical map size in game tiles.",
    detail: "Keep equal to width for standard square maps. Rectangular maps (e.g. 240×120) are experimental and may cause layout issues.",
    suggestions: [
      { label: "Small", value: 120, description: "120 tiles — tight maps for fast 1v1 games" },
      { label: "Standard", value: 160, description: "160 tiles — balanced size for most player counts" },
      { label: "Large", value: 240, description: "240 tiles — spacious maps for 4+ players or exploration-heavy games" }
    ]
  },
  "global.heroCountMin": {
    tooltip: "Starting hero cap before castle bonuses.",
    detail: "This is how many heroes a player can have at game start. Castles can raise this limit further (see Hero Count Increment). Example: set to 3 for fast games, or 5 for multi-front play.",
    suggestions: [
      { label: "Fast", value: 3, description: "3 heroes — constrains early expansion for faster games" },
      { label: "Default", value: 4, description: "4 heroes — standard starting cap used in most templates" },
      { label: "Long", value: 5, description: "5 heroes — allows more scouting and multi-front play from the start" }
    ]
  },
  "global.heroCountMax": {
    tooltip: "The absolute maximum number of heroes a player can have.",
    detail: "This is the hard ceiling no matter how many castles you own. A lower cap (6) keeps armies focused; a higher cap (12) enables epic late-game with many armies on the map.",
    suggestions: [
      { label: "Tight", value: 6, description: "6 heroes max — keeps late-game army count low and focused" },
      { label: "Default", value: 8, description: "8 heroes max — standard ceiling for balanced games" },
      { label: "Epic", value: 12, description: "12 heroes max — enables large-scale late-game with many armies" }
    ]
  },
  "global.heroCountIncrement": {
    tooltip: "Extra hero cap gained per castle owned.",
    detail: "Each castle a player owns raises their hero limit by this amount. Set to 0 for a fixed cap, or 2 for strong snowball where capturing cities quickly translates to more armies.",
    suggestions: [
      { label: "None", value: 0, description: "No bonus — hero cap stays fixed regardless of castles owned" },
      { label: "Default", value: 1, description: "+1 per castle — rewards expansion with gradual army growth" },
      { label: "Castle-heavy", value: 2, description: "+2 per castle — strong snowball from capturing cities" }
    ]
  },
  "global.terrainTheme": {
    tooltip: "Default biome strategy for zones without explicit overrides.",
    detail: "\"Faction Matched\" makes each zone's terrain match its city's faction (e.g. Necropolis gets Deathland). \"Mixed\" adds visual variety. Individual zones can still override this.",
    suggestions: [
      { label: "Faction", value: "FactionMatched", description: "Each zone's terrain matches the faction of its main city" },
      { label: "Mixed", value: "Mixed", description: "Zones get a mix of terrain types for visual variety" },
      { label: "Random", value: "Random", description: "Terrain is randomized per zone with no faction correlation" }
    ]
  },
  "global.victoryCondition": {
    tooltip: "How a player wins the game.",
    detail: "\"Classic\" = defeat all opponents. \"City Hold\" = capture and hold a specific city for X days. \"Tournament\" enables competitive restrictions. Most casual templates use Classic.",
    suggestions: [
      { label: "Classic", value: "win_condition_1", description: "Standard victory — defeat all opponents to win" },
      { label: "City Hold", value: "win_condition_5", description: "Hold a designated city for a set number of days" },
      { label: "Tournament", value: "win_condition_6", description: "Competitive ruleset with tournament-specific restrictions" }
    ]
  },
  "global.cityHoldDays": {
    tooltip: "Days a city must be held to win in City Hold mode.",
    detail: "Only relevant when City Hold victory is enabled. 3 days forces aggressive defense, while 10 days demands sustained map control. The standard is 6 days.",
    suggestions: [
      { label: "Short", value: 3, description: "3 days — aggressive games where the hold city must be defended quickly" },
      { label: "Default", value: 6, description: "6 days — gives opponents time to mount a counter-attack" },
      { label: "Long", value: 10, description: "10 days — extended hold period demanding sustained map control" }
    ]
  },
  "global.factionLawsExpPercent": {
    tooltip: "XP percentage applied to Faction Laws rewards.",
    detail: "100% keeps the default pacing. Lower values slow law-based progression, while higher values make Faction Laws more influential across the map.",
    suggestions: [
      { label: "Low", value: 75, description: "75% — softer faction-law progression" },
      { label: "Default", value: 100, description: "100% — baseline rule pacing" },
      { label: "High", value: 125, description: "125% — faster faction-law progression" }
    ]
  },
  "global.astrologyExpPercent": {
    tooltip: "XP percentage applied to Astrology rewards.",
    detail: "100% keeps astrology at normal strength. Lower values reduce its impact, while higher values make astrology-related progression arrive sooner.",
    suggestions: [
      { label: "Low", value: 75, description: "75% — gentler astrology progression" },
      { label: "Default", value: 100, description: "100% — standard astrology pacing" },
      { label: "High", value: 125, description: "125% — stronger astrology progression" }
    ]
  },
  "global.movementBonus": {
    tooltip: "Global hero movement bonus written through gameRules.bonuses.",
    detail: "The builder emits this as the movementBonus parameter in the global bonuses array. Keep 0 to preserve current template pacing, or raise it to accelerate large-map movement.",
    suggestions: [
      { label: "Default", value: 0, description: "0 — preserve current generator output" },
      { label: "Moderate", value: 5, description: "5 — noticeable global movement boost" },
      { label: "High", value: 10, description: "10 — fast global movement pacing" }
    ]
  },
  "global.lostStartCityDay": {
    tooltip: "Grace period before a player loses after their starting city falls.",
    detail: "Short values make capture-town pressure immediate. Higher values create more comeback room after an early breach.",
    suggestions: [
      { label: "Sudden", value: 1, description: "1 day — almost immediate elimination pressure" },
      { label: "Default", value: 3, description: "3 days — standard grace period" },
      { label: "Forgiving", value: 7, description: "7 days — allows broader recovery windows" }
    ]
  },
  "global.lostStartCity": {
    tooltip: "Eliminate a player when they lose their starting city.",
    detail: "Adds a sudden-death element: if an opponent captures your starting city, you're out. Great for aggressive templates where early defense matters.",
    suggestions: [
      { label: "Off", value: false, description: "Losing your starting city does not eliminate you" },
      { label: "On", value: true, description: "Losing your starting city immediately eliminates you" }
    ]
  },
  "global.lostStartHero": {
    tooltip: "Eliminate a player when their starting hero dies.",
    detail: "Adds high stakes to your main hero: losing them means losing the game. Creates a tense dynamic where protecting your starter is critical.",
    suggestions: [
      { label: "Off", value: false, description: "Losing your starting hero does not eliminate you" },
      { label: "On", value: true, description: "Losing your starting hero immediately eliminates you" }
    ]
  },
  "global.heroHireBan": {
    tooltip: "Prevent players from hiring extra heroes beyond their starting roster and cap rules.",
    detail: "This writes the dedicated gameRules.heroHireBan flag. Useful for scenario-like or tightly competitive templates where hero chaining should be restricted.",
    suggestions: [
      { label: "Off", value: false, description: "false — preserve current generator behavior" },
      { label: "On", value: true, description: "true — disable extra hero hiring" }
    ]
  },
  "global.encounterHoles": {
    tooltip: "Enable the global encounter-holes rule without editing raw JSON.",
    detail: "This controls the top-level gameRules.encounterHoles toggle. Use each zone's Rules tab for per-zone encounter-hole counts.",
    suggestions: [
      { label: "Off", value: false, description: "false — preserve current generator behavior" },
      { label: "On", value: true, description: "true — enable the global encounter-holes toggle" }
    ]
  },
  "global.orientation.zeroAngleZone": {
    tooltip: "Zone name used as the orientation anchor for the generated variant.",
    detail: "Leave this as the first zone for the current manual-builder default, or use an imported zone name when preserving a hand-authored template."
  },
  "global.orientation.baseAngleMin": {
    tooltip: "Minimum base rotation angle for this map variant.",
    detail: "The manual-builder default is 45, matching current exports."
  },
  "global.orientation.baseAngleMax": {
    tooltip: "Maximum base rotation angle for this map variant.",
    detail: "The manual-builder default is 45, matching current exports."
  },
  "global.orientation.randomAngleAmplitude": {
    tooltip: "How much random rotation can be applied around the base angle.",
    detail: "Use 0 for predictable manual layouts. Imported generated templates may use 360.",
    suggestions: [
      { label: "Fixed", value: 0, description: "0 — preserve the current manual-builder output" },
      { label: "Full", value: 360, description: "360 — allow full rotation variance" }
    ]
  },
  "global.orientation.randomAngleStep": {
    tooltip: "Step size for random rotation choices.",
    detail: "Use 0 with fixed orientation, or a divisor of 360 for generated-style rotations."
  },
  "global.border.cornerRadius": {
    tooltip: "Corner rounding for the generated map border.",
    detail: "0 preserves the current square-corner manual-builder output."
  },
  "global.border.obstaclesWidth": {
    tooltip: "Width of the obstacle band around the map edge.",
    detail: "The current default is 3. Higher values create a thicker impassable edge."
  },
  "global.border.obstaclesNoise": {
    tooltip: "JSON noise array for obstacle border variation.",
    detail: "Use an array of objects with numeric amp and freq fields, for example [{\"amp\":1,\"freq\":12}]."
  },
  "global.border.waterWidth": {
    tooltip: "Width of the water band around the map edge.",
    detail: "0 preserves the current manual-builder output. Higher values add a visible water border."
  },
  "global.border.waterNoise": {
    tooltip: "JSON noise array for water border variation.",
    detail: "Use an array of objects with numeric amp and freq fields, for example [{\"amp\":1,\"freq\":12}]."
  },
  "global.border.waterType": {
    tooltip: "Water terrain type written to the map border settings.",
    detail: "The current default is \"water grass\".",
    suggestions: [
      { label: "Default", value: "water grass", description: "Preserve the current manual-builder output" }
    ]
  },
  "global.gladiatorArenaRules.daysDelayStart": {
    tooltip: "How many days pass before Gladiator Arena battles begin.",
    detail: "Use shorter delays for aggressive duel templates and longer delays when players need more time to build toward their champion fight.",
    suggestions: [
      { label: "Fast", value: 14, description: "14 days — arena battles begin early" },
      { label: "Default", value: 30, description: "30 days — current builder default" },
      { label: "Late", value: 45, description: "45 days — gives more setup time before arena battles" }
    ]
  },
  "global.gladiatorArenaRules.countDay": {
    tooltip: "How often Gladiator Arena battle days are counted.",
    detail: "Smaller values make arena pressure arrive more frequently. Larger values spread the arena cadence out.",
    suggestions: [
      { label: "Frequent", value: 2, description: "2 days — tight arena cadence" },
      { label: "Default", value: 3, description: "3 days — current builder default" },
      { label: "Sparse", value: 5, description: "5 days — slower arena cadence" }
    ]
  },
  "global.tournamentRules.firstTournamentDay": {
    tooltip: "First day on which the opening tournament battle happens.",
    detail: "This sets how long players get before the first announced tournament round resolves.",
    suggestions: [
      { label: "Fast", value: 7, description: "7 days — rapid competitive schedule" },
      { label: "Default", value: 14, description: "14 days — current builder default" },
      { label: "Slow", value: 21, description: "21 days — more buildup before round one" }
    ]
  },
  "global.tournamentRules.interval": {
    tooltip: "Days between later tournament rounds.",
    detail: "Use lower intervals to keep tournament pressure constant, or higher intervals to leave larger recovery windows between rounds.",
    suggestions: [
      { label: "Tight", value: 4, description: "4 days — fast repeat rounds" },
      { label: "Default", value: 7, description: "7 days — current builder default" },
      { label: "Wide", value: 10, description: "10 days — more breathing room between rounds" }
    ]
  },
  "global.tournamentRules.pointsToWin": {
    tooltip: "How many wins are needed to finish the tournament.",
    detail: "Lower values resolve quickly. Higher values create longer best-of style tournament sequences.",
    suggestions: [
      { label: "Short", value: 1, description: "1 point — single deciding round" },
      { label: "Default", value: 2, description: "2 points — current builder default" },
      { label: "Long", value: 3, description: "3 points — extended series" }
    ]
  },
  "global.matchAdjacentNeutralCastleFactions": {
    tooltip: "Make neutral cities near a player match that player's faction.",
    detail: "If a neutral zone connects to exactly one player, its city will be the same faction as that player's start. This makes nearby neutral cities more useful to capture early.",
    suggestions: [
      { label: "Off", value: false, description: "Neutral castles choose from the default neutral faction list" },
      { label: "On", value: true, description: "Single-player adjacent neutral castles match the adjacent player's faction" }
    ]
  },
  "global.neutralCastlesAsRuins": {
    tooltip: "Place neutral-zone castles as rebuildable ruins.",
    detail: "Neutral zones still reserve the same castle slots and roads, but their city objects become ruins with an open faction list. City Hold targets remain cities.",
    suggestions: [
      { label: "Off", value: false, description: "Neutral castle slots generate as cities" },
      { label: "On", value: true, description: "Neutral castle slots generate as ruins with player-chosen factions" }
    ]
  },
  "zone.name": {
    tooltip: "A unique identifier for this zone in the template.",
    detail: "Used by connections and content rules to reference this zone. Convention: \"Spawn-1\" for player starts, \"Neutral-3\" for contested areas, \"Hub\" for central zones.",
    suggestions: [
      { label: "Spawn", value: "Spawn-1", description: "Naming convention for player starting zones (Spawn-1, Spawn-2, ...)" },
      { label: "Neutral", value: "Neutral-3", description: "Naming convention for contested neutral zones" },
      { label: "Hub", value: "Hub", description: "Central zone connecting multiple paths" }
    ]
  },
  "zone.role": {
    tooltip: "Determines what the zone generates — cities, heroes, and content profiles.",
    detail: "\"Spawn\" places a city and starting hero for a player. \"Neutral\" generates unowned content with guards. \"Hub\" is a connecting zone, typically central with high-value rewards.",
    suggestions: [
      { label: "Spawn", value: "Spawn", description: "Player starting zone — generates a city and starting hero" },
      { label: "Neutral", value: "Neutral", description: "Unowned zone with content and guards to fight over" },
      { label: "Hub", value: "Hub", description: "Central connecting zone, typically with high-value content" }
    ]
  },
  "zone.player": {
    tooltip: "Which player owns this spawn zone.",
    detail: "Only applies to Spawn zones. Each player number (1–8) should appear exactly once. Neutral and Hub zones don't have an owner.",
    suggestions: [
      { label: "P1", value: 1, description: "Assign to Player 1" },
      { label: "P2", value: 2, description: "Assign to Player 2" },
      { label: "P4", value: 4, description: "Assign to Player 4 (for 4-player templates)" }
    ]
  },
  "zone.quality": {
    tooltip: "Preset difficulty profile for neutral zones.",
    detail: "Changing this resets the zone's content pools, guard strength, biome, and layout to match the chosen profile. Example: \"Low\" for buffer zones near spawns, \"High\" for late-game treasure areas.",
    suggestions: [
      { label: "Low", value: "Low", description: "Weak guards and sparse rewards — early-game buffer zones" },
      { label: "Medium", value: "Medium", description: "Moderate guards and rewards — mid-game contested areas" },
      { label: "High", value: "High", description: "Strong guards and rich rewards — late-game objectives" }
    ]
  },
  "zone.castleCount": {
    tooltip: "How many cities to place in this zone.",
    detail: "Spawn zones need at least 1 city. City Hold target zones also need one. Set to 0 for pure terrain/content zones with no city.",
    suggestions: [
      { label: "None", value: 0, description: "No city — zone has content and terrain only" },
      { label: "Default", value: 1, description: "One city — standard for spawn and hold-city zones" },
      { label: "Double", value: 2, description: "Two cities — extra city for large zones or special layouts" }
    ]
  },
  "zone.terrainTheme": {
    tooltip: "Terrain biome for this specific zone.",
    detail: "Overrides the global terrain theme. \"Faction Matched\" uses the zone's city faction. Or force a specific biome like Grass, Snow, Sand, Lava, or Deathland.",
    suggestions: [
      { label: "Faction", value: "FactionMatched", description: "Terrain matches the faction of this zone's main city" },
      { label: "Grass", value: "Grass", description: "Force grassland terrain for this zone" },
      { label: "Snow", value: "Snow", description: "Force snow terrain for this zone" }
    ]
  },
  "zone.layout": {
    tooltip: "Controls the physical layout of obstacles, lakes, roads, and pickups.",
    detail: "\"Spawn\" = open with clear paths from city. \"Treasure\" = dense obstacles funneling toward guarded rewards. \"Center\" = symmetric for hub zones. \"Side\" = elongated for edge zones.",
    suggestions: [
      { label: "Spawn", value: spawnLayoutName, description: "Open layout with clear paths from the starting city" },
      { label: "Side", value: sideLayoutName, description: "Elongated layout suited for zones along map edges" },
      { label: "Treasure", value: treasureLayoutName, description: "Dense layout with obstacles funneling toward guarded rewards" },
      { label: "Center", value: centerLayoutName, description: "Symmetric layout designed for central hub zones" }
    ]
  },
  "zone.crossroadsPosition": {
    tooltip: "Where the crossroads anchor point sits within the zone (0–1).",
    detail: "0 places the crossroads at the zone edge near connections (most common). 0.5 centers it. 1 pushes it to the far interior.",
    suggestions: [
      { label: "Outer", value: 0, description: "0 — crossroads at the zone edge, close to connections" },
      { label: "Mid", value: 0.5, description: "0.5 — crossroads centered within the zone" },
      { label: "Far", value: 1, description: "1 — crossroads at the far interior of the zone" }
    ]
  },
  "zone.size": {
    tooltip: "Area multiplier that scales this zone's footprint.",
    detail: "Larger values (1.6x) give more room for content and roads — good for hubs. Smaller values (0.75x) create tighter zones with less open space.",
    suggestions: [
      { label: "Compact", value: 0.75, description: "0.75x — tighter zone with less open space between content" },
      { label: "Default", value: 1, description: "1x — standard zone size" },
      { label: "Large", value: 1.6, description: "1.6x — spacious zone for hub areas or high content counts" }
    ]
  },
  "zone.zoneBiome": {
    tooltip: "Advanced JSON biome selector for terrain painting.",
    detail: "Leave blank to use the terrain dropdown above. For custom behavior, use JSON like {\"type\": \"MatchMainObject\"} to match the city's faction or {\"type\": \"FromList\", \"args\": [\"Grass\", \"Snow\"]} to randomly pick.",
    suggestions: optionalSuggestions(
      { label: "Match city", value: '{\n  "type": "MatchMainObject",\n  "args": ["0"]\n}', description: "Terrain biome matches this zone's main city faction" },
      { label: "Match zone", value: '{\n  "type": "MatchZone",\n  "args": []\n}', description: "Terrain biome matches the zone's terrain theme setting" },
      { label: "Grass/Snow", value: '{\n  "type": "FromList",\n  "args": ["Grass", "Snow"]\n}', description: "Randomly pick either Grass or Snow biome" }
    )
  },
  "zone.contentBiome": {
    tooltip: "Advanced JSON biome selector for content placement visuals.",
    detail: "Controls which biome textures appear around placed content objects. Leave blank to inherit from zone terrain. Same JSON format as Zone Biome.",
    suggestions: optionalSuggestions(
      { label: "Match city", value: '{\n  "type": "MatchMainObject",\n  "args": ["0"]\n}', description: "Content visuals match this zone's main city faction" },
      { label: "Match zone", value: '{\n  "type": "MatchZone",\n  "args": []\n}', description: "Content visuals match the zone's terrain theme setting" },
      { label: "Sand/Lava", value: '{\n  "type": "FromList",\n  "args": ["Sand", "Lava"]\n}', description: "Randomly pick either Sand or Lava biome for content" }
    )
  },
  "zone.metaObjectsBiome": {
    tooltip: "Advanced JSON biome selector for meta objects like roads.",
    detail: "Controls biome textures for roads and placement helpers. Leave blank to inherit defaults. Same JSON format as Zone Biome.",
    suggestions: optionalSuggestions(
      { label: "Match city", value: '{\n  "type": "MatchMainObject",\n  "args": ["0"]\n}', description: "Meta objects match this zone's main city faction" },
      { label: "Match zone", value: '{\n  "type": "MatchZone",\n  "args": []\n}', description: "Meta objects match the zone's terrain theme setting" },
      { label: "Deathland", value: '{\n  "type": "FromList",\n  "args": ["Deathland"]\n}', description: "Force Deathland biome for roads and meta objects" }
    )
  },
  "zone.resourceDensityPercent": {
    tooltip: "Scales how many resource pickups appear in this zone.",
    detail: "100% is standard. Lower values (75%) create resource-scarce zones that force players to fight. Higher values (150%) are good for spawn zones where early income matters.",
    suggestions: [
      { label: "Sparse", value: 75, description: "75% — fewer resources, suitable for buffer or contested zones" },
      { label: "Default", value: 100, description: "100% — standard resource density" },
      { label: "Rich", value: 150, description: "150% — abundant resources, good for spawn zones" }
    ]
  },
  "zone.structureDensityPercent": {
    tooltip: "Scales how many buildings and structures appear in this zone.",
    detail: "100% is standard. Lower values create more open terrain. Higher values (140%) fill the zone with structures — good for treasure zones players must explore thoroughly.",
    suggestions: [
      { label: "Sparse", value: 75, description: "75% — fewer structures, more open terrain" },
      { label: "Default", value: 100, description: "100% — standard structure density" },
      { label: "Rich", value: 140, description: "140% — dense structures, good for treasure zones" }
    ]
  },
  "zone.guardedContentValue": {
    tooltip: "Total budget for guarded structures before map-size scaling.",
    detail: "This controls how much guarded content (banks, pandoras, stat boosters, etc.) is placed. Example: 120k for light side zones, 480k for major objectives packed with rewards.",
    suggestions: [
      { label: "Low", value: 120000, description: "120k — light guarded content for side zones or early-game areas" },
      { label: "Medium", value: 240000, description: "240k — standard guarded content for neutral zones" },
      { label: "High", value: 480000, description: "480k — heavy guarded content for high-value objectives" }
    ]
  },
  "zone.guardedContentValuePerArea": {
    tooltip: "Density of guarded content — budget per unit of zone area.",
    detail: "Higher values pack more guarded encounters into available space. 1000/area = spread out, 3000/area = tightly packed. Works together with the total budget above.",
    suggestions: [
      { label: "Low", value: 1000, description: "1000/area — spread out guarded encounters" },
      { label: "Medium", value: 2000, description: "2000/area — balanced density for most zones" },
      { label: "High", value: 3000, description: "3000/area — tightly packed guarded encounters" }
    ]
  },
  "zone.unguardedContentValue": {
    tooltip: "Total budget for free (unguarded) pickups before map-size scaling.",
    detail: "These are rewards players can grab without fighting. Low values (25k) force combat; high values (80k) give generous freebies, good for spawn zones.",
    suggestions: [
      { label: "Low", value: 25000, description: "25k — minimal free pickups, forces players to fight guards" },
      { label: "Default", value: 50000, description: "50k — standard free pickup budget" },
      { label: "High", value: 80000, description: "80k — generous free pickups for spawn or exploration zones" }
    ]
  },
  "zone.unguardedContentValuePerArea": {
    tooltip: "Density of free pickups — budget per unit of zone area.",
    detail: "Keep lower than guarded density so players are incentivized to fight guards rather than just collect free items.",
    suggestions: [
      { label: "Low", value: 200, description: "200/area — scattered free pickups" },
      { label: "Default", value: 400, description: "400/area — standard free pickup density" },
      { label: "High", value: 620, description: "620/area — dense free pickups near starting areas" }
    ]
  },
  "zone.resourcesValue": {
    tooltip: "Total budget for resource pickups and mines before map-size scaling.",
    detail: "Controls the zone's economic value. 30k for resource-poor zones that force early aggression; 90k for rich zones with diverse mines and strong income.",
    suggestions: [
      { label: "Poor", value: 30000, description: "30k — low resource income, forces early aggression" },
      { label: "Medium", value: 55000, description: "55k — balanced resource income for neutral zones" },
      { label: "Rich", value: 90000, description: "90k — high resource income for spawn or key economy zones" }
    ]
  },
  "zone.resourcesValuePerArea": {
    tooltip: "Density of resource content — budget per unit of zone area.",
    detail: "Higher values place more mines and resource piles per area. Use 240/area for sparse zones or 600/area for packed economy zones.",
    suggestions: [
      { label: "Poor", value: 240, description: "240/area — sparse resource spots" },
      { label: "Medium", value: 420, description: "420/area — standard resource density" },
      { label: "Rich", value: 600, description: "600/area — packed resource spots for economy zones" }
    ]
  },
  "zone.guardedContentPool": {
    tooltip: "Content pool IDs used when generating guarded encounters.",
    detail: "One pool ID per line. Pools define what rewards can appear behind guards — items, pandora boxes, hire locations, banks, stat boosters, and magic shrines. Higher tiers (T4/T5) give more powerful rewards.",
    suggestions: [
      { label: "T2", value: guardedT2.join("\n"), description: "Tier 2 pools — items, pandoras, hires, banks, stats, magic for early-game zones" },
      { label: "T3", value: guardedT3.join("\n"), description: "Tier 3 pools — same categories at mid-game power level" },
      { label: "T4/T5", value: guardedRich.join("\n"), description: "Tier 4+5 pools — powerful late-game content for high-value zones" }
    ]
  },
  "zone.unguardedContentPool": {
    tooltip: "Content pool IDs used for free (unguarded) pickups.",
    detail: "One pool ID per line. Similar to guarded pools but these rewards have no guards. Use lower tiers near spawns and higher tiers in dangerous zones.",
    suggestions: [
      { label: "T2", value: unguardedT2.join("\n"), description: "Tier 2 unguarded — free pickups at early-game power level" },
      { label: "T3", value: unguardedT3.join("\n"), description: "Tier 3 unguarded — free pickups at mid-game power level" },
      { label: "T4/T5", value: unguardedRich.join("\n"), description: "Tier 4+5 unguarded — powerful free pickups for rich zones" }
    ]
  },
  "zone.resourcesContentPool": {
    tooltip: "Content pool ID controlling which mines and resources appear.",
    detail: "\"Poor\" = basic mines and limited gold. \"Medium\" = standard mine variety. \"Rich\" = diverse mines and strong income generation.",
    suggestions: [
      { label: "Poor", value: "content_pool_general_resources_start_zone_poor", description: "Low-tier resource pool — basic mines and limited gold" },
      { label: "Medium", value: "content_pool_general_resources_start_zone_medium", description: "Mid-tier resource pool — standard mine variety" },
      { label: "Rich", value: "content_pool_general_resources_start_zone_rich", description: "High-tier resource pool — diverse mines and strong income" }
    ]
  },
  "zone.contentCountLimits": {
    tooltip: "Preset rules that prevent too many objects from appearing in this zone.",
    detail: "These built-in presets keep neutral areas from being overfilled with rewards, buildings, and pickups. Most templates can leave this alone unless a zone should use the same object-count rules as a specific player border.",
    suggestions: [
      { label: "Standard Neutral", value: "content_limits_side", description: "Default object-count preset for a neutral area" },
      { label: "Between P1 and P2", value: "content_limits_side_1_2", description: "Use the preset for the neutral area between Player 1 and Player 2" },
      { label: "Every Player Border", value: sideContentLimits.join("\n"), description: "Add every player-to-player neutral area preset" }
    ]
  },
  "zone.neutralStackStrengthPercent": {
    tooltip: "Scales how tough neutral guards are in this zone.",
    detail: "100% is baseline. 75% makes guards easier (good near spawns for early clearing). 150% creates dangerous zones requiring larger armies.",
    suggestions: [
      { label: "Soft", value: 75, description: "75% — weaker guards, easier to clear early" },
      { label: "Default", value: 100, description: "100% — standard guard strength" },
      { label: "Hard", value: 150, description: "150% — stronger guards requiring bigger armies" }
    ]
  },
  "zone.guardRandomizationPercent": {
    tooltip: "How much randomness is applied to guard strength.",
    detail: "Lower = more predictable and competitive (2% for tournaments). Higher = more variance and surprises (25% for casual play where unpredictable encounters add excitement).",
    suggestions: [
      { label: "Tight", value: 2, description: "2% — very consistent guards, minimal RNG for competitive play" },
      { label: "Default", value: 5, description: "5% — slight variation while staying predictable" },
      { label: "Swingy", value: 25, description: "25% — high guard variance, less predictable encounters" }
    ]
  },
  "zone.guardCutoffValue": {
    tooltip: "Rewards below this value may skip guard placement.",
    detail: "Low-value content under this threshold can appear unguarded. A higher cutoff (5000) leaves more content unguarded; a lower cutoff (1000) ensures almost everything has guards.",
    suggestions: [
      { label: "Low", value: 1000, description: "1000 — only the cheapest rewards skip guards" },
      { label: "Default", value: 2000, description: "2000 — standard cutoff, most content gets guards" },
      { label: "Strict", value: 5000, description: "5000 — generous cutoff, more content left unguarded" }
    ]
  },
  "zone.guardMultiplier": {
    tooltip: "Base multiplier applied to all guard strength in this zone.",
    detail: "1x is standard for spawn zones. 1.4x makes a moderately harder neutral zone. 1.8x creates tough late-game areas. Stacks with weekly increment growth.",
    suggestions: [
      { label: "Spawn", value: 1, description: "1x — base guard strength, typical for starting zones" },
      { label: "Medium", value: 1.4, description: "1.4x — moderately tougher guards for neutral zones" },
      { label: "High", value: 1.8, description: "1.8x — strong guards for late-game or high-value zones" }
    ]
  },
  "zone.guardWeeklyIncrement": {
    tooltip: "How much guards grow stronger each in-game week.",
    detail: "Guards get tougher over time by this percentage per week. 10% rewards early clearing; 35% punishes players who wait too long to explore.",
    suggestions: [
      { label: "Low", value: 0.1, description: "10% weekly growth — slow scaling, rewards early clearing" },
      { label: "Default", value: 0.2, description: "20% weekly growth — moderate pressure to clear on time" },
      { label: "High", value: 0.35, description: "35% weekly growth — guards ramp fast, punishes late exploration" }
    ]
  },
  "zone.diplomacyModifier": {
    tooltip: "Affects how hostile neutral creatures are to diplomacy attempts.",
    detail: "-1 = very hostile (hard to negotiate). 0 = baseline behavior. Negative values make it harder to recruit or bribe neutral stacks.",
    suggestions: [
      { label: "Hard", value: -1, description: "-1 — diplomacy penalty, neutrals are hostile and harder to negotiate with" },
      { label: "Default", value: -0.5, description: "-0.5 — slight diplomacy penalty, standard difficulty" },
      { label: "Neutral", value: 0, description: "0 — no modifier, neutrals have baseline diplomacy behavior" }
    ]
  },
  "zone.guardReactionDistribution": {
    tooltip: "Six comma-separated weights controlling guard aggression behavior.",
    detail: "The six values control reaction probabilities from passive to aggressive. Example: \"60, 20, 10, 10, 2, 0\" = mostly friendly (spawn zones). \"0, 10, 10, 20, 10, 0\" = aggressive (dangerous zones).",
    suggestions: [
      { label: "Spawn", value: "60, 20, 10, 10, 2, 0", description: "Mostly friendly — 60% passive, low aggression for starting areas" },
      { label: "Neutral", value: "0, 10, 10, 10, 10, 0", description: "Evenly distributed — no passive guards, balanced aggression" },
      { label: "High", value: "0, 10, 10, 20, 10, 0", description: "Skewed aggressive — heavier mid-aggression for dangerous zones" }
    ]
  },
  "zone.roads": {
    tooltip: "Whether roads are generated in this zone.",
    detail: "Roads connect content and zone exits, making travel faster. Disable for wilderness zones where you want slower, more exploratory gameplay.",
    suggestions: [
      { label: "Off", value: false, description: "No roads generated in this zone" },
      { label: "On", value: true, description: "Generate roads connecting content and zone exits" }
    ]
  },
  "zone.footholds": {
    tooltip: "Place remote foothold content for forward bases.",
    detail: "Footholds let players establish presence in distant zones. Enable for neutral zones where you want to encourage forward expansion into enemy territory.",
    suggestions: [
      { label: "Off", value: false, description: "No foothold content placed in this zone" },
      { label: "On", value: true, description: "Place remote footholds for forward bases in enemy territory" }
    ]
  },
  "zone.holdCity": {
    tooltip: "Designate this zone's city as the City Hold target.",
    detail: "Only one zone can be the hold target. Required when City Hold victory is enabled. The zone must have at least one city (castleCount ≥ 1).",
    suggestions: [
      { label: "Off", value: false, description: "This zone's city is not the hold target" },
      { label: "On", value: true, description: "Designate this zone's city as the City Hold target" }
    ]
  },
  "zone.naturalExpansion": {
    tooltip: "Treat this neutral zone as a player's natural expansion.",
    detail: "The zone must connect to exactly one spawn zone. Its first city will match that player's starting faction, and additional cities match the first city.",
    suggestions: [
      { label: "Off", value: false, description: "This zone is a normal neutral zone" },
      { label: "On", value: true, description: "Match this zone's castles to its adjacent spawn player" }
    ]
  },
  "zone.matchAdjacentNeutralCastleFactions": {
    tooltip: "Match this neutral zone's castles to its one adjacent spawn zone.",
    detail: "Only applies when the zone connects to exactly one spawn zone. The first city matches that spawn's faction and additional cities match the first city.",
    suggestions: [
      { label: "Off", value: false, description: "This zone keeps normal neutral castle factions" },
      { label: "On", value: true, description: "Match this zone's castles to its adjacent spawn player" }
    ]
  },
  "zone.neutralCastlesAsRuins": {
    tooltip: "Make this neutral zone's castle slots rebuildable ruins.",
    detail: "Only applies to neutral zones. The zone keeps the same castle count and road anchors, but city main objects become ruins with an open faction list. City Hold targets remain cities.",
    suggestions: [
      { label: "Off", value: false, description: "This zone's castle slots generate as cities" },
      { label: "On", value: true, description: "This zone's castle slots generate as ruins" }
    ]
  },
  "zone.encounterHolesSettings": {
    tooltip: "Whether to write per-zone encounter-hole settings.",
    detail: "Enable this only for zones that need explicit encounter-hole counts. Leaving it off omits encounterHolesSettings from exported zones.",
    suggestions: [
      { label: "Off", value: false, description: "Omit zone-level encounter-hole settings" },
      { label: "On", value: true, description: "Write affected and two-hole encounter counts for this zone" }
    ]
  },
  "zone.encounterHolesSettings.affectedEncounters": {
    tooltip: "Number of encounters affected by the zone's encounter-hole rule.",
    detail: "This writes zone.encounterHolesSettings.affectedEncounters when encounter-hole settings are enabled for the zone.",
    suggestions: [
      { label: "None", value: 0, description: "No affected encounters" },
      { label: "Light", value: 3, description: "A small number of affected encounters" },
      { label: "Heavy", value: 8, description: "More encounters affected by the rule" }
    ]
  },
  "zone.encounterHolesSettings.twoHoleEncounters": {
    tooltip: "Number of affected encounters that use two holes.",
    detail: "This writes zone.encounterHolesSettings.twoHoleEncounters when encounter-hole settings are enabled for the zone.",
    suggestions: [
      { label: "None", value: 0, description: "No two-hole encounters" },
      { label: "Some", value: 2, description: "A few two-hole encounters" },
      { label: "Many", value: 5, description: "More two-hole encounters" }
    ]
  },
  "zone.randomHireEnableWeeklyUnitIncrement": {
    tooltip: "Enable weekly growth for random-hire unit counts in this zone.",
    detail: "This writes zone.randomHireEnableWeeklyUnitIncrement only after you explicitly toggle it. Leave untouched to preserve the builder's default output.",
    suggestions: [
      { label: "Off", value: false, description: "Explicitly disable weekly random-hire growth" },
      { label: "On", value: true, description: "Enable weekly random-hire growth" }
    ]
  },
  "zone.randomHireInitialUnitIncrement": {
    tooltip: "Whether to write an initial random-hire unit increment for this zone.",
    detail: "Enable this when the zone needs a fixed starting increment. Leaving it off omits randomHireInitialUnitIncrement from exported zones.",
    suggestions: [
      { label: "Unset", value: false, description: "Omit the initial increment field" },
      { label: "Set", value: true, description: "Write a numeric initial increment" }
    ]
  },
  "zone.randomHireInitialUnitIncrementValue": {
    tooltip: "Initial unit increment for random-hire content in this zone.",
    detail: "This writes zone.randomHireInitialUnitIncrement once the initial-increment option is enabled.",
    suggestions: [
      { label: "None", value: 0, description: "No initial increment" },
      { label: "Small", value: 2, description: "Small starting increment" },
      { label: "Large", value: 6, description: "Larger starting increment" }
    ]
  },
  "connection.name": {
    tooltip: "A unique name for this connection between two zones.",
    detail: "Used internally by the template. Convention: \"Path-1-3\" for a path between Spawn-1 and Neutral-3.",
    suggestions: [
      { label: "1-3", value: "Path-1-3", description: "Connection between Spawn-1 and Neutral-3" },
      { label: "3-2", value: "Path-3-2", description: "Connection between Neutral-3 and Spawn-2" },
      { label: "Hub", value: "Path-Hub", description: "Connection leading to the central hub zone" }
    ]
  },
  "connection.from": {
    tooltip: "The first zone this connection links.",
    suggestions: []
  },
  "connection.to": {
    tooltip: "The second zone this connection links.",
    suggestions: []
  },
  "connection.type": {
    tooltip: "How the two zones are linked — physical path, teleporter, or spatial adjacency.",
    detail: "\"Direct\" = walkable path between zones. \"Portal\" = teleporter link (no terrain path). \"Proximity\" = zones are adjacent but no explicit path or validation.",
    suggestions: [
      { label: "Direct", value: "Direct", description: "Physical path between zones — validated for walkability" },
      { label: "Portal", value: "Portal", description: "Teleporter link between zones — validated but no terrain path" },
      { label: "Proximity", value: "Proximity", description: "Zones are spatially adjacent — no path or validation" }
    ]
  },
  "connection.guardStrength": {
    tooltip: "How tough the guards are at this connection's border.",
    detail: "Controls the combat encounter when crossing between zones. 5k = passable early game. 30k = mid-game army needed. 120k = late-game boss gate.",
    suggestions: [
      { label: "Soft", value: 5000, description: "5k — light guard, passable early in the game" },
      { label: "Default", value: 30000, description: "30k — standard border guard requiring a mid-game army" },
      { label: "Boss", value: 120000, description: "120k — powerful gate guard blocking access until late game" }
    ]
  },
  "connection.road": {
    tooltip: "Generate a road along this connection.",
    detail: "Creates a road between the two connected zones for faster travel. Both zones must have roads enabled for the road to appear.",
    suggestions: [
      { label: "Off", value: false, description: "No road along this connection" },
      { label: "On", value: true, description: "Generate a road between the connected zones" }
    ]
  },
  "connection.guardZone": {
    tooltip: "Override which zone owns or anchors the guard encounter for this connection.",
    detail: "Leave this blank to keep the builder's default inference. Set it explicitly when an asymmetric manual layout needs the guard tied to a different zone.",
    suggestions: [blankSuggestion]
  },
  "connection.guardWeeklyIncrement": {
    tooltip: "Weekly scaling applied to this connection's guard strength.",
    detail: "Leave blank to keep the current generated default for ordinary direct and portal links. Set a value when you want this guard to scale faster or slower over time.",
    suggestions: optionalSuggestions(
      { label: "Default", value: 0.15, description: "Current generator default for manual direct and portal links" },
      { label: "Flat", value: 0, description: "No weekly scaling" },
      { label: "Steep", value: 0.3, description: "Faster weekly scaling" }
    )
  },
  "connection.guardRandomization": {
    tooltip: "Per-connection guard randomization factor.",
    detail: "Use this when a border or portal guard should vary independently from the surrounding zone guards. Leave blank to use the connection's normal behavior.",
    suggestions: optionalSuggestions(
      { label: "Stable", value: 0, description: "No randomization" },
      { label: "Default", value: 0.2, description: "Moderate variation" },
      { label: "Swingy", value: 0.4, description: "Large guard variance" }
    )
  },
  "connection.guardMatchGroup": {
    tooltip: "Optional shared group id for matching related guard encounters.",
    detail: "Leave blank to keep the builder's generated group name. Set a custom value when multiple links should share the same guard matching group.",
    suggestions: [blankSuggestion]
  },
  "connection.portalPlacementRulesFrom": {
    tooltip: "Raw JSON placement rules for the portal entrance in the source zone.",
    detail: "This first iteration accepts a JSON array of placement-rule objects. Invalid JSON stays local in the textarea and will not overwrite the design.",
    suggestions: [blankSuggestion]
  },
  "connection.portalPlacementRulesTo": {
    tooltip: "Raw JSON placement rules for the portal entrance in the destination zone.",
    detail: "This first iteration accepts a JSON array of placement-rule objects. Invalid JSON stays local in the textarea and will not overwrite the design.",
    suggestions: [blankSuggestion]
  }
};
