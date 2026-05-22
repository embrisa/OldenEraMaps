import { Download, Edit3, Eye, EyeOff, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { MapDetail, MapListingPatch } from "@/community/communityApi";
import { SchematicBoardLegend } from "@/components/DesignBoardCanvas";
import { CommunityMapCanvasPreview, COMMUNITY_MAP_DETAIL_PREVIEW_SIZE } from "@/components/community/CommunityMapCanvasPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";

export function MapDetailDialog({
  map,
  open,
  onOpenChange,
  viewerRating,
  canRate,
  isOwner,
  onRate,
  onDownload,
  onOpenInBuilder,
  onUpdateListing,
  onHide
}: {
  map: MapDetail | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  viewerRating?: number;
  canRate: boolean;
  isOwner: boolean;
  onRate(mapId: string, value: number): void;
  onDownload(map: MapDetail): void;
  onOpenInBuilder(map: MapDetail): void;
  onUpdateListing?(mapId: string, patch: MapListingPatch): void;
  onHide?(mapId: string): void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "unlisted">("public");

  useEffect(() => {
    if (!open || !map) return;
    setEditing(false);
    setEditTitle(map.title);
    setEditDescription(map.summary);
    setEditVisibility(map.visibility);
  }, [open, map]);

  if (!map) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="dialog-heading">
            <DialogTitle>Map details</DialogTitle>
            <DialogDescription>Loading map information…</DialogDescription>
          </div>
          <div className="community-detail-loading">Loading…</div>
        </DialogContent>
      </Dialog>
    );
  }

  function handleSaveEdits(): void {
    if (!map || !onUpdateListing) return;
    onUpdateListing(map.id, {
      title: editTitle.trim() || map.title,
      description: editDescription.trim(),
      visibility: editVisibility
    });
    setEditing(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="community-detail-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>{map.title}</DialogTitle>
            <DialogDescription>by {map.authorName} · {map.mapWidth}×{map.mapHeight} · {map.playerCount} players</DialogDescription>
          </div>
          <Badge>{map.templateName}</Badge>
        </div>

        <div className="community-detail-body">
          <div className="community-detail-preview-stack">
            <CommunityMapCanvasPreview
              className="community-detail-preview"
              previewDesignJson={map.previewDesignJson}
              width={COMMUNITY_MAP_DETAIL_PREVIEW_SIZE.width}
              height={COMMUNITY_MAP_DETAIL_PREVIEW_SIZE.height}
              ariaLabel={`Preview of ${map.title}`}
              title={map.title}
              presentation="builder"
            />
            <SchematicBoardLegend />
          </div>

          {editing ? (
            <div className="community-detail-edit-form">
              <div className="config-field">
                <label className="oe-field__label" htmlFor="detail-edit-title">Title</label>
                <Input id="detail-edit-title" value={editTitle} onChange={(e) => setEditTitle(e.currentTarget.value)} />
              </div>
              <div className="config-field">
                <label className="oe-field__label" htmlFor="detail-edit-description">Template Description</label>
                <Textarea id="detail-edit-description" rows={4} value={editDescription} onChange={(e) => setEditDescription(e.currentTarget.value)} />
              </div>
              <div className="config-field">
                <label className="oe-field__label" htmlFor="detail-edit-visibility">Visibility</label>
                <NativeSelect id="detail-edit-visibility" value={editVisibility} onChange={(e) => setEditVisibility(e.currentTarget.value as "public" | "unlisted")}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                </NativeSelect>
              </div>
              <div className="dialog-actions">
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveEdits}>Save changes</Button>
              </div>
            </div>
          ) : (
            <p className="community-detail-description">{map.summary || "No description provided."}</p>
          )}

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

          <Card className="community-detail-metadata">
            <CardContent>
              <table className="community-detail-table">
                <tbody>
                  <tr><td>Size</td><td>{map.mapWidth}×{map.mapHeight}</td></tr>
                  <tr><td>Players</td><td>{map.playerCount}</td></tr>
                  <tr><td>Zones</td><td>{map.zoneCount}</td></tr>
                  <tr><td>Connections</td><td>{map.connectionCount}</td></tr>
                  <tr><td>Win condition</td><td>{map.winCondition}</td></tr>
                  <tr><td>Downloads</td><td>{map.downloadCount}</td></tr>
                  <tr><td>Uploaded</td><td>{new Date(map.uploadedAt).toLocaleDateString()}</td></tr>
                  {map.updatedAt !== map.uploadedAt ? (
                    <tr><td>Updated</td><td>{new Date(map.updatedAt).toLocaleDateString()}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="community-rating-row">
            <div>
              <strong><Star size={14} /> {map.averageRating.toFixed(1)} / 5</strong>
              <span>{map.ratingCount} ratings{viewerRating ? ` · your score ${viewerRating}` : ""}</span>
            </div>
            <div className="community-rate-buttons" aria-label={`Rate ${map.title}`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={viewerRating === value ? "gold" : "ghost"}
                  onClick={() => onRate(map.id, value)}
                  disabled={!canRate}
                  title={canRate ? undefined : isOwner ? "You cannot rate your own map" : "Sign in to rate maps"}
                  aria-label={`Rate ${value} stars for ${map.title}`}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div className="dialog-actions">
            <Button variant="blue" onClick={() => onOpenInBuilder(map)}><Upload size={14} />Open in builder</Button>
            <Button variant="primary" onClick={() => onDownload(map)}><Download size={14} />Download template</Button>
          </div>

          {isOwner && !editing ? (
            <div className="community-detail-owner-controls">
              <span className="oe-field__label">Owner controls</span>
              <div className="dialog-actions">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Edit3 size={14} />Edit listing
                </Button>
                {map.visibility === "public" ? (
                  <Button size="sm" variant="ghost" onClick={() => onUpdateListing?.(map.id, { visibility: "unlisted" })}>
                    <EyeOff size={14} />Make unlisted
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onUpdateListing?.(map.id, { visibility: "public" })}>
                    <Eye size={14} />Make public
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => {
                  if (window.confirm("Hide this map from the catalog? It can be restored later.")) {
                    onHide?.(map.id);
                  }
                }}>
                  <Trash2 size={14} />Hide listing
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
