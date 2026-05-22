import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type JSX, type MutableRefObject } from "react";
import { createJSONEditor, expandNone, Mode, type Content, type ContentErrors, type JsonEditor, type MenuItem } from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";
import { Textarea } from "@/components/ui/form-controls";

const USE_TEXTAREA_FALLBACK = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

export interface RmgJsonEditorHandle {
  getText(): string;
}

interface RmgJsonEditorProps {
  value: string;
  disabled?: boolean;
  onChange(value: string, parseError?: string): void;
}

export const RmgJsonEditor = forwardRef<RmgJsonEditorHandle, RmgJsonEditorProps>(function RmgJsonEditor({
  value,
  disabled,
  onChange
}, ref): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonEditor | null>(null);
  const latestValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [mode, setMode] = useState(Mode.text);
  const setTextMode = (nextMode: Mode) => {
    setMode(nextMode === Mode.text ? nextMode : Mode.text);
  };

  useImperativeHandle(ref, () => ({
    getText() {
      if (USE_TEXTAREA_FALLBACK || !editorRef.current) return latestValueRef.current;
      const content = editorRef.current.get();
      const nextValue = contentToText(content);
      latestValueRef.current = nextValue;
      return nextValue;
    }
  }), []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (USE_TEXTAREA_FALLBACK || !containerRef.current) return;

    editorRef.current = createJSONEditor({
      target: containerRef.current,
      props: buildEditorProps(value, disabled, mode, setTextMode, onChangeRef, latestValueRef)
    });

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (USE_TEXTAREA_FALLBACK || !editorRef.current) return;

    if (latestValueRef.current !== value) {
      latestValueRef.current = value;
    }

    editorRef.current.updateProps(buildEditorProps(value, disabled, mode, setTextMode, onChangeRef, latestValueRef));
  }, [disabled, mode, value]);

  useEffect(() => {
    if (USE_TEXTAREA_FALLBACK || !editorRef.current) return;
    collapseJsonViewer(editorRef.current, mode);
  }, [mode]);

  if (USE_TEXTAREA_FALLBACK) {
    return (
      <Textarea
        className="rmg-json-editor__fallback"
        spellCheck={false}
        value={value}
        readOnly={disabled}
        aria-label="RMG JSON editor"
        onChange={(event) => {
          latestValueRef.current = event.currentTarget.value;
          onChange(event.currentTarget.value);
        }}
      />
    );
  }

  return <div ref={containerRef} className="rmg-json-editor jse-theme-dark" aria-label="RMG JSON editor" />;
});

function collapseJsonViewer(editor: JsonEditor, mode: Mode): void {
  editor.collapse([], true);
  if (mode === Mode.tree) {
    editor.expand([], expandNone);
  }
}

function buildEditorProps(
  value: string,
  disabled: boolean | undefined,
  mode: Mode,
  onChangeMode: (mode: Mode) => void,
  onChangeRef: MutableRefObject<(value: string, parseError?: string) => void>,
  latestValueRef: MutableRefObject<string>
) {
  return {
    content: { text: value } satisfies Content,
    mode,
    readOnly: disabled,
    mainMenuBar: true,
    navigationBar: true,
    statusBar: true,
    indentation: 2,
    onChangeMode,
    onRenderMenu: removeTreeAndTableModeMenuItems,
    onChange(content: Content, _previousContent: Content, status: { contentErrors: ContentErrors | undefined }) {
      const nextValue = contentToText(content);
      latestValueRef.current = nextValue;
      onChangeRef.current(nextValue, summarizeContentError(status.contentErrors));
    }
  };
}

type JsonEditorMenuItem = MenuItem & {
  main?: JsonEditorMenuItem;
  items?: JsonEditorMenuItem[];
};

function removeTreeAndTableModeMenuItems(items: MenuItem[]): MenuItem[] {
  return (items as JsonEditorMenuItem[])
    .map(removeDisabledModeMenuItems)
    .filter((item): item is JsonEditorMenuItem => Boolean(item)) as MenuItem[];
}

function removeDisabledModeMenuItems(item: JsonEditorMenuItem): JsonEditorMenuItem | undefined {
  if (isTreeOrTableModeItem(item)) return undefined;

  if (item.items) {
    const items = item.items.map(removeDisabledModeMenuItems).filter((child): child is JsonEditorMenuItem => Boolean(child));
    if (item.main && isModeMenuItem(item.main) && items.length <= 1) return undefined;
    return { ...item, items };
  }

  return item;
}

function isTreeOrTableModeItem(item: JsonEditorMenuItem): boolean {
  if (item.type !== "button") return false;
  const label = `${item.text ?? ""} ${item.title ?? ""}`.toLowerCase();
  return /\b(tree|table)\b/.test(label);
}

function isModeMenuItem(item: JsonEditorMenuItem): boolean {
  if (item.type !== "button") return false;
  const label = `${item.text ?? ""} ${item.title ?? ""}`.toLowerCase();
  return /\b(text|tree|table)\b/.test(label);
}

function contentToText(content: Content): string {
  const runtimeContent = content as Content & { text?: string; json?: unknown };
  if (typeof runtimeContent.text === "string") return runtimeContent.text;
  if ("json" in runtimeContent) {
    const serialized = JSON.stringify(runtimeContent.json, null, 2);
    return serialized ?? "";
  }
  return "";
}

function summarizeContentError(error: ContentErrors | undefined): string | undefined {
  if (!error) return undefined;
  if ("parseError" in error) {
    const { message, line, column } = error.parseError;
    if (line !== undefined && column !== undefined) {
      return `${message} (line ${line}, column ${column})`;
    }
    return message;
  }
  return error.validationErrors[0]?.message ?? "JSON validation error.";
}
