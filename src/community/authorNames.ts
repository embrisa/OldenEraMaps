export const ANONYMOUS_AUTHOR_NAME = "Anonymous Cartographer";

export function resolvePublicAuthorName(authorName?: string | null, profileDisplayName?: string | null): string {
  const normalizedAuthorName = normalizeAuthorName(authorName);
  const normalizedProfileDisplayName = normalizeAuthorName(profileDisplayName);

  if (normalizedAuthorName && normalizedAuthorName !== ANONYMOUS_AUTHOR_NAME) return normalizedAuthorName;
  if (normalizedProfileDisplayName && normalizedProfileDisplayName !== ANONYMOUS_AUTHOR_NAME) return normalizedProfileDisplayName;
  return normalizedAuthorName ?? normalizedProfileDisplayName ?? ANONYMOUS_AUTHOR_NAME;
}

function normalizeAuthorName(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}