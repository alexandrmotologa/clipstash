import React, { useEffect, useRef } from "react";
import type { ClipItem } from "../types/clip";
import { ClipItemView } from "./ClipItem";
import { ClipboardList, Sparkles } from "lucide-react";
import { sounds } from "../lib/audio";

interface ClipListProps {
  clips: ClipItem[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  copiedId: string | null;
  revealedSecrets: Record<string, string>;
  onCopy: (clip: ClipItem) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onBurnSecret: (id: string) => void;
  onOpenStudio: (clip: ClipItem) => void;
  onToggleReveal: (id: string) => void;
  onAddToQueue: (clip: ClipItem) => void;
}

export const ClipList: React.FC<ClipListProps> = ({
  clips,
  selectedIndex,
  onSelectIndex,
  copiedId,
  revealedSecrets,
  onCopy,
  onTogglePin,
  onDelete,
  onBurnSecret,
  onOpenStudio,
  onToggleReveal,
  onAddToQueue,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Global Keyboard listener for arrow navigation, copy, and actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input/textarea, skip navigation shortcuts except Escape
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (e.key === "ArrowDown") {
        if (!isInput || activeEl.getAttribute("type") !== "text") {
          e.preventDefault();
          onSelectIndex(Math.min(clips.length - 1, selectedIndex + 1));
          sounds.playKeyNav();
        }
      } else if (e.key === "ArrowUp") {
        if (!isInput || activeEl.getAttribute("type") !== "text") {
          e.preventDefault();
          onSelectIndex(Math.max(0, selectedIndex - 1));
          sounds.playKeyNav();
        }
      } else if (e.key === "Enter" && !isInput) {
        if (clips[selectedIndex]) {
          e.preventDefault();
          onCopy(clips[selectedIndex]);
        }
      } else if ((e.key === "p" || e.key === "P") && !isInput && !e.ctrlKey && !e.metaKey) {
        if (clips[selectedIndex]) {
          e.preventDefault();
          onTogglePin(clips[selectedIndex].id);
        }
      } else if ((e.key === "q" || e.key === "Q") && !isInput && !e.ctrlKey && !e.metaKey) {
        if (clips[selectedIndex]) {
          e.preventDefault();
          onAddToQueue(clips[selectedIndex]);
        }
      } else if (e.key === "Delete" && !isInput) {
        if (clips[selectedIndex]) {
          e.preventDefault();
          if (clips[selectedIndex].is_secret) {
            onBurnSecret(clips[selectedIndex].id);
          } else {
            onDelete(clips[selectedIndex].id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clips, selectedIndex, onSelectIndex, onCopy, onTogglePin, onDelete, onBurnSecret]);

  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/20 select-none">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
          <ClipboardList className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">No clipboard clips found</p>
        <p className="text-xs text-zinc-500 max-w-xs mt-1">
          Copy any text, token, code snippet, or cURL command. It will be captured and masked automatically.
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-zinc-850/60 no-scrollbar">
      {clips.map((clip, idx) => (
        <ClipItemView
          key={clip.id}
          clip={clip}
          isSelected={idx === selectedIndex}
          isCopied={copiedId === clip.id}
          isRevealed={Boolean(revealedSecrets[clip.id])}
          revealedText={revealedSecrets[clip.id]}
          onSelect={() => onSelectIndex(idx)}
          onCopy={() => onCopy(clip)}
          onTogglePin={() => onTogglePin(clip.id)}
          onDelete={() => onDelete(clip.id)}
          onBurnSecret={() => onBurnSecret(clip.id)}
          onOpenStudio={() => onOpenStudio(clip)}
          onToggleReveal={() => onToggleReveal(clip.id)}
          onAddToQueue={() => onAddToQueue(clip)}
        />
      ))}
    </div>
  );
};
