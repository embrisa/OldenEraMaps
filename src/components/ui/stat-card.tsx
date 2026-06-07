import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}

export function StatCard({
  className,
  label,
  value,
  icon,
  compact = false,
  ...props
}: StatCardProps): React.JSX.Element {
  return (
    <div className={cn("stat-card", compact && "stat-card--compact", className)} {...props}>
      {icon ? <div className="stat-card__icon-shell">{icon}</div> : null}
      <div className="stat-details">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}
