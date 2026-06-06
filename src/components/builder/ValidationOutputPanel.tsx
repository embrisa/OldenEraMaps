import { FileJson } from "lucide-react";
import type { JSX } from "react";
import type { ValidationResult } from "@/types";
import type { TemplateAnalysis, TemplateAnalysisFindingSeverity } from "@/analysis/templateAnalysis";
import { RmgJsonEditor } from "@/components/builder/RmgJsonEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/builder/formHelpers";

export function BuilderValidationMessages({ validation }: { validation: ValidationResult }): JSX.Element | null {
  if (validation.errors.length === 0 && validation.warnings.length === 0) return null;

  return (
    <div className="builder-validation-summary messages" aria-label="Builder validation">
      {validation.errors.map((message) => <Alert key={message} tone="danger">{message}</Alert>)}
      {validation.warnings.map((message) => <Alert key={message} tone="warning">{message}</Alert>)}
      {validation.errors.length > 0 ? (
        <Alert tone="warning">Fix builder errors to push a fresh JSON snapshot. The editor is showing the last valid builder JSON.</Alert>
      ) : null}
    </div>
  );
}

export function ValidationOutputPanel({
  validation,
  showBuilderValidationMessages = true,
  analysis,
  jsonValue,
  jsonDirty,
  jsonParseError,
  jsonApplyError,
  jsonValidationErrors,
  onJsonChange
}: {
  validation: ValidationResult;
  showBuilderValidationMessages?: boolean;
  analysis?: TemplateAnalysis | null;
  jsonValue: string;
  jsonDirty: boolean;
  jsonParseError?: string;
  jsonApplyError?: string;
  jsonValidationErrors: string[];
  onJsonChange(value: string, parseError?: string): void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle><FileJson size={17} />Validation & JSON</CardTitle>
      </CardHeader>
      <CardContent className="output-grid">
        <div className="messages">
          {showBuilderValidationMessages ? <BuilderValidationMessages validation={validation} /> : null}
          {jsonDirty ? <Alert tone="warning">JSON edits will auto-apply as soon as they parse and validate.</Alert> : null}
          {jsonParseError ? <Alert tone="danger">{jsonParseError}</Alert> : null}
          {jsonApplyError ? <Alert tone="danger">{jsonApplyError}</Alert> : null}
          {jsonValidationErrors.map((message) => <Alert key={`json-${message}`} tone="danger">{message}</Alert>)}
          {validation.errors.length === 0 ? <Alert tone="success">Ready to export.</Alert> : null}
        </div>
        {analysis ? <MapAnalysisPanel analysis={analysis} /> : null}
        <RmgJsonEditor value={jsonValue} onChange={onJsonChange} />
      </CardContent>
    </Card>
  );
}

function MapAnalysisPanel({ analysis }: { analysis: TemplateAnalysis }): JSX.Element {
  const scoreLabel = analysis.balanceScore === null ? "N/A" : `${analysis.balanceScore}/100`;
  const visibleRows = analysis.zoneRows.slice(0, 8);
  const hiddenRowCount = Math.max(0, analysis.zoneRows.length - visibleRows.length);

  return (
    <section className="map-analysis-panel" aria-label="Map analysis">
      <div className="map-analysis-panel__header">
        <div>
          <h3>Map analysis</h3>
          <span>{analysis.balanceApplicable ? "Template-level balance estimate" : analysis.balanceInapplicableReason}</span>
        </div>
        <strong>{scoreLabel}</strong>
      </div>

      <div className="map-analysis-panel__findings">
        {analysis.findings.map((finding) => (
          <span key={`${finding.severity}-${finding.message}`} className={`map-analysis-finding map-analysis-finding--${finding.severity}`}>
            {findingLabel(finding.severity)}: {finding.message}
          </span>
        ))}
      </div>

      <div className="map-analysis-stats">
        <span><strong>{analysis.summary.zoneCount}</strong>Zones</span>
        <span><strong>{analysis.summary.playerZoneCount}</strong>Player starts</span>
        <span><strong>{analysis.summary.neutralCastleZoneCount}</strong>Neutral castles</span>
        <span><strong>{analysis.summary.connectionCount}</strong>Connections</span>
        <span><strong>{formatValue(analysis.summary.totalTreasure)}</strong>Treasure</span>
        <span><strong>{formatValue(analysis.summary.totalResources)}</strong>Resources</span>
      </div>

      {analysis.playerStarts.length > 0 ? (
        <div className="map-analysis-starts">
          {analysis.playerStarts.map((start) => (
            <span key={`${start.player}-${start.zoneName}`}>
              <strong>{start.player}</strong>
              {formatValue(start.startWealth)} start · {start.nearestOpponentDistance === null ? "no opponent route" : `${start.nearestOpponentDistance} hops to opponent`}
            </span>
          ))}
        </div>
      ) : null}

      <div className="map-analysis-zones">
        {visibleRows.map((row) => (
          <span key={row.zoneName}>
            <strong>{row.zoneName}</strong>
            {row.role} · degree {row.degree}
          </span>
        ))}
        {hiddenRowCount > 0 ? <span>+{hiddenRowCount} more zones</span> : null}
      </div>
    </section>
  );
}

function findingLabel(severity: TemplateAnalysisFindingSeverity): string {
  if (severity === "warning") return "Warning";
  if (severity === "positive") return "Good";
  return "Note";
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}
