export const MAP_TITLE_MAX_LENGTH = 96;
export const MAP_DESCRIPTION_MAX_LENGTH = 800;
export const AUTHOR_DISPLAY_NAME_MAX_LENGTH = 64;
const ALLOWED_BRANDING_URL_PATTERN = /(^|[^A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.)?OldenEraMaps\.com(?:\/(?=$|[\s,.;:!?)]))?(?=$|[\s,;:!?)]|\.(?:$|\s))/gi;
const GENERIC_URL_PATTERN = /\bhttps?:\/\/\S+/i;
const WWW_URL_PATTERN = /\bwww\.\S+/i;

export type TextValidationResult =
  | { ok: true; value: string }
  | { ok: false; errors: string[] };

interface TextValidationOptions {
  fieldLabel: string;
  maxLength: number;
  multiline: boolean;
}

export function validateMapTitle(value: string): TextValidationResult {
  return validateRestrictedText(value, {
    fieldLabel: "Title",
    maxLength: MAP_TITLE_MAX_LENGTH,
    multiline: false
  });
}

export function validateMapDescription(value: string): TextValidationResult {
  return validateRestrictedText(value, {
    fieldLabel: "Description",
    maxLength: MAP_DESCRIPTION_MAX_LENGTH,
    multiline: true
  });
}

export function validateAuthorDisplayName(value: string): TextValidationResult {
  return validateRestrictedText(value, {
    fieldLabel: "Author name",
    maxLength: AUTHOR_DISPLAY_NAME_MAX_LENGTH,
    multiline: false
  });
}

export function normalizeMapTitle(value: string): string {
  return normalizeSingleLine(value);
}

export function normalizeMapDescription(value: string): string {
  return normalizeMultiline(value);
}

export function normalizeAuthorDisplayName(value: string): string {
  return normalizeSingleLine(value);
}

function validateRestrictedText(value: string, options: TextValidationOptions): TextValidationResult {
  const normalized = options.multiline ? normalizeMultiline(value) : normalizeSingleLine(value);
  const raw = String(value ?? "").replace(/\r\n?/g, "\n");
  const errors = new Set<string>();

  if (normalized.length > options.maxLength) {
    errors.add(`${options.fieldLabel} must be ${options.maxLength} characters or less.`);
  }
  if (containsUrl(raw) || containsMarkdownLink(raw)) {
    errors.add(`${options.fieldLabel} cannot contain links or URLs.`);
  }
  if (containsHtmlTag(raw)) {
    errors.add(`${options.fieldLabel} cannot contain HTML tags.`);
  }
  if (containsMarkdownCode(raw)) {
    errors.add(`${options.fieldLabel} cannot contain Markdown code formatting.`);
  }
  if (options.multiline && containsIndentedCodeBlock(raw)) {
    errors.add(`${options.fieldLabel} cannot contain indented code blocks.`);
  }

  if (errors.size > 0) {
    return { ok: false, errors: [...errors] };
  }
  return { ok: true, value: normalized };
}

function normalizeSingleLine(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMultiline(value: string): string {
  const lines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim());

  while (lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  return lines.join("\n");
}

function containsUrl(value: string): boolean {
  const withoutAllowedBranding = value.replace(ALLOWED_BRANDING_URL_PATTERN, "$1");
  return GENERIC_URL_PATTERN.test(withoutAllowedBranding) || WWW_URL_PATTERN.test(withoutAllowedBranding);
}

function containsMarkdownLink(value: string): boolean {
  return /\[[^\]\n]+\]\([^)]+\)/.test(value);
}

function containsHtmlTag(value: string): boolean {
  return /<\s*\/?\s*[a-z][^>\n]*>/i.test(value);
}

function containsMarkdownCode(value: string): boolean {
  return /```|`/.test(value);
}

function containsIndentedCodeBlock(value: string): boolean {
  return value.split("\n").some((line) => /^(?: {4,}|\t+)\S/.test(line));
}
