import { describe, expect, it, vi } from "vitest";
import {
  communityAuthReducer,
  initialCommunityAuthState,
  profileFromUser,
  signInWithProvider,
  syncCurrentUserProfile,
  updateCurrentUserDisplayName
} from "../src/community/auth";

describe("community auth", () => {
  it("does not copy OAuth metadata into the local community profile", () => {
    const profile = profileFromUser({
      id: "user-1",
      email: "cartographer@example.test",
      user_metadata: {
        full_name: "Template Maker",
        avatar_url: "https://example.test/avatar.png"
      }
    } as never);

    expect(profile).toEqual({
      userId: "user-1",
      displayName: "Anonymous Cartographer",
      avatarUrl: null
    });
  });

  it("does not fall back to exposing the email local part as a public display name", () => {
    const profile = profileFromUser({
      id: "user-1",
      email: "cartographer@example.test",
      user_metadata: {}
    } as never);

    expect(profile.displayName).toBe("Anonymous Cartographer");
    expect(profile.avatarUrl).toBeNull();
  });

  it("requests minimal OAuth scopes for configured providers", async () => {
    const signInWithOAuth = vi.fn(() => ({ error: null }));
    const client = { auth: { signInWithOAuth } };
    vi.stubGlobal("window", { location: { origin: "https://maps.example.test" } });

    try {
      await signInWithProvider("google", client as never);
      await signInWithProvider("github", client as never);
      await signInWithProvider("discord", client as never);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(signInWithOAuth).toHaveBeenNthCalledWith(1, {
      provider: "google",
      options: { redirectTo: "https://maps.example.test", scopes: "openid" }
    });
    expect(signInWithOAuth).toHaveBeenNthCalledWith(2, {
      provider: "github",
      options: { redirectTo: "https://maps.example.test", queryParams: { scopes: "" } }
    });
    expect(signInWithOAuth).toHaveBeenNthCalledWith(3, {
      provider: "discord",
      options: { redirectTo: "https://maps.example.test", scopes: "identify" }
    });
  });

  it("reduces session changes into signed-in and signed-out state", () => {
    const signedIn = communityAuthReducer(initialCommunityAuthState(), {
      type: "session",
      session: {
        user: {
          id: "user-1",
          email: "maker@example.test",
          user_metadata: {
            name: "Map Maker"
          }
        }
      } as never
    });

    expect(signedIn.status).toBe("signed-in");
    expect(signedIn.profile?.displayName).toBe("Anonymous Cartographer");

    const signedOut = communityAuthReducer(signedIn, { type: "session", session: null });

    expect(signedOut.status).toBe("signed-out");
    expect(signedOut.profile).toBeNull();
  });

  it("can replace the signed-in profile display name without changing sessions", () => {
    const signedIn = communityAuthReducer(initialCommunityAuthState(), {
      type: "session",
      session: {
        user: {
          id: "user-1",
          email: "maker@example.test",
          user_metadata: { name: "OAuth Name" }
        }
      } as never
    });

    const updated = communityAuthReducer(signedIn, {
      type: "profile",
      profile: {
        userId: "user-1",
        displayName: "Map Handle",
        avatarUrl: null
      }
    });

    expect(updated.session).toBe(signedIn.session);
    expect(updated.profile?.displayName).toBe("Map Handle");
  });

  it("loads existing profile display names after OAuth session sync", async () => {
    const upsert = vi.fn(() => ({ error: null }));
    const maybeSingle = vi.fn(() => ({ data: { display_name: "Saved Handle", avatar_url: null }, error: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ upsert, select }));

    const profile = await syncCurrentUserProfile({
      user: {
        id: "user-1",
        email: "maker@example.test",
        user_metadata: { name: "OAuth Name" }
      }
    } as never, { from } as never);

    expect(profile.displayName).toBe("Saved Handle");
    expect(upsert).toHaveBeenCalledWith([{
      id: "user-1",
      display_name: "Anonymous Cartographer",
      avatar_url: null
    }], { ignoreDuplicates: true, onConflict: "id" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("updates the current profile display name and allows anonymous fallback", async () => {
    const profileEq = vi.fn(() => ({ error: null }));
    const profileUpdate = vi.fn(() => ({ eq: profileEq }));
    const from = vi.fn((table: string) => {
      expect(table).toBe("profiles");
      return { update: profileUpdate };
    });

    const profile = await updateCurrentUserDisplayName({
      userId: "user-1",
      displayName: "Old Name",
      avatarUrl: "https://example.test/avatar.png"
    }, "", { from } as never);

    expect(profile.displayName).toBe("Anonymous Cartographer");
    expect(profile.avatarUrl).toBeNull();
    expect(profileUpdate).toHaveBeenCalledWith({ display_name: "Anonymous Cartographer", avatar_url: null });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("propagates a non-anonymous profile name to anonymous map listing author names", async () => {
    const profileEq = vi.fn(() => ({ error: null }));
    const profileUpdate = vi.fn(() => ({ eq: profileEq }));

    const mapsAnonymousEqAuthor = vi.fn(() => ({ error: null }));
    const mapsAnonymousEqOwner = vi.fn(() => ({ eq: mapsAnonymousEqAuthor }));
    const mapsAnonymousUpdate = vi.fn(() => ({ eq: mapsAnonymousEqOwner }));

    const mapsNullIsAuthor = vi.fn(() => ({ error: null }));
    const mapsNullEqOwner = vi.fn(() => ({ is: mapsNullIsAuthor }));
    const mapsNullUpdate = vi.fn(() => ({ eq: mapsNullEqOwner }));

    const mapsBlankEqAuthor = vi.fn(() => ({ error: null }));
    const mapsBlankEqOwner = vi.fn(() => ({ eq: mapsBlankEqAuthor }));
    const mapsBlankUpdate = vi.fn(() => ({ eq: mapsBlankEqOwner }));

    const from = vi.fn((table: string) => {
      if (table === "profiles") return { update: profileUpdate };
      if (table === "maps" && from.mock.calls.filter(([name]) => name === "maps").length === 1) {
        return { update: mapsAnonymousUpdate };
      }
      if (table === "maps" && from.mock.calls.filter(([name]) => name === "maps").length === 2) {
        return { update: mapsNullUpdate };
      }
      if (table === "maps") return { update: mapsBlankUpdate };
      throw new Error(`Unexpected table: ${table}`);
    });

    const profile = await updateCurrentUserDisplayName({
      userId: "user-1",
      displayName: "Old Name",
      avatarUrl: null
    }, "  New Display Name  ", { from } as never);

    expect(profile.displayName).toBe("New Display Name");
    expect(profileUpdate).toHaveBeenCalledWith({ display_name: "New Display Name", avatar_url: null });

    const expectedMapPatch = { author_name: "New Display Name" };
    expect(mapsAnonymousUpdate).toHaveBeenCalledWith(expectedMapPatch);
    expect(mapsNullUpdate).toHaveBeenCalledWith(expectedMapPatch);
    expect(mapsBlankUpdate).toHaveBeenCalledWith(expectedMapPatch);

    expect(mapsAnonymousEqOwner).toHaveBeenCalledWith("owner_id", "user-1");
    expect(mapsAnonymousEqAuthor).toHaveBeenCalledWith("author_name", "Anonymous Cartographer");
    expect(mapsNullEqOwner).toHaveBeenCalledWith("owner_id", "user-1");
    expect(mapsNullIsAuthor).toHaveBeenCalledWith("author_name", null);
    expect(mapsBlankEqOwner).toHaveBeenCalledWith("owner_id", "user-1");
    expect(mapsBlankEqAuthor).toHaveBeenCalledWith("author_name", "");
  });
});
