import { LogIn } from "lucide-react";
import type { JSX } from "react";
import { OAUTH_PROVIDERS, type CommunityAuthProvider } from "@/community/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";

const PROVIDER_LABELS: Record<CommunityAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord"
};

export function SignInDialog({
  open,
  onOpenChange,
  message = "Sign in with a configured OAuth provider to continue.",
  error,
  onProvider
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  message?: string;
  error?: string | null;
  onProvider(provider: CommunityAuthProvider): void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auth-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </div>
        </div>
        <div className="auth-provider-list">
          {OAUTH_PROVIDERS.map((provider) => (
            <Button key={provider} variant={provider === "google" ? "primary" : "default"} onClick={() => onProvider(provider)}>
              <LogIn size={15} />Continue with {PROVIDER_LABELS[provider]}
            </Button>
          ))}
        </div>
        {error ? <div className="alert alert--danger">{error}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
