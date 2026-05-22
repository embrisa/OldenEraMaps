import type { GameRules, GeneratorSettings, WinConditions } from "../types.ts";
import { clamp, roundAway } from "./math.ts";

export function buildGameRules(settings: GeneratorSettings, effectiveVictoryCondition: string): GameRules {
  return {
    heroCountMin: settings.heroSettings.heroCountMin - settings.heroSettings.heroCountIncrement,
    heroCountMax: settings.heroSettings.heroCountMax,
    heroCountIncrement: settings.heroSettings.heroCountIncrement,
    heroHireBan: settings.heroHireBan,
    encounterHoles: settings.encounterHoles,
    factionLawsExpModifier: percentToModifier(settings.factionLawsExpPercent),
    astrologyExpModifier: percentToModifier(settings.astrologyExpPercent),
    bonuses: [{ sid: "add_bonus_hero_stat", receiverSide: -1, receiverFilter: "all_heroes", parameters: ["movementBonus", `${Math.trunc(clamp(settings.movementBonus, -100, 100))}`] }],
    winConditions: buildAdvancedWinConditions(settings, effectiveVictoryCondition)
  };
}

function percentToModifier(percent: number): number {
  return roundAway(clamp(percent, 25, 200) / 100, 2);
}

function buildAdvancedWinConditions(settings: GeneratorSettings, effectiveVictoryCondition: string): WinConditions {
  const useLostStartCity = settings.gameEndConditions.lostStartCity || effectiveVictoryCondition === "win_condition_3";
  const useCityHold = settings.gameEndConditions.cityHold || effectiveVictoryCondition === "win_condition_5";
  const useGladiator = settings.gladiatorArenaRules.enabled || effectiveVictoryCondition === "win_condition_4";
  const useTournament = settings.tournamentRules.enabled || effectiveVictoryCondition === "win_condition_6";
  const winConditions: WinConditions = {
    classic: true,
    desertion: true,
    desertionDay: 3,
    desertionValue: 3000,
    heroLighting: true,
    heroLightingDay: 1,
    lostStartCity: useLostStartCity,
    lostStartCityDay: Math.trunc(clamp(settings.gameEndConditions.lostStartCityDay, 1, 30)),
    lostStartHero: settings.gameEndConditions.lostStartHero || useGladiator,
    cityHold: useCityHold,
    cityHoldDays: Math.trunc(clamp(settings.gameEndConditions.cityHoldDays, 1, 30))
  };

  if (useGladiator) {
    winConditions.gladiatorArena = true;
    winConditions.gladiatorArenaRegistrationStartWork = false;
    winConditions.gladiatorArenaRegistrationStartFight = true;
    winConditions.gladiatorArenaDaysDelayStart = Math.trunc(clamp(settings.gladiatorArenaRules.daysDelayStart, 1, 60));
    winConditions.gladiatorArenaCountDay = Math.trunc(clamp(settings.gladiatorArenaRules.countDay, 1, 30));
    winConditions.championSelectRule = "StartHero";
  }

  if (useTournament) {
    const firstTournamentDay = Math.trunc(clamp(settings.tournamentRules.firstTournamentDay, 3, 60));
    const tournamentInterval = Math.trunc(clamp(settings.tournamentRules.interval, 3, 30));
    const pointsToWin = Math.trunc(clamp(settings.tournamentRules.pointsToWin, 1, 10));
    const roundCount = pointsToWin * 2 - 1;
    const announceDays: number[] = [];
    const battleOffsets: number[] = [];
    let previousBattleTurn = 0;
    for (let i = 0; i < roundCount; i++) {
      const announceTurn = i === 0 ? 1 : previousBattleTurn + 1;
      const offset = i === 0 ? firstTournamentDay - 1 : tournamentInterval - 1;
      announceDays.push(announceTurn);
      battleOffsets.push(offset);
      previousBattleTurn = announceTurn + offset;
    }
    winConditions.championSelectRule = "StartHero";
    winConditions.tournament = true;
    winConditions.tournamentSaveArmy = settings.tournamentRules.saveArmy;
    winConditions.tournamentAnnounceDays = announceDays;
    winConditions.tournamentDays = battleOffsets;
    winConditions.tournamentPointsToWin = pointsToWin;
  }

  return winConditions;
}
