import { useCallback, useEffect, useState } from "react";
import {
  deleteMapListing,
  listMyMaps,
  getMap,
  updateMapListing,
  type ManagedMapCard,
  type MapListingPatch
} from "@/community/communityApi";
import { downloadCommunityTemplateFile, downloadCommunityPreviewImage } from "./useCommunityBrowse";
import type { AppPage } from "./useAppRoute";
import type { CommunityAuthState } from "@/community/auth";
import type { ButtonProps } from "@/components/ui/button";

export type MyMapsStatus = "idle" | "loading" | "loaded" | "error";

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm(): void;
}

interface UseMyMapsProps {
  page: AppPage;
  authState: CommunityAuthState;
  requestConfirmation: (confirmation: PendingConfirmation) => void;
  openMapInBuilder: (mapId: string, mapTitle: string) => void;
}

export function useMyMaps({
  page,
  authState,
  requestConfirmation,
  openMapInBuilder
}: UseMyMapsProps) {
  const [myMapsStatus, setMyMapsStatus] = useState<MyMapsStatus>("idle");
  const [myMaps, setMyMaps] = useState<ManagedMapCard[]>([]);
  const [myMapsError, setMyMapsError] = useState<string>();

  const loadMyMaps = useCallback(async () => {
    if (authState.status !== "signed-in") {
      setMyMapsStatus("idle");
      setMyMaps([]);
      setMyMapsError(undefined);
      return;
    }

    setMyMapsStatus("loading");
    setMyMapsError(undefined);
    try {
      const result = await listMyMaps();
      setMyMaps(result.maps);
      setMyMapsStatus("loaded");
    } catch (error) {
      setMyMapsError(error instanceof Error ? error.message : "Failed to load your maps.");
      setMyMapsStatus("error");
    }
  }, [authState.status]);

  useEffect(() => {
    if (page !== "my-maps") return;
    void loadMyMaps();
  }, [page, loadMyMaps]);

  const patchMyMap = useCallback((mapId: string, patch: Partial<ManagedMapCard>): void => {
    setMyMaps((current) => current.map((map) => (map.id === mapId ? { ...map, ...patch } : map)));
  }, []);

  const handleOpenOwnedMap = useCallback(
    (map: ManagedMapCard): void => {
      openMapInBuilder(map.id, map.title);
    },
    [openMapInBuilder]
  );

  const handleUpdateOwnedMapListing = useCallback(
    (mapId: string, patch: MapListingPatch): void => {
      void updateMapListing(mapId, patch)
        .then(() => {
          patchMyMap(mapId, {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.authorName !== undefined ? { authorName: patch.authorName.trim() || "Anonymous Cartographer" } : {}),
            ...(patch.description !== undefined ? { summary: patch.description } : {}),
            ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {})
          });
        })
        .catch((error: unknown) => {
          setMyMapsError(error instanceof Error ? error.message : "Failed to update map listing.");
        });
    },
    [patchMyMap]
  );

  const handleHideOwnedMap = useCallback(
    (mapId: string): void => {
      handleUpdateOwnedMapListing(mapId, { status: "hidden" });
    },
    [handleUpdateOwnedMapListing]
  );

  const handleRestoreOwnedMap = useCallback(
    (mapId: string): void => {
      handleUpdateOwnedMapListing(mapId, { status: "published" });
    },
    [handleUpdateOwnedMapListing]
  );

  const handleDeleteOwnedMap = useCallback(
    (map: ManagedMapCard): void => {
      requestConfirmation({
        title: "Delete map listing?",
        message: `Permanently delete "${map.title}"? This cannot be undone.`,
        confirmLabel: "Delete listing",
        confirmVariant: "danger",
        onConfirm: () => {
          void deleteMapListing(map.id)
            .then(() => {
              setMyMaps((current) => current.filter((entry) => entry.id !== map.id));
            })
            .catch((error: unknown) => {
              setMyMapsError(error instanceof Error ? error.message : "Failed to delete map listing.");
            });
        }
      });
    },
    [requestConfirmation]
  );

  const handleDownloadOwnedMap = useCallback(
    (map: ManagedMapCard): void => {
      void (async () => {
        const detail = await getMap(map.id);
        if (!detail) return;
        await downloadCommunityTemplateFile(detail);
      })();
    },
    []
  );

  const handleDownloadOwnedMapImage = useCallback(
    (map: ManagedMapCard): void => {
      void (async () => {
        setMyMapsError(undefined);
        await downloadCommunityPreviewImage(map, setMyMapsError);
      })();
    },
    []
  );

  return {
    myMapsStatus,
    myMaps,
    setMyMaps,
    myMapsError,
    loadMyMaps,
    handleOpenOwnedMap,
    handleUpdateOwnedMapListing,
    handleHideOwnedMap,
    handleRestoreOwnedMap,
    handleDeleteOwnedMap,
    handleDownloadOwnedMap,
    handleDownloadOwnedMapImage
  };
}
