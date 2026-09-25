import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureCommunityViewerId,
  filterCommunityMaps,
  getViewerRating as getLocalViewerRating,
  loadCommunityCatalog,
  persistCommunityCatalog,
  rateCommunityMap,
  recordCommunityDownload,
  summarizeCommunityCatalog,
  summarizeCommunityMaps,
  uploadCommunityMap,
  visibleCommunityMaps,
  type BrowseFilterSourceMap,
  type BrowseRangeFilters,
  type CommunityCatalogStats,
  type CommunityUploadDraft
} from "@/community/maps";
import { uploadCommunityMapToServer, ServerUploadError } from "@/community/uploadApi";
import {
  estimateRatingStatsAfterVote,
  fetchBrowseStats,
  fetchMapRatingStats,
  fetchViewerRating,
  fetchViewerRatings,
  listMaps,
  getMap,
  rateMap as rateMapApi,
  recordDownload as recordDownloadApi,
  summarizeRatingAggregates,
  updateMapListing,
  type BrowseMapCard,
  type BrowseResult,
  type BrowseSort,
  type MapListingPatch,
  type MapDetail,
  type MapRatingStats
} from "@/community/communityApi";
import { renderCommunityMapPreviewImageBlob } from "@/community/communityPreviewImage";
import { isSupabaseConfigured } from "@/community/supabaseClient";
import { downloadBlob, downloadText, communityDownloadBaseName } from "@/components/appShell/templateDownloads";
import { parseDesignOrTemplateFileResult, type TemplateDesign } from "@/design";
import type { CommunityAuthState } from "@/community/auth";
import type { ButtonProps } from "@/components/ui/button";
import type { AppPage } from "./useAppRoute";

type BrowseStatus = "idle" | "loading" | "loaded" | "error";

/** Typing in the search box waits this long before querying, so each keystroke is not a request. */
export const BROWSE_QUERY_DEBOUNCE_MS = 250;

export const SHARE_BLOCKED_BY_TEMPLATE_ERRORS_MESSAGE =
  "Fix the template errors listed under Validation & JSON before sharing. Only templates that export cleanly can be published.";

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm(): void;
}

interface BrowseStatsSnapshot {
  filtersKey: string;
  stats: CommunityCatalogStats;
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

function clampRatingValue(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function withViewerRating(ratings: Record<string, number>, mapId: string, value: number | undefined): Record<string, number> {
  const next = { ...ratings };
  if (value === undefined) delete next[mapId];
  else next[mapId] = value;
  return next;
}

function filterSourceFromCard(map: BrowseMapCard): BrowseFilterSourceMap {
  return {
    tags: map.tags,
    playerCount: map.playerCount,
    mapWidth: map.mapWidth,
    mapHeight: map.mapHeight,
    zoneCount: map.zoneCount,
    connectionCount: map.connectionCount
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
  const [debouncedBrowseQuery, setDebouncedBrowseQuery] = useState("");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("newest");
  const [browseSelectedTags, setBrowseSelectedTags] = useState<string[]>([]);
  const [browseRangeFilters, setBrowseRangeFilters] = useState<BrowseRangeFilters>({});
  const [browsePage, setBrowsePage] = useState(1);
  const [browseStats, setBrowseStats] = useState<BrowseStatsSnapshot | null>(null);
  const [seenServerMaps, setSeenServerMaps] = useState<ReadonlyMap<string, BrowseFilterSourceMap>>(() => new Map());
  const [serverViewerRatings, setServerViewerRatings] = useState<Record<string, number>>({});

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMap, setDetailMap] = useState<MapDetail | null>(null);

  // Only the newest browse request may update state; slower, older responses are dropped.
  const browseRequestIdRef = useRef(0);
  // Server stats cover the whole filtered result set, so paging reuses them instead of refetching.
  const browseStatsCacheRef = useRef<BrowseStatsSnapshot | null>(null);
  // Per-map sequence numbers of in-flight rating requests (present = a rating is pending).
  const ratingRequestSeqRef = useRef(new Map<string, number>());

  const viewerUserId = authState.status === "signed-in"
    ? authState.profile?.userId ?? authState.session?.user.id ?? null
    : null;
  const viewerUserIdRef = useRef(viewerUserId);
  viewerUserIdRef.current = viewerUserId;

  const browseFilters = useMemo(() => ({
    query: debouncedBrowseQuery,
    selectedTagSlugs: browseSelectedTags,
    rangeFilters: browseRangeFilters
  }), [debouncedBrowseQuery, browseSelectedTags, browseRangeFilters]);
  const browseFiltersKey = useMemo(() => JSON.stringify(browseFilters), [browseFilters]);

  useEffect(() => {
    if (debouncedBrowseQuery === browseQuery) return;
    const timer = setTimeout(() => setDebouncedBrowseQuery(browseQuery), BROWSE_QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [browseQuery, debouncedBrowseQuery]);

  const localCommunityStats = useMemo(() => summarizeCommunityCatalog(communityCatalog), [communityCatalog]);
  const communityStats = useMemo((): CommunityCatalogStats => {
    if (page !== "browse") return localCommunityStats;
    // All three numbers describe the same set: every public map matching the current filters.
    if (!isSupabaseConfigured) {
      return summarizeCommunityMaps(communityCatalog, filterCommunityMaps(visibleCommunityMaps(communityCatalog), browseFilters));
    }
    if (browseStats) return browseStats.stats;
    // Stats request failed: fall back to the loaded page (exact whenever every match fits on one page).
    if (browseResult) return summarizeRatingAggregates(browseResult.maps, browseResult.total);
    return localCommunityStats;
  }, [browseFilters, browseResult, browseStats, communityCatalog, localCommunityStats, page]);

  // Filter chips and range bounds: the local catalog offline; with Supabase the local catalog only holds
  // this browser's uploads, so use every public map the server has returned during this session.
  const browseMaps = useMemo<BrowseFilterSourceMap[]>(
    () => (isSupabaseConfigured ? [...seenServerMaps.values()] : visibleCommunityMaps(communityCatalog)),
    [communityCatalog, seenServerMaps]
  );

  const loadBrowseMaps = useCallback(
    async (currentPage = browsePage) => {
      const requestId = browseRequestIdRef.current + 1;
      browseRequestIdRef.current = requestId;
      const isCurrentRequest = () => browseRequestIdRef.current === requestId;
      setBrowseStatus("loading");
      setBrowseError(undefined);

      const fetchStatsSnapshot = (): Promise<BrowseStatsSnapshot | null> => fetchBrowseStats(browseFilters)
        .then((stats) => (stats ? { filtersKey: browseFiltersKey, stats } : null))
        .catch(() => null);
      const cachedStats = browseStatsCacheRef.current?.filtersKey === browseFiltersKey ? browseStatsCacheRef.current : null;

      try {
        const [result, fetchedStats] = await Promise.all([
          listMaps({ ...browseFilters, sort: browseSort, page: currentPage }),
          cachedStats ? Promise.resolve(cachedStats) : fetchStatsSnapshot()
        ]);
        if (!isCurrentRequest()) return;
        let stats = fetchedStats;
        if (stats && stats === cachedStats && stats.stats.mapCount !== result.total) {
          // The catalog changed since the cached stats were fetched; refetch so every number describes one set.
          stats = await fetchStatsSnapshot();
          if (!isCurrentRequest()) return;
        }
        if (stats) browseStatsCacheRef.current = stats;

        if (result.page > result.pageCount && browsePage !== result.pageCount) {
          // The result set shrank below the current page (e.g. after hiding a map or a stale page);
          // move to the last page, which triggers a reload instead of showing an empty page.
          setBrowsePage(result.pageCount);
          return;
        }

        setBrowseResult(result);
        setBrowseStats(stats);
        setBrowseStatus("loaded");
        if (isSupabaseConfigured && result.maps.length > 0) {
          setSeenServerMaps((current) => {
            const next = new Map(current);
            for (const map of result.maps) next.set(map.id, filterSourceFromCard(map));
            return next;
          });
        }
      } catch (error) {
        if (!isCurrentRequest()) return;
        setBrowseError(error instanceof Error ? error.message : "Failed to load maps.");
        setBrowseStatus("error");
      }
    },
    [browseFilters, browseFiltersKey, browseSort, browsePage]
  );

  // Stats are only reused while paging within one visit; entering the page starts fresh.
  useEffect(() => {
    if (page === "browse") browseStatsCacheRef.current = null;
  }, [page]);

  useEffect(() => {
    if (page !== "browse") return;
    void loadBrowseMaps();
  }, [page, loadBrowseMaps]);

  const refreshBrowseStats = useCallback(async (): Promise<void> => {
    const filtersKey = browseFiltersKey;
    try {
      const stats = await fetchBrowseStats(browseFilters);
      if (!stats) return;
      const snapshot = { filtersKey, stats };
      browseStatsCacheRef.current = snapshot;
      setBrowseStats((current) => (current?.filtersKey === filtersKey ? snapshot : current));
    } catch {
      // Keep the previous stats; the next browse load refreshes them.
    }
  }, [browseFilters, browseFiltersKey]);

  // The signed-in viewer's own ratings come from the server when Supabase is configured; the
  // per-browser local catalog would show another account's scores on a shared browser.
  useEffect(() => {
    setServerViewerRatings((current) => (Object.keys(current).length === 0 ? current : {}));
  }, [viewerUserId]);

  const browseMapIdsKey = useMemo(() => (browseResult?.maps ?? []).map((map) => map.id).join(","), [browseResult]);

  useEffect(() => {
    if (!isSupabaseConfigured || !viewerUserId || browseMapIdsKey === "") return;
    let active = true;
    void fetchViewerRatings(browseMapIdsKey.split(","), viewerUserId)
      .then((ratings) => {
        if (!active) return;
        setServerViewerRatings((current) => {
          const next = { ...current };
          for (const [mapId, value] of Object.entries(ratings)) {
            if (!ratingRequestSeqRef.current.has(mapId)) next[mapId] = value;
          }
          return next;
        });
      })
      .catch(() => {
        // Without the lookup the stars simply start unselected; rating still works.
      });
    return () => {
      active = false;
    };
  }, [browseMapIdsKey, viewerUserId]);

  const getViewerRating = useCallback(
    (mapId: string): number | undefined => {
      if (isSupabaseConfigured) return viewerUserId ? serverViewerRatings[mapId] : undefined;
      return getLocalViewerRating(communityCatalog, mapId, communityViewerId);
    },
    [communityCatalog, communityViewerId, serverViewerRatings, viewerUserId]
  );

  const patchMapRatingStats = useCallback((mapId: string, stats: MapRatingStats): void => {
    const next = { averageRating: stats.averageRating, ratingCount: stats.ratingCount };
    setBrowseResult((current) =>
      current
        ? { ...current, maps: current.maps.map((card) => (card.id === mapId ? { ...card, ...next } : card)) }
        : current
    );
    setDetailMap((current) => (current && current.id === mapId ? { ...current, ...next } : current));
  }, []);

  const handleRateMap = useCallback(
    (mapId: string, value: number): void => {
      if (authState.status !== "signed-in") {
        requestSignIn("Sign in to rate shared maps with a stable beta identity.");
        return;
      }
      setCommunityError(undefined);
      const rating = clampRatingValue(value);

      if (!isSupabaseConfigured) {
        // Offline catalog: the local catalog is the store, so the update is final.
        const updated = rateCommunityMap(communityCatalog, mapId, communityViewerId, rating);
        setCommunityCatalog(updated);
        const ratedMap = updated.maps.find((map) => map.id === mapId);
        if (ratedMap) patchMapRatingStats(mapId, ratedMap);
        return;
      }

      const previousRating = serverViewerRatings[mapId];
      const card = browseResult?.maps.find((map) => map.id === mapId) ?? (detailMap?.id === mapId ? detailMap : undefined);
      const previousStats: MapRatingStats | undefined = card
        ? { averageRating: card.averageRating, ratingCount: card.ratingCount }
        : undefined;

      const seq = (ratingRequestSeqRef.current.get(mapId) ?? 0) + 1;
      ratingRequestSeqRef.current.set(mapId, seq);
      const isLatestRating = () => ratingRequestSeqRef.current.get(mapId) === seq;

      setServerViewerRatings((current) => withViewerRating(current, mapId, rating));
      if (previousStats) patchMapRatingStats(mapId, estimateRatingStatsAfterVote(previousStats, previousRating, rating));

      void (async () => {
        try {
          await rateMapApi(mapId, rating);
        } catch (error: unknown) {
          if (isLatestRating()) {
            ratingRequestSeqRef.current.delete(mapId);
            setServerViewerRatings((current) => withViewerRating(current, mapId, previousRating));
            if (previousStats) patchMapRatingStats(mapId, previousStats);
          }
          setCommunityError(actionErrorMessage(error, "Failed to save rating."));
          return;
        }

        if (!isLatestRating()) return;
        ratingRequestSeqRef.current.delete(mapId);
        try {
          const fresh = await fetchMapRatingStats(mapId);
          if (fresh) patchMapRatingStats(mapId, fresh);
        } catch {
          // The rating is saved; the card catches up on the next browse load.
        }
        void refreshBrowseStats();
      })();
    },
    [
      authState.status,
      browseResult,
      communityCatalog,
      communityViewerId,
      detailMap,
      patchMapRatingStats,
      refreshBrowseStats,
      requestSignIn,
      serverViewerRatings
    ]
  );

  const handleDownloadBrowseMap = useCallback(
    (map: BrowseMapCard): void => {
      void (async () => {
        setCommunityError(undefined);
        try {
          const detail = await getMap(map.id);
          if (!detail) {
            setCommunityError(`Failed to find "${map.title}".`);
            return;
          }
          await downloadCommunityTemplateFile(detail);
          setCommunityCatalog((current) => recordCommunityDownload(current, map.id));
          await recordDownloadApi(map.id);
        } catch (error: unknown) {
          setCommunityError(actionErrorMessage(error, "Failed to download map."));
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
          try {
            const detail = await getMap(mapId);
            if (!detail) {
              setCommunityError(`Failed to find "${mapTitle}".`);
              return;
            }
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
          } catch (error: unknown) {
            setCommunityError(actionErrorMessage(error, `Failed to load "${mapTitle}" into the builder.`));
          }
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
      setCommunityError(undefined);
      if (isSupabaseConfigured && viewerUserId) {
        const userId = viewerUserId;
        void fetchViewerRating(map.id).then((rating) => {
          if (rating === null || viewerUserIdRef.current !== userId || ratingRequestSeqRef.current.has(map.id)) return;
          setServerViewerRatings((current) => withViewerRating(current, map.id, rating));
        });
      }
      try {
        const detail = await getMap(map.id);
        setDetailMap(detail);
        if (!detail) setCommunityError(`Failed to find "${map.title}".`);
      } catch (error: unknown) {
        setDetailMap(null);
        setCommunityError(actionErrorMessage(error, "Failed to load map details."));
      }
    },
    [viewerUserId]
  );

  const handleUpdateMapListing = useCallback(
    (mapId: string, patch: MapListingPatch): void => {
      setCommunityError(undefined);
      void (async () => {
        try {
          await updateMapListing(mapId, patch);
          browseStatsCacheRef.current = null;
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
              browseStatsCacheRef.current = null;
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
      if (exportHasBlockingIssues || exportJson === "") {
        setUploadError(SHARE_BLOCKED_BY_TEMPLATE_ERRORS_MESSAGE);
        return;
      }

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
        let uploadWarnings: string[] = [];
        if (isSupabaseConfigured) {
          const result = await uploadCommunityMapToServer(
            uploadDesign,
            draft,
            undefined,
            designBoardCanvas ? { previewSource: designBoardCanvas } : {}
          );
          uploadWarnings = result.warnings;
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
        const sharedMessage = `Shared "${draft.title}"${draft.visibility === "unlisted" ? " as an unlisted map." : " to the browse catalog."}`;
        setCommunityNotice(
          uploadWarnings.length > 0 ? `${sharedMessage} Upload warnings: ${uploadWarnings.join(" ")}` : sharedMessage
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
        try {
          await downloadCommunityTemplateFile(map);
        } catch (error: unknown) {
          setCommunityError(actionErrorMessage(error, "Failed to download map."));
          return;
        }
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
    getViewerRating,
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
