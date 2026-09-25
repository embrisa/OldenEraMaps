import { Pencil } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import { validateAuthorDisplayName } from "@/community/textValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";

export function EditAuthorNameDialog({
  open,
  onOpenChange,
  currentName,
  submitting = false,
  error,
  onSubmit
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  currentName: string;
  submitting?: boolean;
  error?: string;
  onSubmit(displayName: string): void;
}): JSX.Element {
  const [displayName, setDisplayName] = useState(() => editableName(currentName));
  const wasOpenRef = useRef(false);
  const currentNameRef = useRef(currentName);

  // Seed the field only when the dialog opens; auth events that rebuild the profile while it is open
  // must not wipe what the user typed.
  useEffect(() => {
    const opening = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (opening) setDisplayName(editableName(currentName));
  }, [currentName, open]);

  // A name that finishes loading after the dialog opened still fills an untouched field.
  useEffect(() => {
    const previousName = currentNameRef.current;
    currentNameRef.current = currentName;
    if (!open || previousName === currentName) return;
    setDisplayName((value) => (value === editableName(previousName) ? editableName(currentName) : value));
  }, [currentName, open]);

  const validation = validateAuthorDisplayName(displayName);
  const normalizedName = validation.ok ? validation.value : displayName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="dialog-heading">
          <div>
            <DialogTitle>Author name</DialogTitle>
            <DialogDescription>Choose the public author name shown on your uploaded maps. Use a handle, or leave it blank to publish as Anonymous Cartographer.</DialogDescription>
          </div>
        </div>
        <div className="reference-stack">
          {error ? <div className="alert alert--danger">{error}</div> : null}
          <div className="config-field">
            <label className="oe-field__label" htmlFor="account-author-name">Public author name</label>
            <Input
              id="account-author-name"
              value={displayName}
              placeholder="Anonymous Cartographer"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
            {!validation.ok ? <p className="community-upload-validation">{validation.errors[0]}</p> : null}
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!validation.ok || submitting) return;
                onSubmit(normalizedName);
              }}
              disabled={!validation.ok || submitting}
            >
              <Pencil size={14} />{submitting ? "Saving..." : "Save author name"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function editableName(name: string): string {
  return name === "Anonymous Cartographer" ? "" : name;
}
