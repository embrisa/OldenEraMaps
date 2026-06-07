import { useCallback, useEffect, useRef, useState } from "react";
import { applyBalancedRandomBoardLayout } from "@/balancedRandomMap";
import {
  addConnectionFromDraft,
  addZone,
  createDefaultDesign,
  deleteZone,
  duplicateZone,
  getDesignMandatoryContentGroups,
  MAX_SPAWN_ZONES,
  moveZone,
  parseDesignOrTemplateFile,
  serializeDesignFile,
  setDesignPlayerCount,
  templateToDesign,
  transferZoneSettings,
  type DesignConnection,
  type DesignZone,
  type DesignZoneRole,
  type TemplateDesign
} from "@/design";
import { generateTemplate } from "@/generator";
import { zoneSuffixes } from "@/generator/math";
import type { GeneratorSettings, Point } from "@/types";
import type { ButtonProps } from "@/components/ui/button";

export const AUTOSAVE_KEY = "olden-era-template-generator.autosave";

export type CommitDesign = (
  next: TemplateDesign,
  nextSelectedZoneId?: string,
  options?: {
    allowDirtyJsonOverwrite?: boolean;
    markDirty?: boolean;
  }
) => boolean;

export interface AutosaveRecovery {
  design: TemplateDesign;
}

export interface DesignHistoryEntry {
  design: TemplateDesign;
  selectedZoneId: string;
  selectedConnectionId: string;
  dirty: boolean;
}

export interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm(): void;
}

function createInitialDesign(): TemplateDesign {
  return createDefaultDesign();
}

function readAutosave(): AutosaveRecovery | null {
  const text = window.localStorage.getItem(AUTOSAVE_KEY);
  if (!text) return null;
  try {
    const design = parseDesignOrTemplateFile(text);
    return { design };
  } catch {
    window.localStorage.removeItem(AUTOSAVE_KEY);
    return null;
  }
}

function resolveSelectedZoneId(previous: TemplateDesign, next: TemplateDesign, selectedZoneId: string): string {
  if (selectedZoneId === "" || next.zones.some((zone) => zone.id === selectedZoneId)) return selectedZoneId;

  const previousSelectedZone = previous.zones.find((zone) => zone.id === selectedZoneId);
  if (previousSelectedZone) {
    const remapped = next.zones.find((zone) => zone.name === previousSelectedZone.name);
    if (remapped) return remapped.id;
  }

  return next.zones[0]?.id ?? "";
}

function firstAvailableSpawnPlayer(usedPlayers: Set<number>): number | undefined {
  for (let player = 1; player <= MAX_SPAWN_ZONES; player++) {
    if (!usedPlayers.has(player)) return player;
  }
  return undefined;
}

function shouldRenameRoleChangedZone(previousRole: DesignZoneRole, previousName: string, currentName: string): boolean {
  const trimmed = currentName.trim();
  if (!trimmed) return true;
  if (previousRole === "Hub" && trimmed === "Hub") return true;
  return trimmed === previousName && trimmed.startsWith(`${previousRole}-`);
}

function uniqueZoneName(design: TemplateDesign, zoneId: string, baseName: string): string {
  const used = new Set(design.zones.filter((zone) => zone.id !== zoneId).map((zone) => zone.name));
  if (!used.has(baseName)) return baseName;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${baseName}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function reconcileRoleChange(
  design: TemplateDesign,
  zone: DesignZone,
  previousRole: DesignZoneRole,
  previousName: string
): void {
  if (zone.role === previousRole) return;

  if (zone.role === "Spawn") {
    const usedPlayers = new Set(design.zones
      .filter((candidate) => candidate.id !== zone.id && candidate.role === "Spawn")
      .map((candidate) => candidate.player)
      .filter((player): player is number => typeof player === "number" && Number.isInteger(player) && player >= 1 && player <= MAX_SPAWN_ZONES));
    const playerIsAvailable = Number.isInteger(zone.player)
      && zone.player! >= 1
      && zone.player! <= MAX_SPAWN_ZONES
      && !usedPlayers.has(zone.player!);
    if (!playerIsAvailable) {
      zone.player = firstAvailableSpawnPlayer(usedPlayers) ?? zone.player;
    }

    if (shouldRenameRoleChangedZone(previousRole, previousName, zone.name) && Number.isInteger(zone.player)) {
      zone.name = uniqueZoneName(design, zone.id, `Spawn-${zone.player}`);
    }
  } else {
    zone.player = undefined;
  }

  const spawnCount = design.zones.filter((candidate) => candidate.role === "Spawn").length;
  if (spawnCount >= 2 && spawnCount <= MAX_SPAWN_ZONES) {
    design.playerCount = spawnCount;
  }
}

function resolveSelectedConnectionId(next: TemplateDesign, selectedConnectionId: string): string {
  return next.connections.some((connection) => connection.id === selectedConnectionId) ? selectedConnectionId : "";
}

interface UseBuilderWorkspaceProps {
  getJsonDirty: () => boolean;
  requestConfirmation: (confirmation: PendingConfirmation) => void;
  onEditConnection?: () => void;
  onGenerateSuccess?: () => void;
  onSyncJsonSnapshot?: (next: TemplateDesign) => void;
  onClearJsonMessages?: () => void;
}

export function useBuilderWorkspace({
  getJsonDirty,
  requestConfirmation,
  onEditConnection,
  onGenerateSuccess,
  onSyncJsonSnapshot,
  onClearJsonMessages
}: UseBuilderWorkspaceProps) {
  const [design, setDesign] = useState(() => createInitialDesign());
  const [selectedZoneId, setSelectedZoneId] = useState(() => design.zones[0]?.id ?? "");
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [autosaveRecovery, setAutosaveRecovery] = useState<AutosaveRecovery | null>(() => readAutosave());
  const [historyRevision, setHistoryRevision] = useState(0);

  const designHistoryRef = useRef<DesignHistoryEntry[]>([]);

  const selectedZone = design.zones.find((zone) => zone.id === selectedZoneId);
  const zoneLimitReached = design.zones.length >= zoneSuffixes.length;
  const zoneLimitMessage = zoneLimitReached
    ? `Zone limit reached: templates support at most ${zoneSuffixes.length} zones, so adding and duplicating zones is disabled.`
    : undefined;

  const canUndoDesignChange = historyRevision > 0;

  useEffect(() => {
    if (!dirty) return;
    window.localStorage.setItem(AUTOSAVE_KEY, serializeDesignFile(design));
  }, [design, dirty]);

  const pushDesignHistory = useCallback((entry: DesignHistoryEntry) => {
    designHistoryRef.current = [...designHistoryRef.current.slice(-49), structuredClone(entry)];
    setHistoryRevision(designHistoryRef.current.length);
  }, []);

  const resetDesignHistory = useCallback(() => {
    designHistoryRef.current = [];
    setHistoryRevision(0);
  }, []);

  const clearJsonMessages = useCallback(() => {
    if (onClearJsonMessages) onClearJsonMessages();
  }, [onClearJsonMessages]);

  const syncJsonSnapshot = useCallback((next: TemplateDesign) => {
    if (onSyncJsonSnapshot) onSyncJsonSnapshot(next);
  }, [onSyncJsonSnapshot]);

  const commit = useCallback(
    (
      next: TemplateDesign,
      nextSelectedZoneId = selectedZoneId,
      options: {
        allowDirtyJsonOverwrite?: boolean;
        markDirty?: boolean;
      } = {}
    ): boolean => {
      if (!options.allowDirtyJsonOverwrite && getJsonDirty()) {
        requestConfirmation({
          title: "Discard unsynced JSON edits?",
          message: "The JSON editor has changes that have not been applied to the builder yet. Continue and discard those JSON edits?",
          confirmLabel: "Discard JSON edits",
          confirmVariant: "danger",
          onConfirm: () => {
            commit(next, nextSelectedZoneId, { ...options, allowDirtyJsonOverwrite: true });
          }
        });
        return false;
      }

      pushDesignHistory({
        design,
        selectedZoneId,
        selectedConnectionId,
        dirty
      });
      const resolvedZoneId = resolveSelectedZoneId(design, next, nextSelectedZoneId);
      setDesign(next);
      setSelectedZoneId(resolvedZoneId);
      setSelectedConnectionId(resolvedZoneId ? "" : resolveSelectedConnectionId(next, selectedConnectionId));
      setDirty(options.markDirty ?? true);
      clearJsonMessages();
      syncJsonSnapshot(next);
      return true;
    },
    [design, selectedZoneId, selectedConnectionId, dirty, getJsonDirty, requestConfirmation, pushDesignHistory, clearJsonMessages, syncJsonSnapshot]
  );

  const undoDesignChange = useCallback((): void => {
    const previous = designHistoryRef.current.at(-1);
    if (!previous) return;

    designHistoryRef.current = designHistoryRef.current.slice(0, -1);
    setDesign(previous.design);
    setSelectedZoneId(previous.selectedZoneId);
    setSelectedConnectionId(previous.selectedConnectionId);
    setDirty(previous.dirty);
    clearJsonMessages();
    syncJsonSnapshot(previous.design);
    setHistoryRevision(designHistoryRef.current.length);
  }, [clearJsonMessages, syncJsonSnapshot]);

  const runAfterDiscardingUnsavedChanges = useCallback(
    (action: () => void): void => {
      if (!dirty && !getJsonDirty()) {
        action();
        return;
      }

      requestConfirmation({
        title: "Discard unsaved changes?",
        message: "The current builder design has unsaved changes. Continue and discard those changes?",
        confirmLabel: "Discard changes",
        confirmVariant: "danger",
        onConfirm: action
      });
    },
    [dirty, getJsonDirty, requestConfirmation]
  );

  const handleNew = useCallback((): void => {
    runAfterDiscardingUnsavedChanges(() => {
      const next = createInitialDesign();
      setDesign(next);
      setSelectedZoneId(next.zones[0]?.id ?? "");
      setSelectedConnectionId("");
      setDirty(false);
      clearJsonMessages();
      syncJsonSnapshot(next);
      resetDesignHistory();
    });
  }, [runAfterDiscardingUnsavedChanges, clearJsonMessages, syncJsonSnapshot, resetDesignHistory]);

  const handleRecover = useCallback((): void => {
    if (!autosaveRecovery) return;
    runAfterDiscardingUnsavedChanges(() => {
      setDesign(autosaveRecovery.design);
      setSelectedZoneId(autosaveRecovery.design.zones[0]?.id ?? "");
      setSelectedConnectionId("");
      setDirty(true);
      clearJsonMessages();
      syncJsonSnapshot(autosaveRecovery.design);
      resetDesignHistory();
      setAutosaveRecovery(null);
    });
  }, [autosaveRecovery, runAfterDiscardingUnsavedChanges, clearJsonMessages, syncJsonSnapshot, resetDesignHistory]);

  const handleDismissRecovery = useCallback((): void => {
    window.localStorage.removeItem(AUTOSAVE_KEY);
    setAutosaveRecovery(null);
  }, []);

  const handleGlobal = useCallback(
    <K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void => {
      commit({ ...design, [key]: value });
    },
    [design, commit]
  );

  const handlePlayerCount = useCallback(
    (playerCount: number): void => {
      const next = setDesignPlayerCount(design, playerCount);
      commit(next, next.zones.find((zone) => zone.role === "Spawn" && zone.player === playerCount)?.id ?? selectedZoneId);
    },
    [design, selectedZoneId, commit]
  );

  const handleMapDimension = useCallback(
    (key: "mapWidth" | "mapHeight", value: number): void => {
      if (design.lockMapDimensions) {
        commit({ ...design, mapWidth: value, mapHeight: value });
        return;
      }

      commit({ ...design, [key]: value });
    },
    [design, commit]
  );

  const handleLockMapDimensions = useCallback(
    (locked: boolean): void => {
      commit({
        ...design,
        lockMapDimensions: locked,
        ...(locked ? { mapHeight: design.mapWidth } : {})
      });
    },
    [design, commit]
  );

  const handleHero = useCallback(
    (key: keyof TemplateDesign["heroSettings"], value: number): void => {
      commit({ ...design, heroSettings: { ...design.heroSettings, [key]: value } });
    },
    [design, commit]
  );

  const handleGameEnd = useCallback(
    (key: keyof TemplateDesign["gameEndConditions"], value: boolean | number | string): void => {
      const next = { ...design.gameEndConditions, [key]: value };
      if (key === "victoryCondition") {
        next.cityHold = value === "win_condition_5";
      }
      commit({ ...design, gameEndConditions: next });
    },
    [design, commit]
  );

  const updateZone = useCallback(
    (mutator: (zone: DesignZone) => void): void => {
      const next = structuredClone(design);
      const zone = next.zones.find((candidate) => candidate.id === selectedZoneId);
      if (!zone) return;
      const previousRole = zone.role;
      const previousName = zone.name;
      mutator(zone);
      reconcileRoleChange(next, zone, previousRole, previousName);
      commit(next, zone.id);
    },
    [design, selectedZoneId, commit]
  );

  const updateConnection = useCallback(
    (connectionId: string, mutator: (connection: DesignConnection) => void): void => {
      const next = structuredClone(design);
      const connection = next.connections.find((candidate) => candidate.id === connectionId);
      if (!connection) return;
      mutator(connection);
      commit(next);
    },
    [design, commit]
  );

  const handleAddReversePortal = useCallback(
    (connectionId: string): void => {
      const connection = design.connections.find((candidate) => candidate.id === connectionId);
      const fromZone = design.zones.find((zone) => zone.id === connection?.from);
      const toZone = design.zones.find((zone) => zone.id === connection?.to);
      if (!connection || !fromZone || !toZone) return;
      commit(addConnectionFromDraft(design, {
        name: `Portal-${toZone.name}-${fromZone.name}`,
        from: connection.to,
        to: connection.from,
        type: "Portal",
        guardStrength: connection.guardStrength,
        road: connection.road,
        guardRandomization: connection.guardRandomization,
        guardWeeklyIncrement: connection.guardWeeklyIncrement,
        guardEscape: connection.guardEscape,
        simTurnSquad: connection.simTurnSquad,
        guardZone: connection.guardZone,
        guardMatchGroup: connection.guardMatchGroup,
        portalPlacementRulesFrom: connection.portalPlacementRulesTo ? structuredClone(connection.portalPlacementRulesTo) : undefined,
        portalPlacementRulesTo: connection.portalPlacementRulesFrom ? structuredClone(connection.portalPlacementRulesFrom) : undefined
      }));
    },
    [design, commit]
  );

  const updateDesign = useCallback(
    (mutator: (design: TemplateDesign) => void): void => {
      const next = structuredClone(design);
      mutator(next);
      commit(next);
    },
    [design, commit]
  );

  const handleAddZone = useCallback(
    (role: DesignZoneRole): void => {
      const next = addZone(design, role);
      const existingZoneIds = new Set(design.zones.map((zone) => zone.id));
      const addedZone = next.zones.find((zone) => !existingZoneIds.has(zone.id));
      commit(next, addedZone?.id ?? selectedZoneId);
    },
    [design, selectedZoneId, commit]
  );

  const handleDuplicate = useCallback(
    (zoneId: string): void => {
      const next = duplicateZone(design, zoneId);
      const existingZoneIds = new Set(design.zones.map((zone) => zone.id));
      const duplicatedZone = next.zones.find((zone) => !existingZoneIds.has(zone.id));
      commit(next, duplicatedZone?.id ?? zoneId);
    },
    [design, commit]
  );

  const handleTransferZoneSettings = useCallback(
    (sourceZoneId: string, targetZoneId: string): void => {
      const next = transferZoneSettings(design, sourceZoneId, targetZoneId);
      if (next === design) return;
      commit(next, targetZoneId);
    },
    [design, commit]
  );

  const handleDelete = useCallback(
    (zoneId: string): void => {
      commit(deleteZone(design, zoneId));
    },
    [design, commit]
  );

  const handleMoveZone = useCallback(
    (zoneId: string, position: Point): void => {
      const next = moveZone(design, zoneId, position);
      if (next === design) return;
      commit(next, zoneId);
    },
    [design, commit]
  );

  const handleSelectZone = useCallback((zoneId: string): void => {
    setSelectedZoneId(zoneId);
    setSelectedConnectionId("");
  }, []);

  const handleSelectConnection = useCallback((connectionId: string): void => {
    setSelectedConnectionId(connectionId);
    if (connectionId) setSelectedZoneId("");
  }, []);

  const handleDeleteConnection = useCallback(
    (connectionId: string): void => {
      commit({ ...design, connections: design.connections.filter((connection) => connection.id !== connectionId) });
    },
    [design, commit]
  );

  const handleEditConnection = useCallback(
    (connectionId: string): void => {
      setSelectedConnectionId(connectionId);
      if (onEditConnection) onEditConnection();
    },
    [onEditConnection]
  );

  const handleGenerateBalancedRandomMap = useCallback(
    (settings: GeneratorSettings): boolean => {
      const generate = (): boolean => {
        const next = applyBalancedRandomBoardLayout(templateToDesign(generateTemplate(settings)));
        return commit(next, next.zones[0]?.id ?? "", { allowDirtyJsonOverwrite: true, markDirty: true });
      };

      if (!dirty && !getJsonDirty()) return generate();

      runAfterDiscardingUnsavedChanges(() => {
        if (generate() && onGenerateSuccess) onGenerateSuccess();
      });
      return false;
    },
    [dirty, getJsonDirty, commit, runAfterDiscardingUnsavedChanges, onGenerateSuccess]
  );

  const loadDesign = useCallback(
    (next: TemplateDesign, markDirty = true): boolean => {
      return commit(next, next.zones[0]?.id ?? "", { allowDirtyJsonOverwrite: true, markDirty });
    },
    [commit]
  );

  const getMandatoryContentNames = useCallback((): string[] => {
    return getDesignMandatoryContentGroups(design).map((group) => group.name).filter(Boolean);
  }, [design]);

  return {
    design,
    setDesign,
    selectedZoneId,
    setSelectedZoneId,
    selectedConnectionId,
    setSelectedConnectionId,
    dirty,
    setDirty,
    autosaveRecovery,
    setAutosaveRecovery,
    historyRevision,
    selectedZone,
    zoneLimitReached,
    zoneLimitMessage,
    canUndoDesignChange,
    undoDesignChange,
    runAfterDiscardingUnsavedChanges,
    handleNew,
    handleRecover,
    handleDismissRecovery,
    handleGlobal,
    handlePlayerCount,
    handleMapDimension,
    handleLockMapDimensions,
    handleHero,
    handleGameEnd,
    updateZone,
    updateConnection,
    handleAddReversePortal,
    updateDesign,
    handleAddZone,
    handleDuplicate,
    handleTransferZoneSettings,
    handleDelete,
    handleMoveZone,
    handleSelectZone,
    handleSelectConnection,
    handleDeleteConnection,
    handleEditConnection,
    handleGenerateBalancedRandomMap,
    loadDesign,
    getMandatoryContentNames,
    resetDesignHistory,
    commit
  };
}
