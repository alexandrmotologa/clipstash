import React, { useState } from "react";
import {
  X,
  Sliders,
  Clock,
  Shield,
  Keyboard,
  Trash2,
  Check,
  Download,
  Upload,
  Key,
  AlertCircle,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: (keepPinned: boolean) => void;
  bypassSensitiveApps: boolean;
  onToggleBypassSensitiveApps: (bypass: boolean) => void;
  onExportVault: (passphrase: string) => Promise<string>;
  onImportVault: (passphrase: string, payload: string) => Promise<number>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearHistory,
  bypassSensitiveApps,
  onToggleBypassSensitiveApps,
  onExportVault,
  onImportVault,
}) => {
  const [purgeTimeout, setPurgeTimeout] = useState<string>("60");
  const [playAudioFeedback, setPlayAudioFeedback] = useState(true);
  const [clearedNotice, setClearedNotice] = useState(false);

  // Backup state
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleWipe = (keepPinned: boolean) => {
    onClearHistory(keepPinned);
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 2000);
  };

  const handleExport = async () => {
    if (!exportPassphrase.trim()) {
      setBackupError("Please enter a passphrase to encrypt your backup");
      return;
    }
    setBackupError(null);
    try {
      const data = await onExportVault(exportPassphrase);
      // Trigger browser download
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clipstash-vault-backup-${new Date().toISOString().slice(0, 10)}.clipstash`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus("Encrypted backup downloaded successfully!");
      setExportPassphrase("");
      setTimeout(() => setBackupStatus(null), 3500);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : "Failed to export vault");
    }
  };

  const handleImport = async () => {
    if (!importPassphrase.trim()) {
      setBackupError("Please enter the passphrase used to encrypt this backup");
      return;
    }
    if (!importPayload.trim()) {
      setBackupError("Please paste the encrypted backup content");
      return;
    }
    setBackupError(null);
    try {
      const count = await onImportVault(importPassphrase, importPayload.trim());
      setBackupStatus(`Successfully decrypted and imported ${count} clips!`);
      setImportPassphrase("");
      setImportPayload("");
      setTimeout(() => setBackupStatus(null), 3500);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : "Invalid passphrase or corrupted file");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setImportPayload(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg max-h-[90vh] bg-[#0d0e17] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Preferences & Vault Security</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-5 text-xs text-zinc-300 overflow-y-auto">
          {/* Status / Error feedback */}
          {backupStatus && (
            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{backupStatus}</span>
            </div>
          )}
          {backupError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{backupError}</span>
            </div>
          )}

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

          {/* Sensitive App Privacy Guard Toggle */}
          <div className="space-y-1">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sensitive App Privacy Guard</span>
              </span>
              <input
                type="checkbox"
                checked={bypassSensitiveApps}
                onChange={(e) => onToggleBypassSensitiveApps(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0 cursor-pointer"
              />
            </label>
            <p className="text-[11px] text-zinc-500">
              Automatically bypasses clipboard capture whenever copying from 1Password, Bitwarden, KeePass, Dashlane, or ProtonPass.
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
                className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0 cursor-pointer"
              />
            </label>
            <p className="text-[11px] text-zinc-500">
              Plays acoustic chimes on copy, queue step, and secret purge events via Web Audio API.
            </p>
          </div>

          {/* Encrypted Vault Backup (Export & Import) */}
          <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Encrypted Vault Backup (AES-256-GCM)</span>
            </div>

            {/* Export Section */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Export Vault
              </span>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Master passphrase for export..."
                  value={exportPassphrase}
                  onChange={(e) => setExportPassphrase(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Import Section */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  Import Vault
                </span>
                <label className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  [Browse .clipstash file]
                  <input
                    type="file"
                    accept=".clipstash,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <input
                type="password"
                placeholder="Passphrase used during export..."
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 font-mono text-xs focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                placeholder="Paste encrypted backup JSON or load file above..."
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-300 font-mono text-[11px] focus:border-indigo-500 focus:outline-none resize-none"
              />
              <button
                onClick={handleImport}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700/60"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Decrypt & Import Backup</span>
              </button>
            </div>
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
                <span className="text-zinc-400">Quick HUD Mode:</span>
                <span className="text-zinc-200 font-bold">Tab / HUD</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Queue Clip:</span>
                <span className="text-zinc-200 font-bold">Q</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Pop Next Queue:</span>
                <span className="text-zinc-200 font-bold">Shift + Enter</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Pin / Unpin:</span>
                <span className="text-zinc-200 font-bold">P</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded">
                <span className="text-zinc-400">Burn Secret:</span>
                <span className="text-zinc-200 font-bold">Del</span>
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
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
