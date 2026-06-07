import { ArrowRightLeft, CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import type { DesignConnection, DesignConnectionType, DesignZoneRole, TemplateDesign } from "@/design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, SteppedValueSlider } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, ScrollArea } from "@/components/ui/radix";
import { RmgJsonEditor } from "@/components/builder/RmgJsonEditor";
import { Alert, CheckField, ConfigField, formatJsonInput, formatNumberInput, parseJsonInput, parseNumberInput } from "@/components/builder/formHelpers";

interface PortalRuleDraftState {
  from: string;
  to: string;
  fromError?: string;
  toError?: string;
}

export function ConnectionsDialog({
  open,
  onOpenChange,
  design,
  selectedConnectionId,
  onAdd,
  onAddReversePortal,
  onUpdate,
  onDelete
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  design: TemplateDesign;
  selectedConnectionId: string;
  onAdd(): void;
  onAddReversePortal(connectionId: string): void;
  onUpdate(connectionId: string, mutator: (connection: DesignConnection) => void): void;
  onDelete(connectionId: string): void;
}): JSX.Element {
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [portalRuleDrafts, setPortalRuleDrafts] = useState<Record<string, PortalRuleDraftState>>({});

  useEffect(() => {
    if (!open || !selectedConnectionId) return;
    rowRefs.current.get(selectedConnectionId)?.scrollIntoView({ block: "nearest" });
  }, [open, selectedConnectionId]);

  useEffect(() => {
    if (!open) return;
    setPortalRuleDrafts(Object.fromEntries(design.connections.map((connection) => [connection.id, {
      from: formatJsonInput(connection.portalPlacementRulesFrom),
      to: formatJsonInput(connection.portalPlacementRulesTo)
    }])));
  }, [design.connections, open]);

  function portalRuleDraftFor(connection: DesignConnection): PortalRuleDraftState {
    return portalRuleDrafts[connection.id] ?? {
      from: formatJsonInput(connection.portalPlacementRulesFrom),
      to: formatJsonInput(connection.portalPlacementRulesTo)
    };
  }

  function updatePortalRules(connection: DesignConnection, field: "from" | "to", value: string): void {
    const parsed = parseJsonInput<unknown>(value);
    const parsedValue = parsed.ok ? parsed.value : undefined;
    let error: string | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if (parsedValue !== undefined && !Array.isArray(parsedValue)) {
      error = "Use a JSON array of placement rules.";
    }

    setPortalRuleDrafts((current) => ({
      ...current,
      [connection.id]: {
        ...(current[connection.id] ?? portalRuleDraftFor(connection)),
        [field]: value,
        [`${field}Error`]: error
      }
    }));

    if (error) return;
    onUpdate(connection.id, (draft) => {
      if (field === "from") draft.portalPlacementRulesFrom = parsedValue as DesignConnection["portalPlacementRulesFrom"];
      else draft.portalPlacementRulesTo = parsedValue as DesignConnection["portalPlacementRulesTo"];
    });
  }

  function zoneNameById(zoneId: string): string {
    return design.zones.find((zone) => zone.id === zoneId)?.name ?? zoneId;
  }

  function zoneRoleById(zoneId: string): DesignZoneRole | undefined {
    return design.zones.find((zone) => zone.id === zoneId)?.role;
  }

  function hasReversePortal(connection: DesignConnection): boolean {
    return design.connections.some((candidate) => (
      candidate.id !== connection.id
      && candidate.type === "Portal"
      && candidate.from === connection.to
      && candidate.to === connection.from
    ));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="dialog-heading">
          <div>
            <DialogTitle>Connections</DialogTitle>
            <DialogDescription>Add paths between zones. Portal connections travel one way from From to To; add a reverse portal for return travel.</DialogDescription>
          </div>
          <Button type="button" variant="violet" onClick={onAdd}><CirclePlus size={16} />Add Connection</Button>
        </div>
        <ScrollArea className="connection-scroll">
          {design.connections.length === 0 ? (
            <div className="empty-state">No connections yet.</div>
          ) : (
            <div className="dialog-card-grid">
              {design.connections.map((connection) => (
                <article
                  key={connection.id}
                  ref={(element) => {
                    if (element) rowRefs.current.set(connection.id, element);
                    else rowRefs.current.delete(connection.id);
                  }}
                  className="connection-row dialog-card"
                  data-selected={selectedConnectionId === connection.id ? "true" : undefined}
                >
                  <div className="connection-row__header">
                    <ConfigField configKey="connection.name" label="Connection Name" className="connection-row__name-field">
                      <Input value={connection.name} aria-label="Connection name" onChange={(event) => {
                        const value = event.currentTarget.value;
                        onUpdate(connection.id, (draft) => { draft.name = value; });
                      }} />
                    </ConfigField>
                    <div className="connection-row__badges">
                      <Badge>{connection.type}</Badge>
                      <Badge>{Math.round(connection.guardStrength).toLocaleString()} guard</Badge>
                    </div>
                    <Button type="button" size="sm" variant="danger" onClick={() => onDelete(connection.id)}><Trash2 size={14} />Delete</Button>
                  </div>
                  <div
                    className={`connection-visual connection-visual--${connection.type.toLowerCase()} ${connection.road ? "connection-visual--road" : "connection-visual--plain"}`}
                    aria-label={`${zoneNameById(connection.from)} to ${zoneNameById(connection.to)} ${connection.type.toLowerCase()} connection`}
                  >
                    <ConnectionEndpoint name={zoneNameById(connection.from)} role={zoneRoleById(connection.from)} />
                    <div className="connection-visual__rail">
                      <span className="connection-visual__line" aria-hidden="true" />
                      <span className="connection-visual__label">
                        {connection.type === "Portal" ? "Portal jump" : connection.road ? "Road lane" : "Wild lane"}
                      </span>
                    </div>
                    <ConnectionEndpoint name={zoneNameById(connection.to)} role={zoneRoleById(connection.to)} />
                  </div>
                  <div className="connection-row__quick-toggles" aria-label="Connection quick toggles">
                    <button
                      type="button"
                      className="connection-toggle"
                      aria-pressed={connection.road}
                      onClick={() => onUpdate(connection.id, (draft) => { draft.road = !draft.road; })}
                    >
                      <span>Road</span>
                      <strong>{connection.road ? "On" : "Off"}</strong>
                    </button>
                    {connection.type === "Direct" ? (
                      <button
                        type="button"
                        className="connection-toggle connection-toggle--violet"
                        aria-pressed={connection.simTurnSquad ?? true}
                        onClick={() => onUpdate(connection.id, (draft) => { draft.simTurnSquad = !(draft.simTurnSquad ?? true); })}
                      >
                        <span>Sim-turn squad</span>
                        <strong>{(connection.simTurnSquad ?? true) ? "On" : "Off"}</strong>
                      </button>
                    ) : null}
                    {connection.type === "Portal" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="blue"
                        disabled={hasReversePortal(connection)}
                        onClick={() => onAddReversePortal(connection.id)}
                      >
                        <ArrowRightLeft size={14} />{hasReversePortal(connection) ? "Reverse Portal Exists" : "Add Reverse Portal"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="form-grid form-grid--three">
                    <ConfigField configKey="connection.from" label="From">
                      <NativeSelect value={connection.from} onChange={(event) => {
                        const value = event.currentTarget.value;
                        onUpdate(connection.id, (draft) => { draft.from = value; });
                      }}>
                        {design.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                      </NativeSelect>
                    </ConfigField>
                    <ConfigField configKey="connection.to" label="To">
                      <NativeSelect value={connection.to} onChange={(event) => {
                        const value = event.currentTarget.value;
                        onUpdate(connection.id, (draft) => { draft.to = value; });
                      }}>
                        {design.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                      </NativeSelect>
                    </ConfigField>
                    <ConfigField configKey="connection.type" label="Type">
                      <NativeSelect value={connection.type} onChange={(event) => {
                        const value = event.currentTarget.value as DesignConnectionType;
                        onUpdate(connection.id, (draft) => { draft.type = value; });
                      }}>
                        {["Direct", "Portal", "Proximity"].map((value) => <option key={value} value={value}>{value}</option>)}
                      </NativeSelect>
                    </ConfigField>
                  </div>
                  <div className="form-grid">
                    <ConfigField configKey="connection.guardStrength" label="Guard Value">
                      <SteppedValueSlider min={0} max={200000} step={1000} value={connection.guardStrength} onChange={(event) => {
                        onUpdate(connection.id, (draft) => { draft.guardStrength = Number(event.currentTarget.value); });
                      }} />
                    </ConfigField>
                  </div>
                  <details className="raw-details">
                    <summary>Advanced</summary>
                    <div className="form-grid form-grid--three">
                      <ConfigField configKey="connection.guardZone" label="Guard Zone">
                        <NativeSelect value={connection.guardZone ?? ""} onChange={(event) => {
                          const value = event.currentTarget.value;
                          onUpdate(connection.id, (draft) => { draft.guardZone = value || undefined; });
                        }}>
                          <option value="">Default</option>
                          {design.zones.map((zone) => <option key={zone.id} value={zone.name}>{zone.name}</option>)}
                        </NativeSelect>
                      </ConfigField>
                      <ConfigField configKey="connection.guardWeeklyIncrement" label="Guard Weekly Increment">
                        <Input
                          type="number"
                          step="0.01"
                          value={formatNumberInput(connection.guardWeeklyIncrement)}
                          onChange={(event) => {
                            onUpdate(connection.id, (draft) => { draft.guardWeeklyIncrement = parseNumberInput(event.currentTarget.value); });
                          }}
                        />
                      </ConfigField>
                      <ConfigField configKey="connection.guardRandomization" label="Guard Randomization">
                        <Input
                          type="number"
                          step="0.01"
                          value={formatNumberInput(connection.guardRandomization)}
                          onChange={(event) => {
                            onUpdate(connection.id, (draft) => { draft.guardRandomization = parseNumberInput(event.currentTarget.value); });
                          }}
                        />
                      </ConfigField>
                    </div>
                    <div className="form-grid form-grid--two">
                      <ConfigField configKey="connection.guardMatchGroup" label="Guard Match Group">
                        <Input value={connection.guardMatchGroup ?? ""} onChange={(event) => {
                          const value = event.currentTarget.value.trim();
                          onUpdate(connection.id, (draft) => { draft.guardMatchGroup = value || undefined; });
                        }} />
                      </ConfigField>
                    </div>
                    <div className="checks checks--vertical">
                      <CheckField checked={connection.guardEscape ?? false} onCheckedChange={(checked) => onUpdate(connection.id, (draft) => { draft.guardEscape = checked; })}>Guards can escape</CheckField>
                      {connection.type === "Direct" ? (
                        <CheckField checked={connection.simTurnSquad ?? true} onCheckedChange={(checked) => onUpdate(connection.id, (draft) => { draft.simTurnSquad = checked; })}>Sim-turn squad</CheckField>
                      ) : null}
                    </div>
                    {connection.type === "Portal" ? (() => {
                      const draft = portalRuleDraftFor(connection);
                      return (
                        <>
                          <div className="form-grid form-grid--two">
                            <ConfigField configKey="connection.portalPlacementRulesFrom" label="Portal Rules From (JSON)">
                              <RmgJsonEditor
                                ariaLabel={`Portal Rules From JSON editor for ${connection.name}`}
                                className="rmg-json-editor--mini"
                                value={draft.from}
                                onChange={(value) => updatePortalRules(connection, "from", value)}
                              />
                            </ConfigField>
                            <ConfigField configKey="connection.portalPlacementRulesTo" label="Portal Rules To (JSON)">
                              <RmgJsonEditor
                                ariaLabel={`Portal Rules To JSON editor for ${connection.name}`}
                                className="rmg-json-editor--mini"
                                value={draft.to}
                                onChange={(value) => updatePortalRules(connection, "to", value)}
                              />
                            </ConfigField>
                          </div>
                          {draft.fromError ? <Alert tone="danger">Portal Rules From: {draft.fromError}</Alert> : null}
                          {draft.toError ? <Alert tone="danger">Portal Rules To: {draft.toError}</Alert> : null}
                        </>
                      );
                    })() : null}
                  </details>
                </article>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionEndpoint({
  name,
  role
}: {
  name: string;
  role: DesignZoneRole | undefined;
}): JSX.Element {
  return (
    <div className="connection-endpoint">
      <span className="connection-endpoint__name">{name}</span>
      <span className={`connection-endpoint__role connection-endpoint__role--${(role ?? "neutral").toLowerCase()}`}>
        {role ?? "Unknown"}
      </span>
    </div>
  );
}
