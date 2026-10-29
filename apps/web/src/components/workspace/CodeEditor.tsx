'use client';
import { useEffect, useRef } from 'react';
import Editor, { loader, type Monaco, type OnMount } from '@monaco-editor/react';
import { MONACO_VS } from '@/lib/monaco-version';

// Monaco's own build, served from this site (scripts/copy-monaco.ts): no CDN.
loader.config({ paths: { vs: MONACO_VS } });

type EditorInstance = Parameters<OnMount>[0];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isLight(): boolean {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || (t === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
}

/** Editor themes from the live design tokens, so the editor follows the site's theme. */
function defineThemes(monaco: Monaco) {
  const hex = (n: string) => cssVar(n).replace('#', '');
  const light = isLight();
  monaco.editor.defineTheme('kingcoda', {
    base: light ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: light ? '6B7185' : '8B93A7', fontStyle: 'italic' },
      { token: 'keyword', foreground: light ? '5442E0' : 'C4B5FD' },
      { token: 'number', foreground: light ? 'B45309' : 'FDBA74' },
      { token: 'string', foreground: light ? '047857' : '5EEAD4' },
      { token: 'type', foreground: light ? '0369A1' : '7DD3FC' },
    ],
    colors: {
      'editor.background': `#${hex('--kc-sunken')}`,
      'editor.foreground': `#${hex('--kc-text')}`,
      'editorLineNumber.foreground': `#${hex('--kc-text-faint')}`,
      'editorLineNumber.activeForeground': `#${hex('--kc-text-muted')}`,
      'editor.lineHighlightBackground': `#${hex('--kc-hover')}`,
      'editor.selectionBackground': light ? '#D6D1FF' : '#3A3270',
      'editorCursor.foreground': `#${hex('--kc-violet-light')}`,
      'editorWidget.background': `#${hex('--kc-surface')}`,
      'editorWidget.border': `#${hex('--kc-border')}`,
    },
  });
}

export interface CodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  /** Line to highlight from a compile error, 1-based. */
  errorLine?: number | null;
}

export function CodeEditor({ value, onChange, onRun, onSubmit, errorLine }: CodeEditorProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const actions = useRef({ onRun, onSubmit });
  useEffect(() => {
    actions.current = { onRun, onSubmit };
  }, [onRun, onSubmit]);

  // Re-theme when the site theme changes (toggle, or the OS for "system").
  useEffect(() => {
    const retheme = () => {
      if (!monacoRef.current) return;
      defineThemes(monacoRef.current);
      monacoRef.current.editor.setTheme('kingcoda');
    };
    const observer = new MutationObserver(retheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', retheme);
    return () => {
      observer.disconnect();
      mq.removeEventListener('change', retheme);
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      'judge',
      errorLine
        ? [
            {
              startLineNumber: errorLine,
              endLineNumber: errorLine,
              startColumn: 1,
              endColumn: model.getLineMaxColumn(Math.min(errorLine, model.getLineCount())),
              message: 'Compile error (see the console)',
              severity: monaco.MarkerSeverity.Error,
            },
          ]
        : [],
    );
    if (errorLine) editor.revealLineInCenterIfOutsideViewport(errorLine);
  }, [errorLine]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    defineThemes(monaco);
    monaco.editor.setTheme('kingcoda');
    // Same shortcuts as the page, so they work with focus in the editor too.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => actions.current.onRun());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
      actions.current.onSubmit(),
    );
  };

  return (
    <Editor
      language="cpp"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      theme="vs-dark"
      loading={<div className="p-4 font-mono text-[13px] text-text-muted">Loading the editor…</div>}
      options={{
        fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
        fontSize: 14,
        lineHeight: 22,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        automaticLayout: true,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: 'line',
        smoothScrolling: true,
        ariaLabel: 'Code editor. Ctrl+Enter runs, Ctrl+Shift+Enter submits.',
        // Tab inserts indentation; Ctrl+M toggles it to move focus (Monaco's accessibility mode).
        tabFocusMode: false,
      }}
    />
  );
}
