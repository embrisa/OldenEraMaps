import { ChevronLeft, ChevronRight, Compass, Download, Loader2, Search, Star, Upload, X } from "lucide-react";
import { useMemo, type JSX } from "react";
import {
  buildCommunityTagFilterSections,
  type BrowseRangeFilters,
  type BrowseNumericRange,
  type CommunityCatalogStats,
  type CommunityMapRecord
} from "@/community/maps";
import type { BrowseMapCard, BrowseResult, BrowseSort } from "@/community/communityApi";
import { CommunityMapCanvasPreview, COMMUNITY_MAP_CARD_PREVIEW_SIZE } from "@/components/community/CommunityMapCanvasPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, SteppedValueSlider } from "@/components/ui/form-controls";

export type BrowseStatus = "idle" | "loading" | "loaded" | "error";
type BrowseRangeKey = keyof BrowseRangeFilters;

interface BrowseRangeDefinition {
  key: BrowseRangeKey;
  label: string;
  minLabel: string;
  maxLabel: string;
  mapValue(map: CommunityMapRecord): number;
  fallbackMin: number;
  fallbackMax: number;
  step: number;
}

interface BrowseRangeBounds extends BrowseRangeDefinition {
  min: number;
  max: number;
}

const BROWSE_RANGE_DEFINITIONS: BrowseRangeDefinition[] = [
  { key: "players", label: "Players", minLabel: "Players minimum", maxLabel: "Players maximum", mapValue: (map) => map.playerCount, fallbackMin: 2, fallbackMax: 8, step: 1 },
  { key: "mapWidth", label: "Map width", minLabel: "Map width minimum", maxLabel: "Map width maximum", mapValue: (map) => map.mapWidth, fallbackMin: 96, fallbackMax: 512, step: 16 },
  { key: "mapHeight", label: "Map height", minLabel: "Map height minimum", maxLabel: "Map height maximum", mapValue: (map) => map.mapHeight, fallbackMin: 96, fallbackMax: 512, step: 16 },
  { key: "zones", label: "Zones", minLabel: "Zones minimum", maxLabel: "Zones maximum", mapValue: (map) => map.zoneCount, fallbackMin: 0, fallbackMax: 64, step: 1 },
  { key: "connections", label: "Paths", minLabel: "Paths minimum", maxLabel: "Paths maximum", mapValue: (map) => map.connectionCount, fallbackMin: 0, fallbackMax: 96, step: 1 }
];

export function BrowsePage({
  status,
  result,
  maps,
  stats,
  errorMessage,
  query,
  sort,
  selectedTagSlugs,
  rangeFilters,
  getViewerRating,
  onRate,
  canRate,
  viewerUserId,
  onDownload,
  onDownloadImage,
  onOpenInBuilder,
  onViewDetail,
  onQueryChange,
  onSortChange,
  onTagToggle,
  onTagRemove,
  onRangeChange,
  onRangeRemove,
  onPageChange
}: {
  status: BrowseStatus;
  result: BrowseResult | null;
  maps: CommunityMapRecord[];
  stats: CommunityCatalogStats;
  errorMessage?: string;
  query: string;
  sort: BrowseSort;
  selectedTagSlugs: string[];
  rangeFilters: BrowseRangeFilters;
  getViewerRating(mapId: string): number | undefined;
  onRate(mapId: string, value: number): void;
  canRate: boolean;
  viewerUserId: string | null;
  onDownload(map: BrowseMapCard): void;
  onDownloadImage(map: BrowseMapCard): void;
  onOpenInBuilder(map: BrowseMapCard): void;
  onViewDetail(map: BrowseMapCard): void;
  onQueryChange(query: string): void;
  onSortChange(sort: BrowseSort): void;
  onTagToggle(slug: string): void;
  onTagRemove(slug: string): void;
  onRangeChange(key: BrowseRangeKey, range: BrowseNumericRange): void;
  onRangeRemove(key: BrowseRangeKey): void;
  onPageChange(page: number): void;
}): JSX.Element {
  const tagFilterSections = useMemo(() => buildCommunityTagFilterSections(maps), [maps]);
  const rangeBounds = useMemo(() => buildRangeBounds(maps), [maps]);
  const selectedTags = useMemo(() => {
    const availableTags = new Map(
      tagFilterSections.flatMap((section) => section.groups.flatMap((group) => group.tags)).map((tag) => [tag.slug, tag])
    );
    return selectedTagSlugs.map((slug) => availableTags.get(slug)).filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  }, [selectedTagSlugs, tagFilterSections]);
  const selectedRanges = useMemo(() => rangeBounds
    .map((bounds) => {
      const range = rangeFilters[bounds.key];
      const activeRange = activeRangeForBounds(range, bounds);
      if (!activeRange) return null;
      return {
        key: bounds.key,
        label: `${bounds.label}: ${activeRange.min}–${activeRange.max}`
      };
    })
    .filter((range): range is NonNullable<typeof range> => Boolean(range)), [rangeBounds, rangeFilters]);

  const displayMaps = result?.maps ?? [];

  return (
    <section className="community-layout">
      <div className="community-hero">
        <Card className="community-stats-card">
          <CardHeader>
            <div>
              <CardTitle><Compass size={18} />Community catalog</CardTitle>
              <CardDescription>Browse shared map templates from the community.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="community-stat-strip">
            <span><strong>{stats.mapCount}</strong>Public maps</span>
            <span><strong>{stats.ratingCount}</strong>Ratings</span>
            <span><strong>{stats.averageRating.toFixed(1)}</strong>Avg score</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle><Search size={18} />Browse shared maps</CardTitle>
            <CardDescription>Search by name or author, then narrow results with ranges, factual tags, or descriptive tags.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="community-filter-grid">
          <div className="config-field">
            <label className="oe-field__label" htmlFor="community-search">Search maps</label>
            <Input id="community-search" value={query} placeholder="Temple, 1v1, hub..." onChange={(event) => onQueryChange(event.currentTarget.value)} />
          </div>
          <div className="config-field">
            <label className="oe-field__label" htmlFor="community-sort">Sort by</label>
            <NativeSelect id="community-sort" value={sort} onChange={(event) => onSortChange(event.currentTarget.value as BrowseSort)}>
              <option value="newest">Newest</option>
              <option value="top-rated">Top rated</option>
              <option value="most-downloaded">Most downloaded</option>
              <option value="recently-updated">Recently updated</option>
            </NativeSelect>
          </div>
          <div className="community-filter-sections">
            {selectedTags.length > 0 || selectedRanges.length > 0 ? (
              <div className="config-field">
                <span className="oe-field__label">Selected filters</span>
                <div className="community-selected-filters">
                  {selectedRanges.map((range) => (
                    <button
                      key={range.key}
                      className="community-selected-filter"
                      type="button"
                      onClick={() => onRangeRemove(range.key)}
                      aria-label={`Remove ${rangeLabelForRemoval(range.key)}`}
                    >
                      <Badge className="community-tag-badge community-tag-badge--factual">
                        {range.label}
                      </Badge>
                      <X size={12} />
                    </button>
                  ))}
                  {selectedTags.map((tag) => (
                    <button
                      key={tag.slug}
                      className="community-selected-filter"
                      type="button"
                      onClick={() => onTagRemove(tag.slug)}
                      aria-label={`Remove filter ${tag.label}`}
                    >
                      <Badge className={tag.kind === "factual" ? "community-tag-badge community-tag-badge--factual" : "community-tag-badge community-tag-badge--descriptive"}>
                        {tag.label}
                      </Badge>
                      <X size={12} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="community-filter-section community-filter-section--ranges" aria-label="Factual ranges">
              {rangeBounds.map((bounds) => {
                const range = rangeFilters[bounds.key] ?? {};
                const minValue = clampRangeValue(range.min ?? bounds.min, bounds.min, bounds.max);
                const maxValue = clampRangeValue(range.max ?? bounds.max, bounds.min, bounds.max);
                return (
                  <div key={bounds.key} className="community-range-filter">
                    <span>{bounds.label}</span>
                    <div className="community-range-filter__controls">
                      <label>
                        <span>Min</span>
                        <SteppedValueSlider
                          aria-label={bounds.minLabel}
                          min={bounds.min}
                          max={bounds.max}
                          step={bounds.step}
                          value={Math.min(minValue, maxValue)}
                          onChange={(event) => {
                            const min = Number(event.currentTarget.value);
                            onRangeChange(bounds.key, normalizeRangeForBounds({ min, max: Math.max(maxValue, min) }, bounds));
                          }}
                        />
                      </label>
                      <label>
                        <span>Max</span>
                        <SteppedValueSlider
                          aria-label={bounds.maxLabel}
                          min={bounds.min}
                          max={bounds.max}
                          step={bounds.step}
                          value={Math.max(maxValue, minValue)}
                          onChange={(event) => {
                            const max = Number(event.currentTarget.value);
                            onRangeChange(bounds.key, normalizeRangeForBounds({ min: Math.min(minValue, max), max }, bounds));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            {tagFilterSections.map((section) => (
              <div key={section.kind} className="community-filter-section">
                <h3>{section.label}</h3>
                {section.groups.map((group) => (
                  <div key={group.id} className="community-filter-group">
                    <span>{group.label}</span>
                    <div className="community-filter-chip-row">
                      {group.tags.map((tag) => {
                        const selected = selectedTagSlugs.includes(tag.slug);
                        return (
                          <button
                            key={tag.slug}
                            type="button"
                            className={`community-filter-chip${selected ? " community-filter-chip--selected" : ""}`}
                            onClick={() => onTagToggle(tag.slug)}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <div className="community-loading" role="status" aria-label="Loading maps">
          <Loader2 size={24} className="community-spinner" />
          <span>Loading maps…</span>
        </div>
      ) : status === "error" ? (
        <Card>
          <CardContent>
            <div className="alert alert--danger">{errorMessage ?? "Failed to load maps. Please try again."}</div>
          </CardContent>
        </Card>
      ) : displayMaps.length === 0 ? (
        <Card>
          <CardContent>
            <div className="empty-state">No shared maps match this search yet.</div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="community-map-grid">
            {displayMaps.map((map) => {
              const rating = getViewerRating(map.id);
              const isOwner = Boolean(viewerUserId && map.ownerId === viewerUserId);
              const mapCanRate = canRate && !isOwner;
              const rateTitle = !canRate ? "Sign in to rate maps" : isOwner ? "You cannot rate your own map" : undefined;
              return (
                <Card key={map.id} className="community-map-card" role="article">
                  <CardHeader>
                    <button type="button" className="community-map-title community-map-title--clickable" onClick={() => onViewDetail(map)}>
                      <div className="community-map-title__body">
                        <CardTitle>{map.title}</CardTitle>
                        <CardDescription>by {map.authorName} · {map.mapWidth}×{map.mapHeight} · {map.playerCount} players</CardDescription>
                      </div>
                      <Badge className="community-map-title__badge">{map.templateName}</Badge>
                    </button>
                  </CardHeader>
                  <CardContent className="community-map-card__content">
                    <button type="button" className="community-map-preview-button" onClick={() => onViewDetail(map)}>
                      <CommunityMapCanvasPreview
                        className="community-map-preview"
                        previewDesignJson={map.previewDesignJson}
                        width={COMMUNITY_MAP_CARD_PREVIEW_SIZE.width}
                        height={COMMUNITY_MAP_CARD_PREVIEW_SIZE.height}
                        decorative
                        simplify
                        title={map.title}
                      />
                    </button>
                    <p className="community-map-summary">{map.summary}</p>
                    <div className="community-tag-row">
                      {map.tags.map((tag) => (
                        <Badge
                          key={tag.slug}
                          className={tag.kind === "factual" ? "community-tag-badge community-tag-badge--factual" : "community-tag-badge community-tag-badge--descriptive"}
                        >
                          {tag.label}
                        </Badge>
                      ))}
                    </div>
                    <div className="community-meta-row">
                      <span><strong>{map.zoneCount}</strong> zones</span>
                      <span><strong>{map.connectionCount}</strong> paths</span>
                      <span><strong>{map.downloadCount}</strong> downloads</span>
                    </div>
                    <div className="community-rating-row community-map-card__rating-row">
                      <div className="community-map-card__rating-summary">
                        <strong><Star size={14} /> {map.averageRating.toFixed(1)} / 5</strong>
                        <span>{map.ratingCount} ratings{rating ? ` · your score ${rating}` : ""}</span>
                      </div>
                      <div className="community-rate-buttons community-map-card__rate-buttons" aria-label={`Rate ${map.title}`}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Button
                            key={value}
                            size="sm"
                            variant={rating === value ? "gold" : "ghost"}
                            onClick={() => onRate(map.id, value)}
                            disabled={!mapCanRate}
                            title={rateTitle}
                            aria-label={`Rate ${value} stars for ${map.title}`}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="dialog-actions community-map-card__actions">
                      <Button variant="blue" onClick={() => onOpenInBuilder(map)}><Upload size={14} />Open in builder</Button>
                      <Button variant="primary" onClick={() => onDownload(map)}><Download size={14} />Download template</Button>
                      <Button variant="ghost" onClick={() => onDownloadImage(map)}><Download size={14} />Download image</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {result && result.pageCount > 1 ? (
            <div className="community-pagination">
              <Button
                size="sm"
                variant="ghost"
                disabled={result.page <= 1}
                onClick={() => onPageChange(result.page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />Previous
              </Button>
              <span className="community-pagination__info">
                Page {result.page} of {result.pageCount}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={result.page >= result.pageCount}
                onClick={() => onPageChange(result.page + 1)}
                aria-label="Next page"
              >
                Next<ChevronRight size={14} />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function buildRangeBounds(maps: CommunityMapRecord[]): BrowseRangeBounds[] {
  return BROWSE_RANGE_DEFINITIONS.map((definition) => {
    const values = maps.map(definition.mapValue).filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return { ...definition, min: definition.fallbackMin, max: definition.fallbackMax };
    }

    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);
    if (observedMin === observedMax) {
      return { ...definition, min: definition.fallbackMin, max: definition.fallbackMax };
    }
    return {
      ...definition,
      min: snapDown(observedMin, definition.step),
      max: snapUp(observedMax, definition.step)
    };
  });
}

function activeRangeForBounds(range: BrowseNumericRange | undefined, bounds: BrowseRangeBounds): { min: number; max: number } | null {
  const min = clampRangeValue(range?.min ?? bounds.min, bounds.min, bounds.max);
  const max = clampRangeValue(range?.max ?? bounds.max, bounds.min, bounds.max);
  if (min <= bounds.min && max >= bounds.max) return null;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function normalizeRangeForBounds(range: Required<BrowseNumericRange>, bounds: BrowseRangeBounds): BrowseNumericRange {
  const min = clampRangeValue(range.min, bounds.min, bounds.max);
  const max = clampRangeValue(range.max, bounds.min, bounds.max);
  const normalizedMin = Math.min(min, max);
  const normalizedMax = Math.max(min, max);
  return {
    ...(normalizedMin > bounds.min ? { min: normalizedMin } : {}),
    ...(normalizedMax < bounds.max ? { max: normalizedMax } : {})
  };
}

function clampRangeValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function snapDown(value: number, step: number): number {
  if (step <= 1) return Math.floor(value);
  return Math.floor(value / step) * step;
}

function snapUp(value: number, step: number): number {
  if (step <= 1) return Math.ceil(value);
  return Math.ceil(value / step) * step;
}

function rangeLabelForRemoval(key: BrowseRangeKey): string {
  if (key === "players") return "player range";
  if (key === "mapWidth") return "map width range";
  if (key === "mapHeight") return "map height range";
  if (key === "zones") return "zone range";
  return "path range";
}
