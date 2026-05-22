// @vitest-environment jsdom

import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  const originalUserAgent = "Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom";
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: originalUserAgent
  });
  vi.resetModules();
  vi.doUnmock("vanilla-jsoneditor");
});

describe("RmgJsonEditor", () => {
  it("defaults to text mode, keeps JSON collapsed, and disables tree/table modes", async () => {
    const value = `{
  "name": "Custom Template"
}`;

    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0"
    });

    const updateProps = vi.fn();
    const expand = vi.fn();
    const collapse = vi.fn();
    const destroy = vi.fn();
    const get = vi.fn(() => ({ text: value }));
    const createJSONEditor = vi.fn(({ props }: { props: { content: { text: string }; mode: string; onChangeMode?: (mode: string) => void; onRenderMenu?: (items: unknown[]) => unknown[] } }) => ({
      get,
      updateProps,
      expand,
      collapse,
      destroy,
      props
    }));
    const expandNone = vi.fn(() => false);
    const Mode = {
      text: "text",
      tree: "tree",
      table: "table"
    };

    vi.doMock("vanilla-jsoneditor", () => ({
      createJSONEditor,
      expandNone,
      Mode
    }));

    const { RmgJsonEditor } = await import("@/components/builder/RmgJsonEditor");

    const { rerender } = render(<RmgJsonEditor value={value} onChange={() => undefined} />);

    const initialProps = createJSONEditor.mock.calls[0]?.[0]?.props as {
      mode: string;
      onChangeMode?: (mode: string) => void;
      onRenderMenu?: (items: unknown[]) => unknown[];
    };
    expect(initialProps.mode).toBe(Mode.text);
    await waitFor(() => {
      expect(collapse).toHaveBeenCalledWith([], true);
    });
    expect(expand).not.toHaveBeenCalled();
    expect(initialProps.onRenderMenu?.([
      { type: "button", text: "Format" },
      {
        type: "dropdown-button",
        main: { type: "button", text: "Text" },
        items: [
          { type: "button", text: "Text" },
          { type: "button", text: "Tree" },
          { type: "button", text: "Table" }
        ]
      }
    ])).toEqual([{ type: "button", text: "Format" }]);

    act(() => {
      initialProps.onChangeMode?.(Mode.tree);
    });

    await waitFor(() => {
      expect(updateProps).toHaveBeenCalledWith(expect.objectContaining({ mode: Mode.text }));
    });
    expect(collapse).toHaveBeenCalledWith([], true);
    expect(expand).not.toHaveBeenCalled();

    act(() => {
      initialProps.onChangeMode?.(Mode.table);
    });

    await waitFor(() => {
      expect(updateProps).toHaveBeenCalledWith(expect.objectContaining({ mode: Mode.text }));
    });
    expect(expand).not.toHaveBeenCalled();

    rerender(<RmgJsonEditor value={value.replace("Custom Template", "Updated Template")} onChange={() => undefined} />);

    await waitFor(() => {
      expect(updateProps).toHaveBeenCalledWith(expect.objectContaining({
        content: { text: value.replace("Custom Template", "Updated Template") },
        mode: Mode.text
      }));
    });
    expect(collapse).toHaveBeenCalledTimes(1);
    expect(expand).not.toHaveBeenCalled();
  });
});
