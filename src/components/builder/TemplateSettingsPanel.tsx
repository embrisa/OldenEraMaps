import { FileJson } from "lucide-react";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { gameModeOptions, terrainOptions, victoryOptions } from "@/settings";
import type { TemplateDesign } from "@/design";
import type { NoiseEntry } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, SteppedValueSlider, Textarea } from "@/components/ui/form-controls";
import { Alert, CheckField, ConfigField, formatJsonInput, parseJsonInput } from "@/components/builder/formHelpers";

interface NoiseDraftState {
  obstacles: string;
  water: string;
  obstaclesError?: string;
  waterError?: string;
}

export function TemplateSettingsPanel({
  design,
  onGlobal,
  onPlayerCount,
  onMapDimension,
  onLockMapDimensions,
  onHero,
  onGameEnd
}: {
  design: TemplateDesign;
  onGlobal<K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void;
  onPlayerCount(playerCount: number): void;
  onMapDimension(key: "mapWidth" | "mapHeight", value: number): void;
  onLockMapDimensions(locked: boolean): void;
  onHero(key: keyof TemplateDesign["heroSettings"], value: number): void;
  onGameEnd(key: keyof TemplateDesign["gameEndConditions"], value: boolean | number | string): void;
}): JSX.Element {
  const showLostStartCityDay = design.gameEndConditions.lostStartCity || design.gameEndConditions.victoryCondition === "win_condition_3";
  const showCityHoldDays = design.gameEndConditions.cityHold || design.gameEndConditions.victoryCondition === "win_condition_5";
  const showGladiatorRules = design.gameEndConditions.victoryCondition === "win_condition_4" || design.gladiatorArenaRules.enabled;
  const showTournamentRules = design.gameEndConditions.victoryCondition === "win_condition_6" || design.tournamentRules.enabled;
  const [noiseDrafts, setNoiseDrafts] = useState<NoiseDraftState>(() => ({
    obstacles: formatJsonInput(design.border.obstaclesNoise),
    water: formatJsonInput(design.border.waterNoise)
  }));

  useEffect(() => {
    setNoiseDrafts((current) => {
      if (current.obstaclesError || current.waterError) return current;
      return {
        obstacles: formatJsonInput(design.border.obstaclesNoise),
        water: formatJsonInput(design.border.waterNoise)
      };
    });
  }, [design.border.obstaclesNoise, design.border.waterNoise]);

  function updateOrientation<K extends keyof TemplateDesign["orientation"]>(key: K, value: TemplateDesign["orientation"][K]): void {
    onGlobal("orientation", { ...design.orientation, [key]: value });
  }

  function updateBorder<K extends keyof TemplateDesign["border"]>(key: K, value: TemplateDesign["border"][K]): void {
    onGlobal("border", { ...design.border, [key]: value });
  }

  function updateNoise(field: "obstacles" | "water", value: string): void {
    const parsed = parseJsonInput<unknown>(value);
    const error = parsed.ok ? validateNoiseEntries(parsed.value) : parsed.error;
    setNoiseDrafts((current) => ({
      ...current,
      [field]: value,
      [`${field}Error`]: error
    }));
    if (error) return;
    updateBorder(field === "obstacles" ? "obstaclesNoise" : "waterNoise", parsed.ok && parsed.value !== undefined ? parsed.value as NoiseEntry[] : []);
  }

  return (
    <Card className="template-settings-card">
      <CardHeader>
        <div>
          <CardTitle><FileJson size={17} />Template Settings</CardTitle>
          <CardDescription>Core output settings for the generated .rmg.json file.</CardDescription>
        </div>
        <div className="resource-icons" aria-hidden="true">
          {["resource-wood", "resource-ore", "resource-crystals", "resource-mercury", "resource-chest"].map((name) => (
            <img key={name} src={`/assets/olden-era/map-objects/${name}.png`} alt="" />
          ))}
        </div>
      </CardHeader>
      <CardContent className="compact-form template-settings-card__content">
        <section className="template-settings-card__section template-settings-card__section--identity" aria-label="Template identity">
          <ConfigField configKey="global.templateName" label="Template Name">
            <Input value={design.templateName} onChange={(event) => onGlobal("templateName", event.currentTarget.value)} />
          </ConfigField>
          <ConfigField configKey="global.templateDescription" label="Template Description">
            <Textarea rows={2} value={design.templateDescription} onChange={(event) => onGlobal("templateDescription", event.currentTarget.value)} />
          </ConfigField>
        </section>
        <section className="template-settings-card__section template-settings-card__section--map" aria-label="Map setup">
          <ConfigField configKey="global.playerCount" label="Players">
            <SteppedValueSlider min={2} max={8} value={design.playerCount} onChange={(event) => onPlayerCount(Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.mapWidth" label="Width">
            <SteppedValueSlider min={96} max={512} step={16} value={design.mapWidth} onChange={(event) => onMapDimension("mapWidth", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.mapHeight" label="Height">
            <SteppedValueSlider min={96} max={512} step={16} value={design.mapHeight} onChange={(event) => onMapDimension("mapHeight", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.gameMode" label="Game Mode">
            <NativeSelect value={design.gameMode} onChange={(event) => onGlobal("gameMode", event.currentTarget.value)}>
              {gameModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </ConfigField>
          <ConfigField configKey="global.terrainTheme" label="Terrain Default">
            <NativeSelect value={design.terrainTheme} onChange={(event) => onGlobal("terrainTheme", event.currentTarget.value as TemplateDesign["terrainTheme"])}>
              {terrainOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </ConfigField>
          <div className="template-settings-card__victory-group">
            <ConfigField configKey="global.victoryCondition" label="Victory">
              <NativeSelect value={design.gameEndConditions.victoryCondition} onChange={(event) => onGameEnd("victoryCondition", event.currentTarget.value)}>
                {[...victoryOptions, { value: "win_condition_6", label: "Tournament" }].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </ConfigField>
            {showCityHoldDays ? (
              <ConfigField configKey="global.cityHoldDays" label="City Hold Days">
                <SteppedValueSlider min={1} max={30} value={design.gameEndConditions.cityHoldDays} onChange={(event) => onGameEnd("cityHoldDays", Number(event.currentTarget.value))} />
              </ConfigField>
            ) : null}
          </div>
          <div className="checks checks--vertical template-settings-card__dimension-lock">
            <CheckField checked={design.lockMapDimensions} onCheckedChange={onLockMapDimensions}>Lock width and height together</CheckField>
          </div>
        </section>
        <section className="template-settings-card__section template-settings-card__section--match" aria-label="Match tuning">
          <ConfigField configKey="global.heroCountMin" label="Initial Hero Cap">
            <SteppedValueSlider min={1} max={12} value={design.heroSettings.heroCountMin} onChange={(event) => onHero("heroCountMin", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.heroCountMax" label="Max Hero Cap">
            <SteppedValueSlider min={1} max={12} value={design.heroSettings.heroCountMax} onChange={(event) => onHero("heroCountMax", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.heroCountIncrement" label="Increase / Castle">
            <SteppedValueSlider min={0} max={10} value={design.heroSettings.heroCountIncrement} onChange={(event) => onHero("heroCountIncrement", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.factionLawsExpPercent" label="Faction Laws XP %">
            <SteppedValueSlider min={25} max={200} step={5} value={design.factionLawsExpPercent} onChange={(event) => onGlobal("factionLawsExpPercent", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.astrologyExpPercent" label="Astrology XP %">
            <SteppedValueSlider min={25} max={200} step={5} value={design.astrologyExpPercent} onChange={(event) => onGlobal("astrologyExpPercent", Number(event.currentTarget.value))} />
          </ConfigField>
          {showLostStartCityDay ? (
            <ConfigField configKey="global.lostStartCityDay" label="Lost Start City Day">
              <SteppedValueSlider min={1} max={30} value={design.gameEndConditions.lostStartCityDay} onChange={(event) => onGameEnd("lostStartCityDay", Number(event.currentTarget.value))} />
            </ConfigField>
          ) : null}
        </section>
        <details className="raw-details">
          <summary>Advanced Rules</summary>
          <div className="checks template-settings-card__rule-checks">
            <CheckField checked={design.heroHireBan} onCheckedChange={(checked) => onGlobal("heroHireBan", checked)}>Ban hiring extra heroes</CheckField>
            <CheckField checked={design.encounterHoles} onCheckedChange={(checked) => onGlobal("encounterHoles", checked)}>Enable encounter holes</CheckField>
            <CheckField checked={design.gameEndConditions.lostStartCity} onCheckedChange={(checked) => onGameEnd("lostStartCity", checked)}>Lose when starting city is lost</CheckField>
            <CheckField checked={design.gameEndConditions.lostStartHero} onCheckedChange={(checked) => onGameEnd("lostStartHero", checked)}>Lose when starting hero is lost</CheckField>
          </div>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.movementBonus" label="Movement Bonus">
              <SteppedValueSlider min={-100} max={100} step={1} value={design.movementBonus} onChange={(event) => onGlobal("movementBonus", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
        </details>
        <details className="raw-details">
          <summary>Advanced Map Geometry</summary>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.orientation.zeroAngleZone" label="Zero Angle Zone">
              <Input value={design.orientation.zeroAngleZone ?? ""} onChange={(event) => updateOrientation("zeroAngleZone", event.currentTarget.value || undefined)} />
            </ConfigField>
            <ConfigField configKey="global.orientation.baseAngleMin" label="Base Angle Min">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.baseAngleMin} onChange={(event) => updateOrientation("baseAngleMin", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.orientation.baseAngleMax" label="Base Angle Max">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.baseAngleMax} onChange={(event) => updateOrientation("baseAngleMax", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--two">
            <ConfigField configKey="global.orientation.randomAngleAmplitude" label="Random Angle Amplitude">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.randomAngleAmplitude} onChange={(event) => updateOrientation("randomAngleAmplitude", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.orientation.randomAngleStep" label="Random Angle Step">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.randomAngleStep} onChange={(event) => updateOrientation("randomAngleStep", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.border.cornerRadius" label="Corner Radius">
              <SteppedValueSlider min={0} max={64} step={1} value={design.border.cornerRadius} onChange={(event) => updateBorder("cornerRadius", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.border.obstaclesWidth" label="Obstacle Width">
              <SteppedValueSlider min={0} max={32} step={1} value={design.border.obstaclesWidth} onChange={(event) => updateBorder("obstaclesWidth", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.border.waterWidth" label="Water Width">
              <SteppedValueSlider min={0} max={32} step={1} value={design.border.waterWidth} onChange={(event) => updateBorder("waterWidth", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.border.waterType" label="Water Type">
              <Input value={design.border.waterType} onChange={(event) => updateBorder("waterType", event.currentTarget.value)} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--two">
            <ConfigField configKey="global.border.obstaclesNoise" label="Obstacle Noise (JSON)">
              <Textarea rows={5} value={noiseDrafts.obstacles} onChange={(event) => updateNoise("obstacles", event.currentTarget.value)} />
            </ConfigField>
            <ConfigField configKey="global.border.waterNoise" label="Water Noise (JSON)">
              <Textarea rows={5} value={noiseDrafts.water} onChange={(event) => updateNoise("water", event.currentTarget.value)} />
            </ConfigField>
          </div>
          {noiseDrafts.obstaclesError ? <Alert tone="danger">Obstacle Noise: {noiseDrafts.obstaclesError}</Alert> : null}
          {noiseDrafts.waterError ? <Alert tone="danger">Water Noise: {noiseDrafts.waterError}</Alert> : null}
        </details>
        {showGladiatorRules ? (
          <>
            <div className="checks template-settings-card__rule-checks">
              <CheckField checked={design.gladiatorArenaRules.enabled} onCheckedChange={(checked) => onGlobal("gladiatorArenaRules", { ...design.gladiatorArenaRules, enabled: checked })}>Enable Gladiator rules</CheckField>
            </div>
            <div className="form-grid form-grid--two">
              <ConfigField configKey="global.gladiatorArenaRules.daysDelayStart" label="Gladiator Start Delay">
                <SteppedValueSlider min={1} max={60} value={design.gladiatorArenaRules.daysDelayStart} onChange={(event) => onGlobal("gladiatorArenaRules", { ...design.gladiatorArenaRules, daysDelayStart: Number(event.currentTarget.value) })} />
              </ConfigField>
              <ConfigField configKey="global.gladiatorArenaRules.countDay" label="Gladiator Count Day">
                <SteppedValueSlider min={1} max={30} value={design.gladiatorArenaRules.countDay} onChange={(event) => onGlobal("gladiatorArenaRules", { ...design.gladiatorArenaRules, countDay: Number(event.currentTarget.value) })} />
              </ConfigField>
            </div>
          </>
        ) : null}
        {showTournamentRules ? (
          <>
            <div className="checks template-settings-card__rule-checks">
              <CheckField checked={design.tournamentRules.enabled} onCheckedChange={(checked) => onGlobal("tournamentRules", { ...design.tournamentRules, enabled: checked })}>Enable Tournament rules</CheckField>
              <CheckField checked={design.tournamentRules.saveArmy} onCheckedChange={(checked) => onGlobal("tournamentRules", { ...design.tournamentRules, saveArmy: checked })}>Save tournament army</CheckField>
            </div>
            <div className="form-grid form-grid--three">
              <ConfigField configKey="global.tournamentRules.firstTournamentDay" label="First Tournament Day">
                <SteppedValueSlider min={3} max={60} value={design.tournamentRules.firstTournamentDay} onChange={(event) => onGlobal("tournamentRules", { ...design.tournamentRules, firstTournamentDay: Number(event.currentTarget.value) })} />
              </ConfigField>
              <ConfigField configKey="global.tournamentRules.interval" label="Tournament Interval">
                <SteppedValueSlider min={3} max={30} value={design.tournamentRules.interval} onChange={(event) => onGlobal("tournamentRules", { ...design.tournamentRules, interval: Number(event.currentTarget.value) })} />
              </ConfigField>
              <ConfigField configKey="global.tournamentRules.pointsToWin" label="Points To Win">
                <SteppedValueSlider min={1} max={10} value={design.tournamentRules.pointsToWin} onChange={(event) => onGlobal("tournamentRules", { ...design.tournamentRules, pointsToWin: Number(event.currentTarget.value) })} />
              </ConfigField>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function validateNoiseEntries(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "Use a JSON array of noise objects.";
  return value.every((entry) => (
    entry
    && typeof entry === "object"
    && typeof (entry as NoiseEntry).amp === "number"
    && Number.isFinite((entry as NoiseEntry).amp)
    && typeof (entry as NoiseEntry).freq === "number"
    && Number.isFinite((entry as NoiseEntry).freq)
  )) ? undefined : "Every entry needs numeric amp and freq values.";
}
