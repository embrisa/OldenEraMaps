import { Share2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { CommunityUploadDraft } from "@/community/maps";
import { getAllowedDescriptiveTags } from "@/community/tags";
import {
  MAP_DESCRIPTION_MAX_LENGTH,
  normalizeMapDescription,
  validateAuthorDisplayName,
  validateMapDescription,
  validateMapTitle
} from "@/community/textValidation";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";

export function UploadMapDialog({
  open,
  onOpenChange,
  templateName,
  templateDescription,
  zoneCount,
  connectionCount,
  canShare,
  signedIn,
  defaultAuthorName,
  submitting = false,
  error,
  onSubmit
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  templateName: string;
  templateDescription: string;
  zoneCount: number;
  connectionCount: number;
  canShare: boolean;
  signedIn: boolean;
  defaultAuthorName: string;
  submitting?: boolean;
  error?: string;
  onSubmit(draft: CommunityUploadDraft): void;
}): JSX.Element {
  const [draft, setDraft] = useState<CommunityUploadDraft>(() => createDraft(templateName, templateDescription, defaultAuthorName));
  const descriptiveTags = getAllowedDescriptiveTags();
  const descriptiveTagLabels = new Map(descriptiveTags.map((tag) => [tag.slug, tag.label]));

  useEffect(() => {
    if (!open) return;
    setDraft(createDraft(templateName, templateDescription, defaultAuthorName));
  }, [defaultAuthorName, open, templateDescription, templateName]);

  const titleValidation = validateMapTitle(draft.title);
  const authorValidation = validateAuthorDisplayName(draft.authorName);
  const descriptionValidation = validateMapDescription(draft.summary);
  const title = titleValidation.ok ? titleValidation.value : draft.title.trim();
  const normalizedDescriptionLength = normalizeMapDescription(draft.summary).length;
  const hasValidationErrors = !titleValidation.ok || !authorValidation.ok || !descriptionValidation.ok;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="dialog-heading">
          <div>
            <DialogTitle>Share map template</DialogTitle>
            <DialogDescription>Publish the current builder design into the browse catalog with author, template description, tags, and rating support. Sign-in is required before publishing.</DialogDescription>
          </div>
        </div>
        <div className="balanced-random-dialog">
          <div className="balanced-random-dialog__summary">
            <span><Share2 size={14} />{templateName || "Untitled template"}</span>
            <span><strong>{zoneCount}</strong> zones</span>
            <span><strong>{connectionCount}</strong> paths</span>
          </div>
          {!canShare ? (
            <div className="alert alert--warning">Fix the current validation errors before sharing. Only valid exported templates should appear in public browse results.</div>
          ) : null}
          {!signedIn ? (
            <div className="alert alert--warning">Sign in before publishing this map template.</div>
          ) : null}
          {error ? (
            <div className="alert alert--danger">{error}</div>
          ) : null}
          <div className="form-grid form-grid--two">
            <div className="config-field">
              <label className="oe-field__label" htmlFor="upload-title">Listing title</label>
              <Input id="upload-title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.currentTarget.value }))} />
              {!titleValidation.ok ? <p className="community-upload-validation">{titleValidation.errors[0]}</p> : null}
            </div>
            <div className="config-field">
              <label className="oe-field__label" htmlFor="upload-author">Author</label>
              <Input id="upload-author" value={draft.authorName} onChange={(event) => setDraft((current) => ({ ...current, authorName: event.currentTarget.value }))} />
              {!authorValidation.ok ? <p className="community-upload-validation">{authorValidation.errors[0]}</p> : null}
            </div>
          </div>
          <div className="config-field">
            <label className="oe-field__label" htmlFor="upload-summary">Template Description</label>
            <Textarea
              id="upload-summary"
              rows={4}
              value={draft.summary}
              placeholder="Shown in game and on the browse page."
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.currentTarget.value }))}
            />
            <div className="community-upload-field-meta">
              <span>{normalizedDescriptionLength} / {MAP_DESCRIPTION_MAX_LENGTH}</span>
            </div>
            {!descriptionValidation.ok ? <p className="community-upload-validation">{descriptionValidation.errors[0]}</p> : null}
          </div>
          <div className="config-field">
            <span className="oe-field__label">Descriptive tags</span>
            <p className="community-upload-tags-note">
              Select gameplay descriptors only. Player count, map size, win condition, zones, and reliable topology tags are derived automatically after upload.
            </p>
            <div className="community-upload-tag-grid">
              {descriptiveTags.map((tag) => {
                const checked = draft.descriptiveTagSlugs.includes(tag.slug);
                return (
                  <label key={tag.slug} className="checkline">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => setDraft((current) => ({
                        ...current,
                        descriptiveTagSlugs: value === true
                          ? [...current.descriptiveTagSlugs, tag.slug]
                          : current.descriptiveTagSlugs.filter((slug) => slug !== tag.slug)
                      }))}
                    />
                    <span>{tag.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="form-grid form-grid--two">
            <div className="config-field">
              <label className="oe-field__label" htmlFor="upload-visibility">Visibility</label>
              <NativeSelect
                id="upload-visibility"
                value={draft.visibility}
                onChange={(event) => setDraft((current) => ({ ...current, visibility: event.currentTarget.value as CommunityUploadDraft["visibility"] }))}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
              </NativeSelect>
            </div>
            <div className="config-field">
              <span className="oe-field__label">Selected descriptors</span>
              <div className="community-tag-row">
                {draft.descriptiveTagSlugs.length === 0
                  ? <span className="community-filter-empty">No descriptive tags selected.</span>
                  : draft.descriptiveTagSlugs.map((slug) => <span key={slug} className="oe-badge">{descriptiveTagLabels.get(slug) ?? slug}</span>)}
              </div>
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!canShare || !signedIn || submitting || title.length === 0 || hasValidationErrors) return;
                onSubmit({
                  ...draft,
                  title,
                  summary: descriptionValidation.ok ? descriptionValidation.value : draft.summary,
                  authorName: authorValidation.ok ? authorValidation.value : draft.authorName
                });
              }}
              disabled={!canShare || !signedIn || submitting || title.length === 0 || hasValidationErrors}
            >
              <Share2 size={14} />{submitting ? "Sharing..." : "Share map"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function createDraft(templateName: string, templateDescription: string, defaultAuthorName: string): CommunityUploadDraft {
  return {
    title: templateName || "Untitled template",
    summary: templateDescription,
    authorName: defaultAuthorName || "Anonymous Cartographer",
    descriptiveTagSlugs: [],
    visibility: "public"
  };
}
