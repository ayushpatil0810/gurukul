"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { Check, Code2, Copy, RotateCcw, Type } from "lucide-react";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 font-mono text-xs text-zinc-500">
      Loading Monaco Code Engine...
    </div>
  ),
});

interface EditorPanelProps {
  language: string;
  languages: string[];
  code: string;
  onChangeCode: (code: string) => void;
  onSelectLanguage: (language: string) => void;
  onResetStarter: () => void;
  onMountEditor?: OnMount;
}

export function EditorPanel({
  language,
  languages,
  code,
  onChangeCode,
  onSelectLanguage,
  onResetStarter,
  onMountEditor,
}: EditorPanelProps) {
  const [fontSize, setFontSize] = useState<number>(13.5);
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const editorRef = useRef<unknown>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    onMountEditor?.(editor, monaco);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xs">
      {/* Editor Header Bar (LeetCode Style) */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-xs font-medium text-zinc-200">
            <Code2 className="size-3.5 text-emerald-400" />
            <select
              value={language}
              onChange={(e) => onSelectLanguage(e.target.value)}
              className="bg-transparent font-sans text-xs font-semibold text-zinc-200 focus:outline-hidden cursor-pointer capitalize"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang} className="bg-zinc-900 text-zinc-200">
                  {lang === "javascript"
                    ? "JavaScript (Node.js)"
                    : lang === "typescript"
                    ? "TypeScript"
                    : lang === "python"
                    ? "Python 3"
                    : lang === "cpp"
                    ? "C++ 20"
                    : lang}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-mono text-zinc-500">
            solution.{language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "python" ? "py" : language === "cpp" ? "cpp" : "code"}
          </span>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1">
          {/* Font Size Toggle */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setFontSize((s) => (s === 12 ? 13.5 : s === 13.5 ? 15 : 12))}
              title="Toggle Font Size"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <Type className="size-3 text-zinc-400" />
              <span>{fontSize}px</span>
            </button>
          </div>

          {/* Copy Code */}
          <button
            type="button"
            onClick={() => void handleCopy()}
            title="Copy code"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Reset Code */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowResetConfirm(!showResetConfirm)}
              title="Reset code to default template"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>

            {showResetConfirm ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs shadow-xl space-y-2">
                <p className="font-semibold text-zinc-200 text-[11px]">
                  Reset to default template?
                </p>
                <p className="text-[10px] text-zinc-400">
                  Your current modifications will be replaced by the challenge starter code.
                </p>
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetStarter();
                      setShowResetConfirm(false);
                    }}
                    className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-500"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex-1 min-h-[300px]">
        <Editor
          height="100%"
          language={language === "cpp" ? "cpp" : language}
          theme="vs-dark"
          value={code}
          onChange={(val) => onChangeCode(val ?? "")}
          onMount={handleMount}
          options={{
            fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            renderLineHighlight: "all",
            roundedSelection: true,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
          }}
        />
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/60 px-3 py-1 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Monaco Sandbox Engine</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Ctrl + Enter to Run</span>
        </div>
      </div>
    </div>
  );
}
