import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureCommunityViewerId,
  loadCommunityCatalog,
  persistCommunityCatalog,
  rateCommunityMap,
  recordCommunityDownload,
  summarizeCommunityCatalog,
  uploadCommunityMap,
  visibleCommunityMaps,
  type BrowseRangeFilters,
  type CommunityCatalogStats,
  type CommunityUploadDraft
} from "@/community/maps";
import { uploadCommunityMapToServer, ServerUploadError } from "@/community/uploadApi";
import {
  listMaps,
  getMap,
  rateMap as rateMapApi,
  recordDownload as recordDownloadApi,
  updateMapListing,
  type BrowseMapCard,
  type BrowseResult,
  type BrowseSort,
  type MapListingPatch,
  type MapDetail
} from "@/community/communityApi";
import { renderCommunityMapPreviewImageBlob } from "@/community/communityPreviewImage";
import { isSupabaseConfigured } from "@/community/supabaseClient";
import { downloadBlob, downloadText, communityDownloadBaseName } from "@/components/appShell/templateDownloads";
import { parseDesignOrTemplateFileResult, type TemplateDesign } from "@/design";
import type { CommunityAuthState } from "@/community/auth";
import type { ButtonProps } from "@/components/ui/button";
import type { AppPage } from "./useAppRoute";

type BrowseStatus = "idle" | "loading" | "loaded" | "error";

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm(): void;
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ServerUploadError) {
    return error.details.length > 1 ? error.details.join(" ") : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Upload validation failed. Review the map and try again.";
}

function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function summarizeBrowseResult(result: BrowseResult): CommunityCatalogStats {
  const ratingCount = result.maps.reduce((sum, map) => sum + map.ratingCount, 0);
  const ratingTotal = result.maps.reduce((sum, map) => sum + map.averageRating * map.ratingCount, 0);
  return {
    mapCount: result.total,
    ratingCount,
    averageRating: ratingCount === 0 ? 0 : Math.round((ratingTotal / ratingCount) * 10) / 10
  };
}

export async function downloadCommunityTemplateFile(
  map: Pick<MapDetail, "slug" | "title" | "templateName" | "templateJson">
): Promise<void> {
  await downloadText(`${communityDownloadBaseName(map)}.rmg.json`, map.templateJson, "application/json");
}

export async function downloadCommunityPreviewImage(
  map: Pick<MapDetail, "slug" | "title" | "templateName" | "previewDesignJson">,
  onError?: (msg: string) => void
): Promise<void> {
  try {
    const previewBlob = await renderCommunityMapPreviewImageBlob(map.previewDesignJson);
    await downloadBlob(`${communityDownloadBaseName(map)}.png`, previewBlob, { preferSavePicker: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create preview image.";
    if (onError) onError(message);
  }
}

interface UseCommunityBrowseProps {
  page: AppPage;
  authState: CommunityAuthState;
  design: TemplateDesign;
  exportJson: string;
  exportHasBlockingIssues: boolean;
  selectedZoneId: string;
  designBoardCanvas: HTMLCanvasElement | null;
  commit: (
    next: TemplateDesign,
    nextSelectedZoneId?: string,
    options?: {
      allowDirtyJsonOverwrite?: boolean;
      markDirty?: boolean;
    }
  ) => boolean;
  requestSignIn: (message?: string) => void;
  requestSignInForUpload: () => void;
  requestConfirmation: (confirmation: PendingConfirmation) => void;
  navigate: (page: AppPage) => void;
  runAfterDiscardingUnsavedChanges: (action: () => void) => void;
}

export function useCommunityBrowse({
  page,
  authState,
  design,
  exportJson,
  exportHasBlockingIssues,
  selectedZoneId,
  designBoardCanvas,
  commit,
  requestSignIn,
  requestSignInForUpload,
  requestConfirmation,
  navigate,
  runAfterDiscardingUnsavedChanges
}: UseCommunityBrowseProps) {
  const [communityCatalog, setCommunityCatalog] = useState(() => loadCommunityCatalog());
  const [communityViewerId] = useState(() => ensureCommunityViewerId());
  const [communityNotice, setCommunityNotice] = useState<string>();
  const [communityError, setCommunityError] = useState<string>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  const [browseStatus, setBrowseStatus] = useState<BrowseStatus>("idle");
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browseError, setBrowseError] = useState<string>();
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("newest");
  const [browseSelectedTags, setBrowseSelectedTags] = useState<string[]>([]);
  const [browseRangeFilters, setBrowseRangeFilters] = useState<BrowseRangeFilters>({});
  const [browsePage, setBrowsePage] = useState(1);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMap, setDetailMap] = useState<MapDetail | null>(null);

  const localCommunityStats = useMemo(() => summarizeCommunityCatalog(communityCatalog), [communityCatalog]);
  const communityStats = useMemo(() => {
    if (page !== "browse" || !browseResult) return localCommunityStats;
    return summarizeBrowseResult(browseResult);
  }, [browseResult, localCommunityStats, page]);

  const browseMaps = useMemo(() => visibleCommunityMaps(communityCatalog), [communityCatalog]);

  const loadBrowseMaps = useCallback(
    async (currentPage = browsePage) => {
      setBrowseStatus("loading");
      setBrowseError(undefined);
      try {
        const result = await listMaps({
          query: browseQuery,
          selectedTagSlugs: browseSelectedTags,
          rangeFilters: browseRangeFilters,
          sort: browseSort,
          page: currentPage
        });
        setBrowseResult(result);
        setBrowseStatus("loaded");
      } catch (error) {
        setBrowseError(error instanceof Error ? error.message : "Failed to load maps.");
        setBrowseStatus("error");
      }
    },
    [browseQuery, browseSelectedTags, browseRangeFilters, browseSort, browsePage]
  );

  useEffect(() => {
    if (page !== "browse") return;
    void loadBrowseMaps();
  }, [page, loadBrowseMaps]);

  const handleRateMap = useCallback(
    (mapId: string, value: number): void => {
      if (authState.status !== "signed-in") {
        requestSignIn("Sign in to rate shared maps with a stable beta identity.");
        return;
      }
      setCommunityError(undefined);
      const updated = rateCommunityMap(communityCatalog, mapId, communityViewerId, value);
      setCommunityCatalog(updated);
      void rateMapApi(mapId, value).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to save rating.";
        setCommunityError(message);
      });

      // Optimistically update browse result cards with new rating aggregates
      const ratedMap = updated.maps.find((m) => m.id === mapId);
      if (ratedMap && browseResult) {
        setBrowseResult((prev) =>
          prev
            ? {
                ...prev,
                maps: prev.maps.map((card) =>
                  card.id === mapId
                    ? {
                        ...card,
                        averageRating: ratedMap.averageRating,
                        ratingCount: ratedMap.ratingCount
                      }
                    : card
                )
              }
            : prev
        );
      }
    },
    [authState.status, communityCatalog, communityViewerId, browseResult, requestSignIn]
  );

  const handleDownloadBrowseMap = useCallback(
    (map: BrowseMapCard): void => {
      void (async () => {
        setCommunityError(undefined);
        const detail = await getMap(map.id);
        if (!detail) return;
        await downloadCommunityTemplateFile(detail);
        setCommunityCatalog((current) => recordCommunityDownload(current, map.id));
        try {
          await recordDownloadApi(map.id);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to record download.";
          setCommunityError(message);
        }
      })();
    },
    []
  );

  const handleDownloadBrowseMapImage = useCallback(
    (map: BrowseMapCard): void => {
      void (async () => {
        setCommunityError(undefined);
        await downloadCommunityPreviewImage(map, setCommunityError);
      })();
    },
    []
  );

  const openMapInBuilder = useCallback(
    (mapId: string, mapTitle: string): void => {
      runAfterDiscardingUnsavedChanges(() => {
        void (async () => {
          const detail = await getMap(mapId);
          if (!detail) return;
          const designResult = parseDesignOrTemplateFileResult(detail.designJson);
          const templateResult = designResult.ok ? designResult : parseDesignOrTemplateFileResult(detail.templateJson);
          if (!templateResult.ok) {
            setCommunityError(`Failed to load "${mapTitle}" into the builder. ${templateResult.errorMessage}`);
            return;
          }
          const next = templateResult.design;
          setCommunityError(undefined);
          if (!commit(next, next.zones[0]?.id ?? "", { allowDirtyJsonOverwrite: true, markDirty: false })) return;
          setCommunityNotice(`Loaded "${mapTitle}" into the builder.`);
          navigate("builder");
        })();
      });
    },
    [commit, navigate, runAfterDiscardingUnsavedChanges]
  );

  const handleOpenBrowseMap = useCallback(
    (map: BrowseMapCard): void => {
      openMapInBuilder(map.id, map.title);
    },
    [openMapInBuilder]
  );

  const handleViewMapDetail = useCallback(
    async (map: BrowseMapCard): Promise<void> => {
      setDetailOpen(true);
      setDetailMap(null);
      try {
        const detail = await getMap(map.id);
        setDetailMap(detail);
      } catch {
        setDetailMap(null);
      }
    },
    []
  );

  const handleUpdateMapListing = useCallback(
    (mapId: string, patch: MapListingPatch): void => {
      setCommunityError(undefined);
      void (async () => {
        try {
          await updateMapListing(mapId, patch);
          await loadBrowseMaps();
          if (detailMap?.id === mapId) {
            setDetailMap(await getMap(mapId));
          }
        } catch (error: unknown) {
          setCommunityError(actionErrorMessage(error, "Failed to update map listing."));
        }
      })();
    },
    [detailMap, loadBrowseMaps]
  );

  const handleHideMap = useCallback(
    (mapId: string): void => {
      requestConfirmation({
        title: "Hide this map?",
        message: "Hide this map from the catalog? It can be restored later.",
        confirmLabel: "Hide listing",
        confirmVariant: "danger",
        onConfirm: () => {
          setCommunityError(undefined);
          void (async () => {
            try {
              await updateMapListing(mapId, { status: "hidden" });
              setDetailOpen(false);
              await loadBrowseMaps();
            } catch (error: unknown) {
              setCommunityError(actionErrorMessage(error, "Failed to hide map listing."));
            }
          })();
        }
      });
    },
    [requestConfirmation, loadBrowseMaps]
  );

  const handleShareMapClick = useCallback((): void => {
    if (authState.status !== "signed-in") {
      requestSignInForUpload();
      return;
    }
    setUploadError(undefined);
    setUploadOpen(true);
  }, [authState.status, requestSignInForUpload]);

  const handleShareMap = useCallback(
    async (draft: CommunityUploadDraft): Promise<void> => {
      if (authState.status !== "signed-in") {
        requestSignInForUpload();
        return;
      }
      if (exportHasBlockingIssues || exportJson === "") return;

      const uploadDesign = draft.summary === design.templateDescription
        ? design
        : { ...design, templateDescription: draft.summary };

      if (uploadDesign !== design) {
        commit(uploadDesign, selectedZoneId, { allowDirtyJsonOverwrite: true, markDirty: true });
      }

      setUploadSubmitting(true);
      setUploadError(undefined);
      try {
        let updatedCatalog: typeof communityCatalog;
        if (isSupabaseConfigured) {
          const result = await uploadCommunityMapToServer(
            uploadDesign,
            draft,
            undefined,
            designBoardCanvas ? { previewSource: designBoardCanvas } : {}
          );
          updatedCatalog = {
            ...communityCatalog,
            maps: [result.map, ...communityCatalog.maps.filter((map) => map.id !== result.map.id)]
          };
        } else {
          updatedCatalog = uploadCommunityMap(communityCatalog, uploadDesign, draft);
        }
        setCommunityCatalog(updatedCatalog);
        persistCommunityCatalog(updatedCatalog);
        setUploadOpen(false);
        setCommunityNotice(
          `Shared "${draft.title}"${draft.visibility === "unlisted" ? " as an unlisted map." : " to the browse catalog."}`
        );
        if (draft.visibility === "public") {
          navigate("browse");
        }
      } catch (error) {
        setUploadError(uploadErrorMessage(error));
      } finally {
        setUploadSubmitting(false);
      }
    },
    [
      authState.status,
      exportHasBlockingIssues,
      exportJson,
      design,
      selectedZoneId,
      commit,
      communityCatalog,
      designBoardCanvas,
      requestSignInForUpload,
      navigate
    ]
  );

  const handleDownloadDetailMap = useCallback(
    (map: MapDetail): void => {
      void (async () => {
        setCommunityError(undefined);
        await downloadCommunityTemplateFile(map);
        setCommunityCatalog((current) => recordCommunityDownload(current, map.id));
        void recordDownloadApi(map.id).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Failed to record download.";
          setCommunityError(message);
        });
      })();
    },
    []
  );

  const handleDownloadDetailMapImage = useCallback(
    (map: MapDetail): void => {
      void (async () => {
        setCommunityError(undefined);
        await downloadCommunityPreviewImage(map, setCommunityError);
      })();
    },
    []
  );

  // Sync catalog updates to localStorage
  useEffect(() => {
    persistCommunityCatalog(communityCatalog);
  }, [communityCatalog]);

  return {
    communityCatalog,
    setCommunityCatalog,
    communityViewerId,
    communityNotice,
    setCommunityNotice,
    communityError,
    setCommunityError,
    uploadOpen,
    setUploadOpen,
    uploadSubmitting,
    uploadError,
    browseStatus,
    browseResult,
    setBrowseResult,
    browseError,
    browseQuery,
    setBrowseQuery,
    browseSort,
    setBrowseSort,
    browseSelectedTags,
    setBrowseSelectedTags,
    browseRangeFilters,
    setBrowseRangeFilters,
    browsePage,
    setBrowsePage,
    detailOpen,
    setDetailOpen,
    detailMap,
    setDetailMap,
    communityStats,
    browseMaps,
    loadBrowseMaps,
    handleRateMap,
    handleDownloadBrowseMap,
    handleDownloadBrowseMapImage,
    openMapInBuilder,
    handleOpenBrowseMap,
    handleViewMapDetail,
    handleUpdateMapListing,
    handleHideMap,
    handleShareMapClick,
    handleShareMap,
    handleDownloadDetailMap,
    handleDownloadDetailMapImage
  };
}
