import { FileJson, Settings2 } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react";
import { gameModeOptions, terrainOptions, victoryOptions } from "@/settings";
import type { TemplateDesign } from "@/design";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, SteppedValueSlider, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";
import { CheckField, ConfigField } from "@/components/builder/formHelpers";

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
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const showLostStartCityDay = design.gameEndConditions.lostStartCity || design.gameEndConditions.victoryCondition === "win_condition_3";
  const showCityHoldDays = design.gameEndConditions.cityHold || design.gameEndConditions.victoryCondition === "win_condition_5";
  const showGladiatorRules = design.gameEndConditions.victoryCondition === "win_condition_4" || design.gladiatorArenaRules.enabled;
  const showTournamentRules = design.gameEndConditions.victoryCondition === "win_condition_6" || design.tournamentRules.enabled;

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
          <ConfigField configKey="global.gameMode" label="Game Mode">
            <NativeSelect value={design.gameMode} onChange={(event) => onGlobal("gameMode", event.currentTarget.value)}>
              {gameModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </NativeSelect>
          </ConfigField>
          <Button type="button" size="sm" variant="blue" onClick={() => setRulesDialogOpen(true)}>
            <Settings2 size={14} />Rules &amp; Victory
          </Button>
          <ConfigField configKey="global.playerCount" label="Players">
            <SteppedValueSlider min={2} max={8} value={design.playerCount} onChange={(event) => onPlayerCount(Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.mapWidth" label="Width">
            <SteppedValueSlider min={96} max={512} step={16} value={design.mapWidth} onChange={(event) => onMapDimension("mapWidth", Number(event.currentTarget.value))} />
          </ConfigField>
          <ConfigField configKey="global.mapHeight" label="Height">
            <SteppedValueSlider min={96} max={512} step={16} value={design.mapHeight} onChange={(event) => onMapDimension("mapHeight", Number(event.currentTarget.value))} />
          </ConfigField>
          <div className="template-settings-card__map-actions">
            <div className="checks">
              <CheckField checked={design.lockMapDimensions} onCheckedChange={onLockMapDimensions}>Lock width and height together</CheckField>
            </div>
          </div>
        </section>
      </CardContent>
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="rules-victory-dialog">
          <div className="dialog-heading">
            <div>
              <DialogTitle>Rules &amp; Victory</DialogTitle>
              <DialogDescription>Victory conditions, match tuning, terrain defaults, and advanced rules.</DialogDescription>
            </div>
          </div>
          <div className="dialog-section">
            <h3 className="dialog-section__heading">Victory &amp; Terrain</h3>
            <div className="form-grid form-grid--three">
              <ConfigField configKey="global.terrainTheme" label="Terrain Default">
                <NativeSelect value={design.terrainTheme} onChange={(event) => onGlobal("terrainTheme", event.currentTarget.value as TemplateDesign["terrainTheme"])}>
                  {terrainOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
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
          </div>
          <div className="dialog-section">
            <h3 className="dialog-section__heading">Match Tuning</h3>
            <div className="form-grid form-grid--three">
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
            </div>
          </div>
          <div className="dialog-section">
            <h3 className="dialog-section__heading">Advanced Rules</h3>
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
          </div>
          {showGladiatorRules ? (
            <div className="dialog-section">
              <h3 className="dialog-section__heading">Gladiator Rules</h3>
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
            </div>
          ) : null}
          {showTournamentRules ? (
            <div className="dialog-section">
              <h3 className="dialog-section__heading">Tournament Rules</h3>
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
