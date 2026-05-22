import { describe, expect, it } from "vitest";
import { communityAuthReducer, initialCommunityAuthState, profileFromUser } from "../src/community/auth";

describe("community auth", () => {
  it("derives display profile metadata from OAuth user records", () => {
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
      displayName: "Template Maker",
      avatarUrl: "https://example.test/avatar.png",
      email: "cartographer@example.test"
    });
  });

  it("does not fall back to exposing the email local part as a public display name", () => {
    const profile = profileFromUser({
      id: "user-1",
      email: "cartographer@example.test",
      user_metadata: {}
    } as never);

    expect(profile.displayName).toBe("Cartographer");
    expect(profile.email).toBe("cartographer@example.test");
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
    expect(signedIn.profile?.displayName).toBe("Map Maker");

    const signedOut = communityAuthReducer(signedIn, { type: "session", session: null });

    expect(signedOut.status).toBe("signed-out");
    expect(signedOut.profile).toBeNull();
  });
});
