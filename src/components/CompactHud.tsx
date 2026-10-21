import React, { useEffect, useRef } from "react";
import { Search, Shield, Pin, Copy, Check, Maximize2, Sparkles, X } from "lucide-react";
import type { ClipItem } from "../types/clip";
import { sounds } from "../lib/audio";

interface CompactHudProps {
  isOpen: boolean;
  onClose: () => void;
  clips: ClipItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCopyClip: (clip: ClipItem) => void;
  onTogglePin: (id: string) => void;
  copiedId: string | null;
}

export const CompactHud: React.FC<CompactHudProps> = ({
  isOpen,
  onClose,
  clips,
  searchQuery,
  onSearchChange,
  onCopyClip,
  onTogglePin,
  copiedId,
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Take top 9 clips for instant 1..9 keyboard bindings
  const topClips = clips.slice(0, 9);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedIndex >= topClips.length && topClips.length > 0) {
      setSelectedIndex(topClips.length - 1);
    }
  }, [topClips.length, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(topClips.length - 1, prev + 1));
        sounds.playKeyNav();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        sounds.playKeyNav();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (topClips[selectedIndex]) {
          onCopyClip(topClips[selectedIndex]);
        }
        return;
      }

      // Quick numbers 1 to 9 if Ctrl/Alt is pressed or if search input is not actively typing numbers
      if (e.ctrlKey || e.altKey || (document.activeElement !== inputRef.current)) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9 && topClips[num - 1]) {
          e.preventDefault();
          onCopyClip(topClips[num - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, topClips, selectedIndex, onCopyClip, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xl bg-[#0d0e17] border border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10">
        {/* HUD Search Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-zinc-800/80 bg-zinc-950/80">
          <Search className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Type to filter clips or press 1-9 to instant copy..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-2 flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-mono border border-zinc-800 transition-colors"
            title="Expand to Full Studio"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Full View</span>
          </button>
        </div>

        {/* Top 9 Items List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {topClips.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No matching clipboard items
            </div>
          ) : (
            topClips.map((clip, idx) => {
              const isSelected = idx === selectedIndex;
              const isCopied = copiedId === clip.id;

              return (
                <div
                  key={clip.id}
                  onClick={() => onCopyClip(clip)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-600/20 border border-indigo-500/40 text-zinc-100"
                      : "hover:bg-zinc-900/60 border border-transparent text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Digit Badge (1..9) */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-mono font-bold flex-shrink-0 ${
                        isSelected
                          ? "bg-indigo-500 text-white shadow-sm"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {clip.is_secret && (
                      <Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}

                    {/* Preview Text */}
                    <span className="text-xs font-mono truncate max-w-[380px]">
                      {clip.preview_text.replace(/\n/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {clip.is_pinned && (
                      <Pin className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                    )}
                    {isCopied ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {clip.char_count} chars
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/60 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">1..9</kbd> Instant Copy
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">Esc</kbd> Exit
            </span>
          </div>
          <span className="text-zinc-600">HUD Palette Mode</span>
        </div>
      </div>
    </div>
  );
};
