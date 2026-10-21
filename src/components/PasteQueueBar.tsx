import React, { useState } from "react";
import { ListOrdered, Play, X, Trash2, ChevronUp, ChevronDown, Check, Shield } from "lucide-react";
import type { QueueItem } from "../types/clip";

interface PasteQueueBarProps {
  queue: QueueItem[];
  onPopNext: () => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
}

export const PasteQueueBar: React.FC<PasteQueueBarProps> = ({
  queue,
  onPopNext,
  onRemoveItem,
  onClearQueue,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [justPopped, setJustPopped] = useState(false);

  if (queue.length === 0) return null;

  const currentItem = queue[0];

  const handlePop = () => {
    setJustPopped(true);
    onPopNext();
    setTimeout(() => setJustPopped(false), 800);
  };

  return (
    <div className="border-t border-indigo-500/30 bg-gradient-to-r from-indigo-950/90 via-zinc-950/95 to-indigo-950/90 backdrop-blur-md px-4 py-2.5 shadow-2xl transition-all select-none">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Queue Status & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
            <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
            <span>Paste Queue ({queue.length})</span>
          </div>

          {/* Current Next Item Preview */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] uppercase tracking-wider font-mono text-zinc-400">Next:</span>
            {currentItem.isSecret && <Shield className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            <span className="text-xs font-mono text-zinc-200 truncate max-w-[280px]">
              {currentItem.preview.replace(/\n/g, " ")}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title={expanded ? "Collapse Queue" : "View All Queued Items"}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <button
            onClick={onClearQueue}
            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Clear Queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handlePop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md active:scale-95"
          >
            {justPopped ? <Check className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{justPopped ? "Copied Next!" : "Pop & Copy Next"}</span>
            <kbd className="text-[10px] bg-indigo-700 px-1.5 py-0.5 rounded font-mono text-indigo-200">
              Shift+↵
            </kbd>
          </button>
        </div>
      </div>

      {/* Expanded list tray */}
      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60 max-h-40 overflow-y-auto space-y-1.5 pr-1">
          {queue.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-xs font-mono ${
                idx === 0
                  ? "bg-indigo-900/40 border border-indigo-500/30 text-indigo-200"
                  : "bg-zinc-900/60 border border-zinc-800/40 text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-4 text-[10px] text-zinc-500 font-bold">{idx + 1}.</span>
                {item.isSecret && <Shield className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                <span className="truncate">{item.preview.replace(/\n/g, " ")}</span>
              </div>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="text-zinc-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                title="Remove item"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
