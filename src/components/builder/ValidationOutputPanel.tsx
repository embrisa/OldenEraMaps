import { FileJson } from "lucide-react";
import type { JSX } from "react";
import type { ValidationResult } from "@/types";
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
  jsonValue,
  jsonDirty,
  jsonParseError,
  jsonApplyError,
  jsonValidationErrors,
  onJsonChange
}: {
  validation: ValidationResult;
  showBuilderValidationMessages?: boolean;
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
        <RmgJsonEditor value={jsonValue} onChange={onJsonChange} />
      </CardContent>
    </Card>
  );
}
