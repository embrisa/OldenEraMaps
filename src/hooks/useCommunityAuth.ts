import { useEffect, useReducer, useState, useCallback } from "react";
import {
  communityAuthReducer,
  deleteCurrentAccount,
  getSession,
  initialCommunityAuthState,
  onAuthStateChange,
  signInWithProvider,
  signOut,
  syncCurrentUserProfile,
  updateCurrentUserDisplayName,
  type CommunityAuthProfile,
  type CommunityAuthProvider
} from "@/community/auth";

const POST_SIGN_IN_UPLOAD_KEY = "olden-era-template-generator.post-sign-in-upload";

function writePostSignInUpload(): void {
  window.sessionStorage.setItem(POST_SIGN_IN_UPLOAD_KEY, "1");
}

function readPostSignInUpload(): boolean {
  return window.sessionStorage.getItem(POST_SIGN_IN_UPLOAD_KEY) === "1";
}

function clearPostSignInUpload(): void {
  window.sessionStorage.removeItem(POST_SIGN_IN_UPLOAD_KEY);
}

function authErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Sign-in failed. Check the provider configuration and try again.";
}

interface UseCommunityAuthProps {
  onUploadOpen?: () => void;
}

export function useCommunityAuth({ onUploadOpen }: UseCommunityAuthProps = {}) {
  const [authState, dispatchAuth] = useReducer(communityAuthReducer, undefined, initialCommunityAuthState);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMessage, setSignInMessage] = useState("Sign in with a configured OAuth provider to continue.");
  const [resumeUploadAfterSignIn, setResumeUploadAfterSignIn] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountSubmitting, setDeleteAccountSubmitting] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string>();
  const [editAuthorNameOpen, setEditAuthorNameOpen] = useState(false);
  const [editAuthorNameSubmitting, setEditAuthorNameSubmitting] = useState(false);
  const [editAuthorNameError, setEditAuthorNameError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getSession()
      .then((session) => {
        if (!active) return;
        dispatchAuth({ type: "session", session });
        if (session) {
          void syncCurrentUserProfile(session)
            .then((profile) => {
              if (active && profile) dispatchAuth({ type: "profile", profile });
            })
            .catch((error: unknown) => dispatchAuth({ type: "error", error: authErrorMessage(error) }));
        }
      })
      .catch((error: unknown) => {
        if (active) dispatchAuth({ type: "error", error: authErrorMessage(error) });
      });

    const unsubscribe = onAuthStateChange((_event, session) => {
      dispatchAuth({ type: "session", session });
      if (session) {
        void syncCurrentUserProfile(session)
          .then((profile) => {
            if (profile) dispatchAuth({ type: "profile", profile });
          })
          .catch((error: unknown) => dispatchAuth({ type: "error", error: authErrorMessage(error) }));
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authState.status !== "signed-in") return;
    if (!resumeUploadAfterSignIn && !readPostSignInUpload()) return;
    clearPostSignInUpload();
    setResumeUploadAfterSignIn(false);
    setSignInOpen(false);
    if (onUploadOpen) onUploadOpen();
  }, [authState.status, resumeUploadAfterSignIn, onUploadOpen]);

  const requestSignIn = useCallback((message = "Sign in with a configured OAuth provider to continue.") => {
    setSignInMessage(message);
    dispatchAuth({ type: "clear-error" });
    setSignInOpen(true);
  }, []);

  const requestSignInForUpload = useCallback(() => {
    setResumeUploadAfterSignIn(true);
    writePostSignInUpload();
    requestSignIn("Sign in is required before publishing a map template.");
  }, [requestSignIn]);

  const handleSignInWithProvider = useCallback((provider: CommunityAuthProvider) => {
    dispatchAuth({ type: "loading" });
    void signInWithProvider(provider).catch((error: unknown) => {
      dispatchAuth({ type: "error", error: authErrorMessage(error) });
    });
  }, []);

  const handleSignOut = useCallback(() => {
    void signOut().catch((error: unknown) => dispatchAuth({ type: "error", error: authErrorMessage(error) }));
  }, []);

  const handleEditAuthorName = useCallback((displayName: string, onSuccess?: (profile: CommunityAuthProfile) => void) => {
    if (!authState.profile) return;
    setEditAuthorNameSubmitting(true);
    setEditAuthorNameError(undefined);
    void updateCurrentUserDisplayName(authState.profile, displayName)
      .then((profile) => {
        dispatchAuth({ type: "profile", profile });
        setEditAuthorNameOpen(false);
        if (onSuccess) onSuccess(profile);
      })
      .catch((error: unknown) => setEditAuthorNameError(authErrorMessage(error)))
      .finally(() => setEditAuthorNameSubmitting(false));
  }, [authState.profile]);

  const handleDeleteAccount = useCallback(() => {
    setDeleteAccountError(undefined);
    setDeleteAccountOpen(true);
  }, []);

  const confirmDeleteAccount = useCallback(() => {
    setDeleteAccountSubmitting(true);
    setDeleteAccountError(undefined);
    void deleteCurrentAccount()
      .then(() => {
        setDeleteAccountOpen(false);
      })
      .catch((error: unknown) => {
        setDeleteAccountError(error instanceof Error ? error.message : "Failed to delete account.");
      })
      .finally(() => {
        setDeleteAccountSubmitting(false);
      });
  }, []);

  return {
    authState,
    signInOpen,
    setSignInOpen,
    signInMessage,
    resumeUploadAfterSignIn,
    setResumeUploadAfterSignIn,
    deleteAccountOpen,
    setDeleteAccountOpen,
    deleteAccountSubmitting,
    deleteAccountError,
    editAuthorNameOpen,
    setEditAuthorNameOpen,
    editAuthorNameSubmitting,
    editAuthorNameError,
    setEditAuthorNameError,
    requestSignIn,
    requestSignInForUpload,
    handleSignInWithProvider,
    handleSignOut,
    handleEditAuthorName,
    handleDeleteAccount,
    confirmDeleteAccount
  };
}
