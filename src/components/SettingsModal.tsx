import React, { useState } from "react";
import {
  X,
  Sliders,
  Clock,
  Shield,
  Keyboard,
  Trash2,
  Check,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: (keepPinned: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearHistory,
}) => {
  const [purgeTimeout, setPurgeTimeout] = useState<string>("60");
  const [excludePasswordManagers, setExcludePasswordManagers] = useState(true);
  const [playAudioFeedback, setPlayAudioFeedback] = useState(true);
  const [clearedNotice, setClearedNotice] = useState(false);

  if (!isOpen) return null;

  const handleWipe = (keepPinned: boolean) => {
    onClearHistory(keepPinned);
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Preferences & Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-5 text-xs text-zinc-300">
          {/* Auto Purge Setting */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-zinc-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Automatic Secret Purge Delay</span>
              </label>
              <select
                value={purgeTimeout}
                onChange={(e) => setPurgeTimeout(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="30">30 seconds</option>
                <option value="60">60 seconds (Default)</option>
                <option value="300">5 minutes</option>
                <option value="0">Never auto-purge</option>
              </select>
            </div>
            <p className="text-[11px] text-zinc-500">
              Credentials (AWS, OpenAI, GitHub, Credit Cards) are shredded from disk and memory when the timer expires.
            </p>
          </div>

          {/* Ignore Password Managers Toggle */}
          <div className="space-y-1">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ignore Password Manager Clips</span>
              </span>
              <input
                type="checkbox"
                checked={excludePasswordManagers}
                onChange={(e) => setExcludePasswordManagers(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0"
              />
            </label>
            <p className="text-[11px] text-zinc-500">
              Suppresses automatic ingestion from 1Password, Bitwarden, KeePass, and Apple Keychain.
            </p>
          </div>

          {/* Sound Feedback */}
          <div className="space-y-1">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                <span>Tactile Audio Micro-Interactions</span>
              </span>
              <input
                type="checkbox"
                checked={playAudioFeedback}
                onChange={(e) => setPlayAudioFeedback(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0"
              />
            </label>
            <p className="text-[11px] text-zinc-500">
              Plays a subtle acoustic chime on copy and secret purge events via Web Audio API.
            </p>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
              <Keyboard className="w-3.5 h-3.5 text-sky-400" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Summon App:</span>
                <span className="text-zinc-200 font-bold">Alt + V</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Search:</span>
                <span className="text-zinc-200 font-bold">/ or Ctrl+F</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Copy & Paste:</span>
                <span className="text-zinc-200 font-bold">Enter</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Pin / Unpin:</span>
                <span className="text-zinc-200 font-bold">P</span>
              </div>
            </div>
          </div>

          {/* Database Maintenance */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>History Maintenance</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleWipe(true)}
                className="flex-1 py-1.5 px-3 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Clear Unpinned Clips
              </button>
              <button
                onClick={() => handleWipe(false)}
                className="flex-1 py-1.5 px-3 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
              >
                Wipe All Database
              </button>
            </div>
            {clearedNotice && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <Check className="w-3.5 h-3.5" />
                <span>History successfully updated.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
