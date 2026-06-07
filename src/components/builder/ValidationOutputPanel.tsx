import { useState } from "react";
import {
  FileJson,
  AlertTriangle,
  CheckCircle2,
  Info,
  Coins,
  TrendingUp,
  Swords,
  Castle,
  Activity,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin
} from "lucide-react";
import type { JSX } from "react";
import type { ValidationResult } from "@/types";
import type { TemplateAnalysis, TemplateAnalysisFindingSeverity } from "@/analysis/templateAnalysis";
import type { RmgDiagnosticSummary } from "@/rmgDiagnostics";
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
  templateDiagnostics,
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
  templateDiagnostics?: RmgDiagnosticSummary;
  showBuilderValidationMessages?: boolean;
  analysis?: TemplateAnalysis | null;
  jsonValue: string;
  jsonDirty: boolean;
  jsonParseError?: string;
  jsonApplyError?: string;
  jsonValidationErrors: string[];
  onJsonChange(value: string, parseError?: string): void;
}): JSX.Element {
  const diagErrors = templateDiagnostics?.errors ?? [];
  const diagWarnings = templateDiagnostics?.warnings ?? [];
  const diagInfos = templateDiagnostics?.infos ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle><FileJson size={17} />Validation & JSON</CardTitle>
      </CardHeader>
      <CardContent className="output-grid">
        <div className="messages">
          {showBuilderValidationMessages ? <BuilderValidationMessages validation={validation} /> : null}
          {diagErrors.map((diagnostic) => <Alert key={`diag-${diagnostic.code}-${diagnostic.message}`} tone="danger">{diagnostic.message}</Alert>)}
          {diagWarnings.map((diagnostic) => <Alert key={`diag-${diagnostic.code}-${diagnostic.message}`} tone="warning">{diagnostic.message}</Alert>)}
          {jsonDirty ? <Alert tone="warning">JSON edits will auto-apply as soon as they parse and validate.</Alert> : null}
          {jsonParseError ? <Alert tone="danger">{jsonParseError}</Alert> : null}
          {jsonApplyError ? <Alert tone="danger">{jsonApplyError}</Alert> : null}
          {jsonValidationErrors.map((message) => <Alert key={`json-${message}`} tone="danger">{message}</Alert>)}
          {validation.errors.length === 0 && diagErrors.length === 0
            ? <Alert tone="success">{diagWarnings.length > 0 ? "Ready to export with warnings." : "Ready to export."}</Alert>
            : null}
          {diagInfos.length > 0 ? (
            <details className="diagnostic-details">
              <summary>Troubleshooting</summary>
              <div className="diagnostic-details__body">
                {diagInfos.map((diagnostic) => <Alert key={`diag-${diagnostic.code}-${diagnostic.message}`} tone="info">{diagnostic.message}</Alert>)}
              </div>
            </details>
          ) : null}
        </div>
        {analysis ? <MapAnalysisPanel analysis={analysis} /> : null}
        <RmgJsonEditor value={jsonValue} onChange={onJsonChange} />
      </CardContent>
    </Card>
  );
}

function MapAnalysisPanel({ analysis }: { analysis: TemplateAnalysis }): JSX.Element {
  const [activeTab, setActiveTab] = useState<"findings" | "starts" | "zones">("findings");
  const [showAllZones, setShowAllZones] = useState(false);

  const scoreLabel = analysis.balanceScore === null ? "N/A" : `${analysis.balanceScore}/100`;

  let balanceStatus = "N/A";
  let balanceColorClass = "score-neutral";
  if (analysis.balanceScore !== null) {
    if (analysis.balanceScore >= 90) {
      balanceStatus = "Excellent Balance";
      balanceColorClass = "score-excellent";
    } else if (analysis.balanceScore >= 70) {
      balanceStatus = "Fair Balance";
      balanceColorClass = "score-fair";
    } else {
      balanceStatus = "Imbalanced";
      balanceColorClass = "score-poor";
    }
  }

  const warningsCount = analysis.findings.filter((f) => f.severity === "warning").length;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const scoreVal = analysis.balanceScore !== null ? analysis.balanceScore : 0;
  const strokeDashoffset = circumference - (scoreVal / 100) * circumference;

  const visibleRows = showAllZones ? analysis.zoneRows : analysis.zoneRows.slice(0, 8);

  const maxStartWealth = Math.max(...analysis.playerStarts.map((p) => p.startWealth), 1);
  const maxExpansionValue = Math.max(...analysis.playerStarts.map((p) => p.expansionValue), 1);

  return (
    <section className="map-analysis-panel" aria-label="Map analysis">
      <div className="map-analysis-dashboard-header">
        <div className="radial-gauge-container">
          <svg className="radial-gauge" width="72" height="72" viewBox="0 0 72 72">
            <circle
              className="radial-gauge-bg"
              cx="36"
              cy="36"
              r={radius}
              strokeWidth="5"
            />
            {analysis.balanceScore !== null && (
              <circle
                className={`radial-gauge-progress ${balanceColorClass}`}
                cx="36"
                cy="36"
                r={radius}
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
              />
            )}
          </svg>
          <div className="radial-gauge-text">
            <span className="gauge-score">{scoreLabel}</span>
          </div>
        </div>

        <div className="map-analysis-status">
          <div className="status-title-row">
            <h3>Map analysis</h3>
            {analysis.balanceScore !== null && (
              <span className={`balance-badge ${balanceColorClass}`}>
                {balanceStatus}
              </span>
            )}
          </div>
          <span className="status-description">
            {analysis.balanceApplicable
              ? "Template-level balance estimate based on starting wealth and distance"
              : analysis.balanceInapplicableReason}
          </span>
        </div>
      </div>

      <div className="map-analysis-stats-grid">
        <div className="stat-card">
          <MapPin className="stat-icon text-gold" size={14} />
          <div className="stat-details">
            <span className="stat-value">{analysis.summary.zoneCount}</span>
            <span className="stat-label">Zones</span>
          </div>
        </div>
        <div className="stat-card">
          <Swords className="stat-icon text-red" size={14} />
          <div className="stat-details">
            <span className="stat-value">{analysis.summary.playerZoneCount}</span>
            <span className="stat-label">Starts</span>
          </div>
        </div>
        <div className="stat-card">
          <Castle className="stat-icon text-blue" size={14} />
          <div className="stat-details">
            <span className="stat-value">{analysis.summary.neutralCastleZoneCount}</span>
            <span className="stat-label">Castles</span>
          </div>
        </div>
        <div className="stat-card">
          <Activity className="stat-icon text-violet" size={14} />
          <div className="stat-details">
            <span className="stat-value">{analysis.summary.connectionCount}</span>
            <span className="stat-label">Paths</span>
          </div>
        </div>
        <div className="stat-card">
          <Coins className="stat-icon text-gold" size={14} />
          <div className="stat-details">
            <span className="stat-value">{formatValue(analysis.summary.totalTreasure)}</span>
            <span className="stat-label">Treasure</span>
          </div>
        </div>
        <div className="stat-card">
          <TrendingUp className="stat-icon text-green" size={14} />
          <div className="stat-details">
            <span className="stat-value">{formatValue(analysis.summary.totalResources)}</span>
            <span className="stat-label">Resources</span>
          </div>
        </div>
      </div>

      <div className="analysis-tabs">
        <button
          type="button"
          className={`analysis-tab-btn ${activeTab === "findings" ? "active" : ""}`}
          onClick={() => setActiveTab("findings")}
        >
          Findings
          {analysis.findings.length > 0 && (
            <span className={`tab-badge ${warningsCount > 0 ? "badge-warning" : "badge-info"}`}>
              {analysis.findings.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`analysis-tab-btn ${activeTab === "starts" ? "active" : ""}`}
          onClick={() => setActiveTab("starts")}
        >
          Player Starts
          {analysis.playerStarts.length > 0 && (
            <span className="tab-badge badge-neutral">
              {analysis.playerStarts.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`analysis-tab-btn ${activeTab === "zones" ? "active" : ""}`}
          onClick={() => setActiveTab("zones")}
        >
          Zones
          <span className="tab-badge badge-neutral">
            {analysis.zoneRows.length}
          </span>
        </button>
      </div>

      <div className="analysis-tab-content">
        {activeTab === "findings" && (
          <div className="tab-pane findings-pane">
            {analysis.findings.length === 0 ? (
              <div className="findings-empty-state">
                <Sparkles size={22} className="text-gold" />
                <p>No warnings. Template balance is looking optimal!</p>
              </div>
            ) : (
              <div className="findings-list">
                {analysis.findings.map((finding, idx) => (
                  <div
                    key={`${finding.severity}-${idx}-${finding.message}`}
                    className={`finding-card finding-${finding.severity}`}
                  >
                    <div className="finding-icon-wrapper">
                      {finding.severity === "warning" && <AlertTriangle size={14} className="text-warning" />}
                      {finding.severity === "positive" && <CheckCircle2 size={14} className="text-success" />}
                      {finding.severity === "info" && <Info size={14} className="text-info" />}
                    </div>
                    <div className="finding-content">
                      <span className="finding-severity-label">{findingLabel(finding.severity)}</span>
                      <p className="finding-message">{finding.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "starts" && (
          <div className="tab-pane starts-pane">
            {analysis.playerStarts.length === 0 ? (
              <div className="findings-empty-state">
                <p>No player starts available for analysis.</p>
              </div>
            ) : (
              <div className="starts-list">
                {analysis.playerStarts.map((start) => {
                  const wealthPct = Math.round((start.startWealth / maxStartWealth) * 100);
                  const expansionPct = Math.round((start.expansionValue / maxExpansionValue) * 100);

                  return (
                    <div key={`${start.player}-${start.zoneName}`} className="player-start-card">
                      <div className="player-start-card-header">
                        <span className={`player-badge ${start.player.toLowerCase().replace(/\s+/g, "-")}`}>
                          {start.player}
                        </span>
                        <span className="player-zone-name">{start.zoneName}</span>
                      </div>

                      <div className="player-metrics-grid">
                        <div className="player-metric-item">
                          <div className="player-metric-label">
                            <Coins size={12} className="text-gold" /> Start Wealth
                          </div>
                          <div className="player-metric-value">{formatValue(start.startWealth)}</div>
                          <div className="metric-bar-bg" title={`${wealthPct}% of max player start wealth`}>
                            <div className="metric-bar-fill wealth-fill" style={{ width: `${wealthPct}%` }} />
                          </div>
                        </div>

                        <div className="player-metric-item">
                          <div className="player-metric-label">
                            <TrendingUp size={12} className="text-green" /> Expansion Value
                          </div>
                          <div className="player-metric-value">{formatValue(start.expansionValue)}</div>
                          <div className="metric-bar-bg" title={`${expansionPct}% of max player expansion value`}>
                            <div className="metric-bar-fill expansion-fill" style={{ width: `${expansionPct}%` }} />
                          </div>
                        </div>

                        <div className="player-metric-item">
                          <div className="player-metric-label">
                            <Swords size={12} className="text-red" /> Opponent Distance
                          </div>
                          <div className="player-metric-value">
                            {start.nearestOpponentDistance === null ? "None" : `${start.nearestOpponentDistance} hops`}
                          </div>
                        </div>

                        <div className="player-metric-item">
                          <div className="player-metric-label">
                            <Castle size={12} className="text-blue" /> Castle Proximity
                          </div>
                          <div className="player-metric-value">
                            {start.neutralCastleDistance === null ? "None" : `${start.neutralCastleDistance} hops`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "zones" && (
          <div className="tab-pane zones-pane">
            <div className="zones-list">
              {visibleRows.map((row) => (
                <div key={row.zoneName} className="zone-row-card">
                  <div className="zone-row-name-col">
                    <strong className="zone-row-name">{row.zoneName}</strong>
                    <span className={`zone-role-badge role-${row.role.toLowerCase().replace(/\s+/g, "-")}`}>
                      {row.role}
                    </span>
                  </div>
                  
                  <div className="zone-row-metrics">
                    <div className="zone-row-metric" title="Degree (paths count)">
                      <Activity size={11} className="text-violet" />
                      <span>{row.degree}</span>
                    </div>
                    <div className="zone-row-metric" title="Treasure Value">
                      <Coins size={11} className="text-gold" />
                      <span>{formatValue(row.treasure)}</span>
                    </div>
                    <div className="zone-row-metric" title="Resource Value">
                      <TrendingUp size={11} className="text-green" />
                      <span>{formatValue(row.resources)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {analysis.zoneRows.length > 8 && (
              <button
                type="button"
                className="show-all-zones-btn"
                onClick={() => setShowAllZones(!showAllZones)}
              >
                {showAllZones ? (
                  <>
                    Show Less <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    Show All ({analysis.zoneRows.length}) <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        )}
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
