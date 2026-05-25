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
    const update = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }));
    const from = vi.fn(() => ({ update }));

    const profile = await updateCurrentUserDisplayName({
      userId: "user-1",
      displayName: "Old Name",
      avatarUrl: "https://example.test/avatar.png"
    }, "", { from } as never);

    expect(profile.displayName).toBe("Anonymous Cartographer");
    expect(profile.avatarUrl).toBeNull();
    expect(update).toHaveBeenCalledWith({ display_name: "Anonymous Cartographer", avatar_url: null });
  });
});
