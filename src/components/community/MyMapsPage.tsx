import { Download, Edit3, Eye, EyeOff, FileJson, Loader2, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { ManagedMapCard, ManagedMapStatus, ManagedMapVisibility, MapListingPatch } from "@/community/communityApi";
import { CommunityMapCanvasPreview, COMMUNITY_MAP_CARD_PREVIEW_SIZE } from "@/components/community/CommunityMapCanvasPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";

export type MyMapsStatus = "idle" | "loading" | "loaded" | "error";

export function MyMapsPage({
  status,
  maps,
  errorMessage,
  onRefresh,
  onUpdateListing,
  onHide,
  onRestore,
  onDelete,
  onDownload,
  onDownloadImage,
  onOpenInBuilder
}: {
  status: MyMapsStatus;
  maps: ManagedMapCard[];
  errorMessage?: string;
  onRefresh(): void;
  onUpdateListing(mapId: string, patch: MapListingPatch): void;
  onHide(mapId: string): void;
  onRestore(mapId: string): void;
  onDelete(map: ManagedMapCard): void;
  onDownload(map: ManagedMapCard): void;
  onDownloadImage(map: ManagedMapCard): void;
  onOpenInBuilder(map: ManagedMapCard): void;
}): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<ManagedMapVisibility>("public");

  useEffect(() => {
    if (editingId && !maps.some((map) => map.id === editingId)) setEditingId(null);
  }, [editingId, maps]);

  function startEditing(map: ManagedMapCard): void {
    setEditingId(map.id);
    setEditTitle(map.title);
    setEditDescription(map.summary);
    setEditVisibility(map.visibility);
  }

  function saveEditing(map: ManagedMapCard): void {
    onUpdateListing(map.id, {
      title: editTitle.trim() || map.title,
      description: editDescription.trim(),
      visibility: editVisibility
    });
    setEditingId(null);
  }

  return (
    <section className="community-layout my-maps-page">
      <Card className="community-stats-card">
        <CardHeader>
          <div>
            <CardTitle><FileJson size={18} />My maps</CardTitle>
            <CardDescription>Manage uploaded map templates across public, unlisted, private, and hidden listings.</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw size={14} />Refresh</Button>
        </CardHeader>
        <CardContent className="community-stat-strip">
          <span><strong>{maps.length}</strong>Total uploads</span>
          <span><strong>{maps.filter((map) => map.status === "published").length}</strong>Published</span>
          <span><strong>{maps.filter((map) => map.status === "hidden").length}</strong>Hidden</span>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <div className="community-loading" role="status" aria-label="Loading my maps">
          <Loader2 size={24} className="community-spinner" />
          <span>Loading maps...</span>
        </div>
      ) : status === "error" ? (
        <Card>
          <CardContent>
            <div className="alert alert--danger">{errorMessage ?? "Failed to load your maps."}</div>
          </CardContent>
        </Card>
      ) : maps.length === 0 ? (
        <Card>
          <CardContent>
            <div className="empty-state">You have not uploaded any maps yet.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="community-map-grid">
          {maps.map((map) => {
            const editing = editingId === map.id;
            return (
              <Card key={map.id} className="community-map-card my-map-card" role="article">
                <CardHeader>
                  <div className="community-map-title">
                    <div>
                      <CardTitle>{map.title}</CardTitle>
                      <CardDescription>{map.mapWidth}x{map.mapHeight} · {map.playerCount} players · updated {new Date(map.updatedAt).toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="my-map-status-badges">
                      <Badge className={statusBadgeClass(map.status)}>{statusLabel(map.status)}</Badge>
                      <Badge>{visibilityLabel(map.visibility)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="community-map-card__content">
                  <CommunityMapCanvasPreview
                    className="community-map-preview"
                    previewDesignJson={map.previewDesignJson}
                    width={COMMUNITY_MAP_CARD_PREVIEW_SIZE.width}
                    height={COMMUNITY_MAP_CARD_PREVIEW_SIZE.height}
                    decorative
                    simplify
                    title={map.title}
                  />

                  {editing ? (
                    <div className="community-detail-edit-form">
                      <div className="config-field">
                        <label className="oe-field__label" htmlFor={`my-map-title-${map.id}`}>Title</label>
                        <Input id={`my-map-title-${map.id}`} value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} />
                      </div>
                      <div className="config-field">
                        <label className="oe-field__label" htmlFor={`my-map-description-${map.id}`}>Template Description</label>
                        <Textarea id={`my-map-description-${map.id}`} rows={4} value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} />
                      </div>
                      <div className="config-field">
                        <label className="oe-field__label" htmlFor={`my-map-visibility-${map.id}`}>Visibility</label>
                        <NativeSelect id={`my-map-visibility-${map.id}`} value={editVisibility} onChange={(event) => setEditVisibility(event.currentTarget.value as ManagedMapVisibility)}>
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="private">Private</option>
                        </NativeSelect>
                      </div>
                      <div className="dialog-actions">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button size="sm" variant="primary" onClick={() => saveEditing(map)}><Save size={14} />Save changes</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="community-map-summary">{map.summary || "No description provided."}</p>
                  )}

                  <div className="community-meta-row">
                    <span><strong>{map.zoneCount}</strong> zones</span>
                    <span><strong>{map.connectionCount}</strong> paths</span>
                    <span><strong>{map.downloadCount}</strong> downloads</span>
                    <span><strong>{map.ratingCount}</strong> ratings</span>
                  </div>

                  <div className="dialog-actions my-map-actions">
                    <Button size="sm" variant="blue" onClick={() => onOpenInBuilder(map)}><Upload size={14} />Open in builder</Button>
                    <Button size="sm" variant="primary" onClick={() => onDownload(map)}><Download size={14} />Download template</Button>
                    <Button size="sm" variant="ghost" onClick={() => onDownloadImage(map)}><Download size={14} />Download image</Button>
                    <Button size="sm" variant="ghost" onClick={() => startEditing(map)}><Edit3 size={14} />Edit listing</Button>
                    {map.status === "hidden" ? (
                      <Button size="sm" variant="green" onClick={() => onRestore(map.id)}><Eye size={14} />Restore</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => onHide(map.id)}><EyeOff size={14} />Hide</Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => onDelete(map)} aria-label={`Delete ${map.title}`}>
                      <Trash2 size={14} />Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function visibilityLabel(visibility: ManagedMapVisibility): string {
  return visibility[0].toUpperCase() + visibility.slice(1);
}

function statusLabel(status: ManagedMapStatus): string {
  return status[0].toUpperCase() + status.slice(1);
}

function statusBadgeClass(status: ManagedMapStatus): string | undefined {
  if (status === "hidden") return "community-tag-badge community-tag-badge--descriptive";
  if (status === "published") return "community-tag-badge community-tag-badge--factual";
  return undefined;
}
