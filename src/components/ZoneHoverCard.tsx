import type { CSSProperties, JSX } from "react";
import { createPortal } from "react-dom";
import { zoneHoverSections } from "@/components/zoneHoverContent";
import type { DesignZone } from "@/design";
import type { Point } from "@/types";

export interface ZoneHoverState {
  zoneId: string;
  point: Point;
  hintId?: string;
}

interface ZoneHoverCardProps {
  zone: DesignZone | undefined;
  hover: ZoneHoverState | null;
  anchorRect: { left: number; top: number; width: number; height: number };
}

export function ZoneHoverCard({ zone, hover, anchorRect }: ZoneHoverCardProps): JSX.Element | null {
  if (!zone || !hover) return null;

  const style = hoverCardPosition(anchorRect);
  const sections = zoneHoverSections(zone, hover.hintId);

  return createPortal(
    <aside
      className="zone-hover-card"
      style={style}
      role="tooltip"
      aria-label={`${zone.name} configuration`}
    >
      <header className="zone-hover-card__header">
        <div>
          <strong>{zone.name}</strong>
          <span>{zone.role} · {zone.quality}</span>
        </div>
        <span>{zone.castleCount} {zone.neutralCastlesAsRuins && zone.role === "Neutral" ? (zone.castleCount === 1 ? "ruin" : "ruins") : (zone.castleCount === 1 ? "city" : "cities")}</span>
      </header>
      <div className="zone-hover-card__sections">
        {sections.map((section) => (
          <section key={section.title} className="zone-hover-card__section">
            <h3>{section.title}</h3>
            <div className="zone-hover-card__value-grid">
              {section.items.map((item, index) => (
                <span key={item.label} className={index % 2 === 0 ? "zone-hover-card__value" : "zone-hover-card__value zone-hover-card__value--right"}>
                  {item.value}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>,
    document.body
  );
}

export function hoverCardPosition(anchorRect: { left: number; top: number; width: number; height: number }): CSSProperties {
  const width = Math.min(Math.max(320, anchorRect.width), window.innerWidth - 16);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxHeight = Math.max(120, viewportHeight - 16);
  const preferredLeft = anchorRect.left + Math.max(0, anchorRect.width - width);
  const preferredTop = anchorRect.top;
  const left = clamp(preferredLeft, 8, Math.max(8, viewportWidth - width - 8));
  const top = clamp(preferredTop, 8, Math.max(8, viewportHeight - maxHeight - 8));
  return { left, maxHeight, position: "fixed", top, width };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
