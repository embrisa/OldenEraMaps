import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";
import {
  addConnectionBetween,
  type TemplateDesign,
} from "@/design";
import { clampConnectionMenuPoint, DesignBoard, type BoardSize } from "@/components/designBoard";
import { ZoneHoverCard, type ZoneHoverState } from "@/components/ZoneHoverCard";
import type { Point } from "@/types";
import { Button } from "@/components/ui/button";

interface DesignBoardCanvasProps {
  design: TemplateDesign;
  selectedZoneId: string;
  selectedConnectionId: string;
  roadMode: boolean;
  onCanvasChange?(canvas: HTMLCanvasElement | null): void;
  onSelectZone(zoneId: string): void;
  onSelectConnection(connectionId: string): void;
  onMoveZone(zoneId: string, position: Point): void;
  onConnectZones(nextDesign: TemplateDesign, selectedZoneId: string): void;
  onEditConnection(connectionId: string): void;
  onDeleteConnection(connectionId: string): void;
}

export function DesignBoardCanvas({
  design,
  selectedZoneId,
  selectedConnectionId,
  roadMode,
  onCanvasChange,
  onSelectZone,
  onSelectConnection,
  onMoveZone,
  onConnectZones,
  onEditConnection,
  onDeleteConnection
}: DesignBoardCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<DesignBoard | null>(null);
  const connectionMenuRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<ZoneHoverState | null>(null);
  const [hoverCardAnchorRect, setHoverCardAnchorRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  /** `anchor` is a board fraction so the menu follows the connection when the board is resized. */
  const [connectionMenu, setConnectionMenu] = useState<{ connectionId: string; anchor: Point } | null>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>({ width: 0, height: 0 });
  const [connectionMenuSize, setConnectionMenuSize] = useState<BoardSize>({ width: 0, height: 0 });
  const callbacksRef = useRef({ onSelectZone, onSelectConnection, onMoveZone, onConnectZones, onEditConnection, onDeleteConnection });
  callbacksRef.current = { onSelectZone, onSelectConnection, onMoveZone, onConnectZones, onEditConnection, onDeleteConnection };
  const hoveredZone = useMemo(
    () => design.zones.find((zone) => zone.id === hover?.zoneId),
    [design.zones, hover?.zoneId]
  );
  const selectedConnection = useMemo(
    () => design.connections.find((connection) => connection.id === selectedConnectionId),
    [design.connections, selectedConnectionId]
  );

  useEffect(() => {
    onCanvasChange?.(canvasRef.current);
    return () => onCanvasChange?.(null);
  }, [onCanvasChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const board = new DesignBoard(canvas, {
      selectZone(zoneId) {
        clearHover();
        callbacksRef.current.onSelectZone(zoneId);
      },
      selectConnection(connectionId, anchor) {
        if (connectionId) clearHover();
        callbacksRef.current.onSelectConnection(connectionId);
        if (!connectionId || !anchor) {
          setConnectionMenu(null);
          return;
        }
        setConnectionMenu({ connectionId, anchor });
      },
      resized(width, height) {
        setBoardSize((current) => current.width === width && current.height === height ? current : { width, height });
      },
      moveZone(zoneId, position) {
        callbacksRef.current.onMoveZone(zoneId, position);
      },
      connectZones(fromZoneId, toZoneId, currentDesign) {
        const next = addConnectionBetween(currentDesign, fromZoneId, toZoneId);
        if (next === currentDesign) {
          callbacksRef.current.onSelectZone(fromZoneId);
          return;
        }
        callbacksRef.current.onConnectZones(next, toZoneId);
      },
      hoverZone(zoneId, point, hintId) {
        if (!zoneId || !point) {
          setHover(null);
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const viewportPoint = { x: rect.left + point.x, y: rect.top + point.y };
        setHover((currentHover) => {
          if (currentHover?.zoneId === zoneId && currentHover.hintId === hintId && currentHover.point.x === viewportPoint.x && currentHover.point.y === viewportPoint.y) return currentHover;
          return { zoneId, point: viewportPoint, hintId };
        });
        setHoverCardAnchorRect(readHoverCardAnchorRect(canvas));
      }
    });
    boardRef.current = board;
    return () => {
      board.destroy();
      boardRef.current = null;
    };
  }, []);

  useEffect(() => {
    boardRef.current?.update(design, selectedZoneId, selectedConnectionId, roadMode);
  }, [design, selectedZoneId, selectedConnectionId, roadMode]);

  useEffect(() => {
    if (hover && !hoveredZone) {
      setHover(null);
    }
  }, [hover, hoveredZone]);

  useEffect(() => {
    if (!selectedConnectionId || !selectedConnection) {
      setConnectionMenu(null);
      return;
    }
    setConnectionMenu((current) => current?.connectionId === selectedConnectionId ? current : null);
  }, [selectedConnection, selectedConnectionId]);

  const connectionMenuOpen = Boolean(connectionMenu && selectedConnection);
  useLayoutEffect(() => {
    const menu = connectionMenuRef.current;
    if (!menu) return;
    const next = { width: menu.offsetWidth, height: menu.offsetHeight };
    setConnectionMenuSize((current) => current.width === next.width && current.height === next.height ? current : next);
  }, [connectionMenuOpen, selectedConnection?.name]);

  const connectionMenuPoint = connectionMenu
    ? clampConnectionMenuPoint(connectionMenu.anchor, boardSize, connectionMenuSize)
    : null;

  return (
    <>
      <div className="design-board-wrap">
        <canvas ref={canvasRef} className="design-board" aria-label="Schematic design board" />
        {connectionMenuPoint && selectedConnection ? (
          <div
            ref={connectionMenuRef}
            className="board-connection-actions"
            // max-content keeps the measured width independent of how close to the edge the menu sits.
            style={{ left: connectionMenuPoint.x, top: connectionMenuPoint.y, width: "max-content" }}
            role="group"
            aria-label={`Actions for ${selectedConnection.name}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="board-connection-actions__label">{selectedConnection.name}</span>
            <Button
              size="icon"
              variant="blue"
              aria-label={`Edit ${selectedConnection.name}`}
              title={`Edit ${selectedConnection.name}`}
              onClick={() => callbacksRef.current.onEditConnection(selectedConnection.id)}
            >
              <Pencil size={16} />
            </Button>
            <Button
              size="icon"
              variant="danger"
              aria-label={`Delete ${selectedConnection.name}`}
              title={`Delete ${selectedConnection.name}`}
              onClick={() => callbacksRef.current.onDeleteConnection(selectedConnection.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ) : null}
        <ZoneHoverCard
          zone={hoveredZone}
          hover={hover}
          anchorRect={hoverCardAnchorRect}
        />
      </div>
      <SchematicBoardLegend />
    </>
  );

  function clearHover(): void {
    setHover(null);
  }
}

function readHoverCardAnchorRect(canvas: HTMLCanvasElement): { left: number; top: number; width: number; height: number } {
  const inspector = document.querySelector<HTMLElement>(".studio-side .inspector-card");
  if (inspector) {
    const inspectorRect = inspector.getBoundingClientRect();
    if (inspectorRect.width > 0 && inspectorRect.height > 0) {
      return { left: inspectorRect.left, top: inspectorRect.top, width: inspectorRect.width, height: inspectorRect.height };
    }
  }

  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth || Number.parseFloat(canvas.style.width) || 0;
  const height = rect.height || canvas.clientHeight || Number.parseFloat(canvas.style.height) || 0;
  return { left: rect.left, top: rect.top, width, height };
}

export function SchematicBoardLegend(): JSX.Element {
  const legendItems = [
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">👤</span>, label: "Badge: role or player" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🎨</span>, label: "Same fill color: matching zone settings" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🟢</span>, label: "Green border: easy zone", group: "border", tone: "easy" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🟠</span>, label: "Orange border: medium zone", group: "border", tone: "medium" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🔴</span>, label: "Red border: hard zone", group: "border", tone: "hard" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🏰</span>, label: "City Hold win condition" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🌱</span>, label: "Natural expansion" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">⚔</span>, label: "Guard pressure" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">💰</span>, label: "Resource / eco pressure" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🧱</span>, label: "Structure density" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🌿</span>, label: "Biome override" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🏘</span>, label: "Extra cities" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🏚</span>, label: "Neutral ruins" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">🚫</span>, label: "Roads disabled" },
    { symbol: <span className="schematic-board-legend__emoji" aria-hidden="true">⛔</span>, label: "Footholds disabled" },
  ];

  return (
    <div className="schematic-board-legend" role="list" aria-label="Schematic board legend">
      {legendItems.map((item) => (
        <span
          className={`schematic-board-legend__item${item.group ? ` schematic-board-legend__item--${item.group}` : ""}${item.tone ? ` schematic-board-legend__item--${item.tone}` : ""}`}
          role="listitem"
          key={item.label}
        >
          {item.symbol}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
