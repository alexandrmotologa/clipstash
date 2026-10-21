import React from "react";
import {
  Search,
  Pause,
  Play,
  Trash2,
  BarChart3,
  ShieldAlert,
  Sliders,
  Cpu,
  GitCompare,
  Minimize2,
} from "lucide-react";
import type { DatabaseStats } from "../types/clip";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onClearHistory: () => void;
  onOpenDiff?: () => void;
  onToggleHud?: () => void;
  stats: DatabaseStats | null;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  isPaused,
  onTogglePause,
  onOpenStats,
  onOpenSettings,
  onClearHistory,
  onOpenDiff,
  onToggleHud,
  stats,
}) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 py-3 select-none">
      <div className="flex items-center justify-between gap-4">
        {/* Brand & App identity */}
        <div className="flex items-center gap-2.5 min-w-[200px]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[7px] flex items-center justify-center">
              <span className="text-emerald-400 font-black text-sm tracking-tight">CS</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold tracking-wide text-zinc-100">ClipStash</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-mono text-zinc-300">&lt;14.2 MB RAM</span>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Instant search via SQLite FTS5 (text, secrets, tags, types)..."
            className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg pl-9 pr-14 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 transition-colors font-mono"
            autoFocus
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700/60 rounded text-zinc-400 shadow-sm">
              /
            </kbd>
          </div>
        </div>

        {/* Controls and quick actions */}
        <div className="flex items-center gap-1.5">
          {/* Pause / Resume Monitor Toggle */}
          <button
            onClick={onTogglePause}
            title={isPaused ? "Monitoring paused (click to resume)" : "Monitoring active (click to pause)"}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              isPaused
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100"
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{isPaused ? "Paused" : "Live"}</span>
          </button>

          {/* Diff Inspector Button */}
          {onOpenDiff && (
            <button
              onClick={onOpenDiff}
              title="Side-by-Side Diff Inspector"
              className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors"
            >
              <GitCompare className="w-4 h-4" />
            </button>
          )}

          {/* Quick HUD Mode Toggle */}
          {onToggleHud && (
            <button
              onClick={onToggleHud}
              title="Toggle Quick HUD Palette Mode (Tab)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs font-mono transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">HUD</span>
            </button>
          )}

          {/* Stats Button */}
          <button
            onClick={onOpenStats}
            title="Database & telemetry telemetry"
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="App preferences & shortcuts"
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Clear History Button */}
          <button
            onClick={onClearHistory}
            title="Clear unpinned clips"
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
