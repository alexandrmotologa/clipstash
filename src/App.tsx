import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { CategoryTabs } from "./components/CategoryTabs";
import { ClipList } from "./components/ClipList";
import { StudioDrawer } from "./components/StudioDrawer";
import { StatsModal } from "./components/StatsModal";
import { SettingsModal } from "./components/SettingsModal";
import { PasteQueueBar } from "./components/PasteQueueBar";
import { CompactHud } from "./components/CompactHud";
import { DiffModal } from "./components/DiffModal";
import { useClips } from "./hooks/useClips";
import type { ClipItem } from "./types/clip";

export function App() {
  const {
    clips,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    isPaused,
    stats,
    selectedIndex,
    setSelectedIndex,
    selectedClip,
    setSelectedClip,
    revealedSecrets,
    copiedId,
    pasteQueue,
    bypassSensitiveApps,
    setBypassSensitiveApps,
    exportVault,
    importVault,
    addToQueue,
    removeFromQueue,
    popNextQueue,
    clearQueue,
    copyClip,
    copyCustomText,
    togglePin,
    deleteClip,
    burnSecretNow,
    clearHistory,
    togglePauseMonitoring,
    revealSecret,
    addManualClip,
  } = useClips();

  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);

  // Global shortcut listeners (Shift+Enter for queue pop, Tab for HUD toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      // Shift+Enter pops next item from paste queue anywhere
      if (e.shiftKey && e.key === "Enter" && pasteQueue.length > 0) {
        e.preventDefault();
        popNextQueue();
        return;
      }

      // Tab toggles Quick HUD when not focusing an editable field
      if (e.key === "Tab" && !isInput && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsHudOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pasteQueue.length, popNextQueue]);

  const handleOpenStudio = (clip: ClipItem) => {
    setSelectedClip(clip);
    const idx = clips.findIndex((c) => c.id === clip.id);
    if (idx !== -1) setSelectedIndex(idx);
  };

  const handleSaveAsNewClip = async (text: string) => {
    if (!text.trim()) return;
    await addManualClip(text, "code", ["transformed"]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090A0F] text-zinc-100 font-sans antialiased select-none overflow-hidden">
      {/* Top Application Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isPaused={isPaused}
        onTogglePause={togglePauseMonitoring}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDiff={() => setIsDiffOpen(true)}
        onToggleHud={() => setIsHudOpen((v) => !v)}
        onClearHistory={() => clearHistory(true)}
        stats={stats}
      />

      {/* Main Dual-Pane Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Side: Category Filters + Clip List */}
        <div className="w-1/2 md:w-[48%] lg:w-[42%] flex flex-col border-r border-zinc-800/80 bg-zinc-950/40">
          <CategoryTabs
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            clips={clips}
          />

          <ClipList
            clips={clips}
            selectedIndex={selectedIndex}
            onSelectIndex={(idx) => {
              setSelectedIndex(idx);
              setSelectedClip(clips[idx] || null);
            }}
            copiedId={copiedId}
            revealedSecrets={revealedSecrets}
            onCopy={copyClip}
            onTogglePin={togglePin}
            onDelete={deleteClip}
            onBurnSecret={burnSecretNow}
            onOpenStudio={handleOpenStudio}
            onToggleReveal={revealSecret}
            onAddToQueue={addToQueue}
          />

          {/* Sequential Paste Queue Bar (Visible when queue has items) */}
          <PasteQueueBar
            queue={pasteQueue}
            onPopNext={popNextQueue}
            onRemoveItem={removeFromQueue}
            onClearQueue={clearQueue}
          />

          {/* Keyboard Quick Bar Footer */}
          <div className="px-4 py-2 border-t border-zinc-850/80 bg-zinc-950/90 text-[10px] text-zinc-400 font-mono flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                  ↑↓
                </kbd>{" "}
                Navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Enter
                </kbd>{" "}
                Copy
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Q
                </kbd>{" "}
                Queue
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                  P
                </kbd>{" "}
                Pin
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Del
                </kbd>{" "}
                Burn
              </span>
            </div>
            <span className="text-zinc-500">{clips.length} records</span>
          </div>
        </div>

        {/* Right Side: Developer Transformation Studio */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/80">
          <StudioDrawer
            clip={selectedClip}
            revealedText={selectedClip ? revealedSecrets[selectedClip.id] : undefined}
            onCopyCustom={copyCustomText}
            onSaveAsNewClip={handleSaveAsNewClip}
            onBurnSecret={burnSecretNow}
          />
        </div>
      </div>

      {/* Quick HUD Mode (Raycast/Spotlight palette) */}
      <CompactHud
        isOpen={isHudOpen}
        onClose={() => setIsHudOpen(false)}
        clips={clips}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCopyClip={copyClip}
        onTogglePin={togglePin}
        copiedId={copiedId}
      />

      {/* Side-by-Side Diff Inspector Modal */}
      <DiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        clips={clips}
        revealedSecrets={revealedSecrets}
        onCopyText={copyCustomText}
      />

      {/* Telemetry Stats Modal */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
      />

      {/* Settings & Vault Security Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearHistory={clearHistory}
        bypassSensitiveApps={bypassSensitiveApps}
        onToggleBypassSensitiveApps={setBypassSensitiveApps}
        onExportVault={exportVault}
        onImportVault={importVault}
      />
    </div>
  );
}

export default App;
