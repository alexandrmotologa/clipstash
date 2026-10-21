import React, { useState, useMemo } from "react";
import { X, GitCompare, Copy, Check, ArrowRightLeft, FileCode } from "lucide-react";
import type { ClipItem } from "../types/clip";
import { computeLineDiff, formatAsPatch, type DiffResult } from "../lib/diff";
import { sounds } from "../lib/audio";

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: ClipItem[];
  revealedSecrets: Record<string, string>;
  onCopyText: (text: string) => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  isOpen,
  onClose,
  clips,
  revealedSecrets,
  onCopyText,
}) => {
  const [selectedIdA, setSelectedIdA] = useState<string>(clips[1]?.id || clips[0]?.id || "");
  const [selectedIdB, setSelectedIdB] = useState<string>(clips[0]?.id || "");
  const [viewMode, setViewMode] = useState<"side" | "unified">("side");
  const [copiedPatch, setCopiedPatch] = useState(false);

  // Get raw texts
  const clipA = clips.find((c) => c.id === selectedIdA);
  const clipB = clips.find((c) => c.id === selectedIdB);

  const textA = useMemo(() => {
    if (!clipA) return "";
    return revealedSecrets[clipA.id] || clipA.masked_content;
  }, [clipA, revealedSecrets]);

  const textB = useMemo(() => {
    if (!clipB) return "";
    return revealedSecrets[clipB.id] || clipB.masked_content;
  }, [clipB, revealedSecrets]);

  const diffResult: DiffResult = useMemo(() => {
    return computeLineDiff(textA, textB);
  }, [textA, textB]);

  const handleSwap = () => {
    setSelectedIdA(selectedIdB);
    setSelectedIdB(selectedIdA);
    sounds.playKeyNav();
  };

  const handleCopyPatch = () => {
    const patch = formatAsPatch("original", "modified", diffResult);
    onCopyText(patch);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] bg-[#0c0d14] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Side-by-Side Diff Inspector</h2>
              <p className="text-[11px] text-zinc-400">
                Compare text snippets, JSON payloads, or code revisions line-by-line
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setViewMode("side")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  viewMode === "side"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode("unified")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  viewMode === "unified"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Unified Patch
              </button>
            </div>

            {/* Copy Patch Button */}
            <button
              onClick={handleCopyPatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            >
              {copiedPatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPatch ? "Patch Copied!" : "Copy Patch"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clip Selectors Bar */}
        <div className="px-5 py-2.5 border-b border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-rose-400 font-mono text-[11px] uppercase tracking-wider">
              Base A:
            </span>
            <select
              value={selectedIdA}
              onChange={(e) => setSelectedIdA(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 font-mono text-xs focus:border-indigo-500 focus:outline-none truncate"
            >
              {clips.map((c) => (
                <option key={"a-" + c.id} value={c.id}>
                  {c.preview_text.slice(0, 70).replace(/\n/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwap}
            className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Swap Base and Compare"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-emerald-400 font-mono text-[11px] uppercase tracking-wider">
              Compare B:
            </span>
            <select
              value={selectedIdB}
              onChange={(e) => setSelectedIdB(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 font-mono text-xs focus:border-indigo-500 focus:outline-none truncate"
            >
              {clips.map((c) => (
                <option key={"b-" + c.id} value={c.id}>
                  {c.preview_text.slice(0, 70).replace(/\n/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-2 font-mono text-xs pl-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              +{diffResult.stats.additions}
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              -{diffResult.stats.deletions}
            </span>
          </div>
        </div>

        {/* Diff Content Viewport */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs select-text">
          {viewMode === "unified" ? (
            <div className="space-y-0.5 divide-y divide-zinc-900/80">
              {diffResult.lines.map((line, idx) => {
                let bgClass = "bg-transparent text-zinc-400";
                let prefix = " ";
                if (line.type === "added") {
                  bgClass = "bg-emerald-950/30 text-emerald-300 font-medium";
                  prefix = "+";
                } else if (line.type === "removed") {
                  bgClass = "bg-rose-950/30 text-rose-300 line-through opacity-80";
                  prefix = "-";
                }
                return (
                  <div key={idx} className={`px-2 py-0.5 flex items-start gap-3 rounded ${bgClass}`}>
                    <span className="w-8 text-[10px] text-zinc-600 select-none text-right flex-shrink-0">
                      {line.lineNumB || line.lineNumA || ""}
                    </span>
                    <span className="w-3 text-center select-none font-bold">{prefix}</span>
                    <span className="flex-1 whitespace-pre-wrap break-all">{line.content || " "}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Left Pane (Base A) */}
              <div className="flex flex-col border border-zinc-800/80 rounded-lg overflow-hidden bg-zinc-950/60">
                <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-rose-400 flex items-center justify-between">
                  <span>Base A</span>
                  <span className="text-zinc-500">{textA.split("\n").length} lines</span>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-0.5 divide-y divide-zinc-900/60">
                  {diffResult.lines
                    .filter((l) => l.type === "removed" || l.type === "unchanged")
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 flex items-start gap-2 rounded ${
                          line.type === "removed"
                            ? "bg-rose-950/40 text-rose-300"
                            : "text-zinc-400"
                        }`}
                      >
                        <span className="w-6 text-[10px] text-zinc-600 select-none text-right flex-shrink-0">
                          {line.lineNumA || ""}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line.content || " "}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right Pane (Compare B) */}
              <div className="flex flex-col border border-zinc-800/80 rounded-lg overflow-hidden bg-zinc-950/60">
                <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-emerald-400 flex items-center justify-between">
                  <span>Compare B</span>
                  <span className="text-zinc-500">{textB.split("\n").length} lines</span>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-0.5 divide-y divide-zinc-900/60">
                  {diffResult.lines
                    .filter((l) => l.type === "added" || l.type === "unchanged")
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 flex items-start gap-2 rounded ${
                          line.type === "added"
                            ? "bg-emerald-950/40 text-emerald-300 font-medium"
                            : "text-zinc-400"
                        }`}
                      >
                        <span className="w-6 text-[10px] text-zinc-600 select-none text-right flex-shrink-0">
                          {line.lineNumB || ""}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line.content || " "}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
