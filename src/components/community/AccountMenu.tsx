import { FolderKanban, LogIn, LogOut, Pencil, Trash2, UserCircle } from "lucide-react";
import type { JSX } from "react";
import type { CommunityAuthProfile } from "@/community/auth";
import { Button } from "@/components/ui/button";

export function AccountMenu({
  status,
  profile,
  onSignIn,
  onSignOut,
  onMyMaps,
  onEditProfile,
  onDeleteAccount
}: {
  status: "loading" | "signed-out" | "signed-in";
  profile: CommunityAuthProfile | null;
  onSignIn(): void;
  onSignOut(): void;
  onMyMaps(): void;
  onEditProfile(): void;
  onDeleteAccount(): void;
}): JSX.Element {
  if (status === "signed-in" && profile) {
    return (
      <div className="account-menu">
        <div className="account-menu__identity">
          {profile.avatarUrl ? <img className="account-menu__avatar" src={profile.avatarUrl} alt="" /> : <UserCircle className="account-menu__avatar account-menu__avatar--placeholder" size={24} />}
          <span className="account-menu__name" title={profile.displayName}>{profile.displayName}</span>
        </div>
        <div className="account-menu__actions">
          <Button size="sm" variant="ghost" onClick={onMyMaps}><FolderKanban size={14} />My maps</Button>
          <Button size="sm" variant="ghost" onClick={onEditProfile}><Pencil size={14} />Author name</Button>
          <Button size="sm" variant="danger" onClick={onDeleteAccount}><Trash2 size={14} />Delete account</Button>
          <Button size="sm" variant="ghost" onClick={onSignOut}><LogOut size={14} />Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="ghost" onClick={onSignIn} disabled={status === "loading"}>
      <LogIn size={16} />{status === "loading" ? "Checking session" : "Sign in"}
    </Button>
  );
}
