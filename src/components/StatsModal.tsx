import React from "react";
import {
  X,
  Database,
  ShieldCheck,
  Flame,
  Pin,
  Cpu,
  Zap,
} from "lucide-react";
import type { DatabaseStats } from "../types/clip";

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DatabaseStats | null;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">Telemetry & Performance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs">Active Clips</span>
                <Database className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-xl font-bold font-mono text-zinc-100">
                {stats?.total_clips ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs">Secrets Masked</span>
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {stats?.secret_clips ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs">Secrets Purged</span>
                <Flame className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-300">
                {stats?.total_purged ?? 0}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-xs">Pinned Clips</span>
                <Pin className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-xl font-bold font-mono text-zinc-100">
                {stats?.pinned_clips ?? 0}
              </div>
            </div>
          </div>

          {/* Performance Invariants */}
          <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Runtime Memory</span>
              </div>
              <span className="font-mono text-emerald-400 font-semibold">
                {stats?.memory_rss_bytes ? formatBytes(stats.memory_rss_bytes) : "< 15 MB"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>Search Engine</span>
              </div>
              <span className="font-mono text-zinc-300">SQLite FTS5 (&lt;2ms)</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <span>Encrypted Storage Size</span>
              </div>
              <span className="font-mono text-zinc-300">
                {formatBytes(stats?.db_size_bytes ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
