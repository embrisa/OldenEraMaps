import { Trash2 } from "lucide-react";
import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";

export function DeleteAccountDialog({
  open,
  onOpenChange,
  submitting,
  error,
  onConfirm
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  submitting: boolean;
  error?: string;
  onConfirm(): void;
}): JSX.Element {
  const [confirmed, setConfirmed] = useState(false);

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) setConfirmed(false);
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="auth-dialog">
        <div className="dialog-heading">
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This permanently deletes your signed-in account. Uploaded maps and related community data are removed by database cascade.
          </DialogDescription>
        </div>
        {error ? <div className="alert alert--danger" role="alert">{error}</div> : null}
        <label className="danger-confirmation">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
          />
          <span>I understand this cannot be undone.</span>
        </label>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!confirmed || submitting}>
            <Trash2 size={14} />{submitting ? "Deleting..." : "Delete account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
