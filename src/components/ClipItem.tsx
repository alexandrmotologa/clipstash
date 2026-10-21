import React, { useState, useEffect } from "react";
import {
  Pin,
  Copy,
  Check,
  Flame,
  Wand2,
  Lock,
  Unlock,
  Clock,
  Code,
  Link as LinkIcon,
  Palette,
  FileText,
  ListPlus,
} from "lucide-react";
import type { ClipItem } from "../types/clip";

interface ClipItemProps {
  clip: ClipItem;
  isSelected: boolean;
  isCopied: boolean;
  isRevealed: boolean;
  revealedText?: string;
  onSelect: () => void;
  onCopy: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onBurnSecret: () => void;
  onOpenStudio: () => void;
  onToggleReveal: () => void;
  onAddToQueue?: () => void;
}

export const ClipItemView: React.FC<ClipItemProps> = ({
  clip,
  isSelected,
  isCopied,
  isRevealed,
  revealedText,
  onSelect,
  onCopy,
  onTogglePin,
  onDelete,
  onBurnSecret,
  onOpenStudio,
  onToggleReveal,
  onAddToQueue,
}) => {
  // Real-time remaining seconds for auto-purge countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!clip.auto_purge_at) {
      setSecondsRemaining(null);
      return;
    }

    const updateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = clip.auto_purge_at! - now;
      setSecondsRemaining(diff > 0 ? diff : 0);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [clip.auto_purge_at]);

  // Determine icon and theme
  const isHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clip.preview_text.trim());
  const isUrl = clip.preview_text.trim().startsWith("http");

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const displayText = isRevealed && revealedText ? revealedText : clip.masked_content;

  return (
    <div
      onClick={onSelect}
      className={`group relative p-3 border-b border-zinc-800/40 cursor-pointer transition-colors ${
        isSelected
          ? "bg-zinc-850/90 border-l-2 border-l-indigo-500"
          : "hover:bg-zinc-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left icon or color chip */}
        <div className="pt-0.5 flex-shrink-0">
          {isHexColor ? (
            <div
              className="w-4 h-4 rounded border border-white/20 shadow-sm"
              style={{ backgroundColor: clip.preview_text.trim() }}
            />
          ) : clip.is_secret ? (
            <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Lock className="w-3 h-3" />
            </div>
          ) : isUrl ? (
            <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <LinkIcon className="w-3 h-3" />
            </div>
          ) : clip.line_count > 2 ? (
            <div className="w-5 h-5 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Code className="w-3 h-3" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center text-zinc-400">
              <FileText className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Center Content */}
        <div className="flex-1 min-w-0">
          {/* Metadata Header */}
          <div className="flex items-center gap-2 mb-1">
            {clip.is_secret && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                <Flame className="w-3 h-3 text-rose-400 animate-pulse" />
                {clip.secret_types[0] || "Sensitive Secret"}
              </span>
            )}

            {secondsRemaining !== null && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  secondsRemaining < 15
                    ? "bg-rose-500/20 text-rose-300 font-bold animate-bounce"
                    : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                }`}
                title="Expires and automatically purges from encrypted storage"
              >
                <Clock className="w-2.5 h-2.5" />
                {secondsRemaining}s auto-burn
              </span>
            )}

            {clip.is_pinned && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                <Pin className="w-2.5 h-2.5 fill-indigo-300" />
                Pinned
              </span>
            )}

            <span className="text-[11px] text-zinc-400 font-mono ml-auto">
              {formatRelativeTime(clip.last_copied_at)}
            </span>
          </div>

          {/* Masked / Plain Content Preview */}
          <div className="text-xs text-zinc-200 font-mono line-clamp-2 leading-relaxed break-all select-text">
            {displayText}
          </div>

          {/* Quick Metrics Footer */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-400 font-mono">
            <span>{clip.char_count} chars</span>
            <span>{clip.line_count} line{clip.line_count > 1 ? "s" : ""}</span>
            {clip.copy_count > 1 && (
              <span className="text-emerald-400 font-medium">{clip.copy_count}x copied</span>
            )}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {/* Secret Reveal Toggle */}
          {clip.is_secret && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleReveal();
              }}
              title={isRevealed ? "Mask secret" : "Reveal decrypted secret"}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {isRevealed ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Pin Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={clip.is_pinned ? "Unpin clip" : "Pin clip to top"}
            className={`p-1 rounded hover:bg-zinc-800 transition-colors ${
              clip.is_pinned ? "text-indigo-400" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${clip.is_pinned ? "fill-indigo-400" : ""}`} />
          </button>

          {/* Add to Paste Queue */}
          {onAddToQueue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue();
              }}
              title="Add to Sequential Paste Queue"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-indigo-300 transition-colors"
            >
              <ListPlus className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Developer Transformation Studio */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenStudio();
            }}
            title="Open in Transformation Studio"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-sky-300 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </button>

          {/* Instant Copy */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            title="Copy to clipboard"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Instant Burn / Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (clip.is_secret) {
                onBurnSecret();
              } else {
                onDelete();
              }
            }}
            title={clip.is_secret ? "Burn secret immediately" : "Delete clip"}
            className="p-1 rounded hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors"
          >
            {clip.is_secret ? <Flame className="w-3.5 h-3.5 text-rose-400" /> : <span className="text-xs">×</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
