import { describe, expect, it } from "vitest";
import {
  validateMapDescription,
  validateMapTitle,
  validateAuthorDisplayName,
  normalizeMapDescription,
  MAP_DESCRIPTION_MAX_LENGTH,
  MAP_TITLE_MAX_LENGTH,
  AUTHOR_DISPLAY_NAME_MAX_LENGTH
} from "../src/community/textValidation";

describe("text validation", () => {
  it("accepts plain descriptions", () => {
    const result = validateMapDescription("Fast 1v1 with a central neutral breakpoint.");
    expect(result).toEqual({ ok: true, value: "Fast 1v1 with a central neutral breakpoint." });
  });

  it("accepts empty descriptions", () => {
    const result = validateMapDescription("");
    expect(result).toEqual({ ok: true, value: "" });
  });

  it("normalizes repeated whitespace in descriptions", () => {
    const result = validateMapDescription("  Fast   map  \nwith   lanes  ");
    expect(result).toEqual({ ok: true, value: "Fast map\nwith lanes" });
  });

  it("preserves ordinary line breaks", () => {
    const result = validateMapDescription("Line one.\nLine two.\nLine three.");
    expect(result).toEqual({ ok: true, value: "Line one.\nLine two.\nLine three." });
  });

  it("rejects https:// URLs", () => {
    const result = validateMapDescription("Check https://example.com for details.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain links or URLs.");
  });

  it("rejects http:// URLs", () => {
    const result = validateMapDescription("Visit http://example.com now.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain links or URLs.");
  });

  it("rejects www. URLs", () => {
    const result = validateMapDescription("Go to www.example.com.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain links or URLs.");
  });

  it("accepts the OldenEraMaps branding URL in descriptions", () => {
    const result = validateMapDescription("Built with www.OldenEraMaps.com");
    expect(result).toEqual({ ok: true, value: "Built with www.OldenEraMaps.com" });
  });

  it("accepts canonical OldenEraMaps homepage variants in descriptions", () => {
    expect(validateMapDescription("Built with https://www.OldenEraMaps.com/").ok).toBe(true);
    expect(validateMapDescription("Built with oldeneramaps.com").ok).toBe(true);
    expect(validateMapDescription("Built with www.OldenEraMaps.com.").ok).toBe(true);
  });

  it("rejects OldenEraMaps lookalike URLs in descriptions", () => {
    expect(validateMapDescription("Built with https://www.OldenEraMaps.com.evil.test").ok).toBe(false);
    expect(validateMapDescription("Built with www.OldenEraMaps.com/path").ok).toBe(false);
  });

  it("rejects markdown links", () => {
    const result = validateMapDescription("[click](https://example.com)");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain links or URLs.");
  });

  it("rejects inline backticks", () => {
    const result = validateMapDescription("Use `code` here.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain Markdown code formatting.");
  });

  it("rejects triple backticks", () => {
    const result = validateMapDescription("```\nsome code\n```");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain Markdown code formatting.");
  });

  it("rejects HTML tags", () => {
    const result = validateMapDescription("<b>text</b>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain HTML tags.");
  });

  it("rejects script tags", () => {
    const result = validateMapDescription("<script>alert(1)</script>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain HTML tags.");
  });

  it("rejects anchor tags", () => {
    const result = validateMapDescription('<a href="https://evil.test">click</a>');
    expect(result.ok).toBe(false);
  });

  it("rejects overlong descriptions", () => {
    const result = validateMapDescription("x".repeat(MAP_DESCRIPTION_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description must be 800 characters or less.");
  });

  it("accepts descriptions at exactly the max length", () => {
    const result = validateMapDescription("x".repeat(MAP_DESCRIPTION_MAX_LENGTH));
    expect(result.ok).toBe(true);
  });

  it("rejects indented code blocks", () => {
    const result = validateMapDescription("normal line\n    code block here");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Description cannot contain indented code blocks.");
  });

  it("validates titles the same way", () => {
    expect(validateMapTitle("Good Title").ok).toBe(true);
    expect(validateMapTitle("Bad <b>Title</b>").ok).toBe(false);
    expect(validateMapTitle("x".repeat(MAP_TITLE_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("validates author display names", () => {
    expect(validateAuthorDisplayName("Map Maker").ok).toBe(true);
    expect(validateAuthorDisplayName("https://spam.example").ok).toBe(false);
    expect(validateAuthorDisplayName("x".repeat(AUTHOR_DISPLAY_NAME_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("normalizes multiline descriptions correctly", () => {
    expect(normalizeMapDescription("\r\n  Hello  world \r\n  Second  line \r\n")).toBe("Hello world\nSecond line");
  });
});
