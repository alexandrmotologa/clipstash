import { useState, useEffect, useCallback, useRef } from "react";
import type { ClipItem, DatabaseStats, CategoryFilter } from "../types/clip";
import { sounds } from "../lib/audio";

// Safe wrapper for Tauri invoke
async function tauriInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (typeof window !== "undefined" && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  // Browser fallback storage
  return mockBrowserInvoke<T>(cmd, args);
}

// In-memory browser fallback mock for live browser preview and test environments
let mockClips: ClipItem[] = [
  {
    id: "mock-1",
    preview_text: 'export DATABASE_URL="postgres://admin:••••••••••••@db.internal:5432/prod"',
    masked_content: 'export DATABASE_URL="postgres://admin:••••••••••••@db.internal:5432/prod"',
    char_count: 72,
    byte_count: 72,
    line_count: 1,
    is_pinned: true,
    is_secret: true,
    secret_types: ["Database Credentials"],
    category_id: "secrets",
    tags: ["env", "postgres"],
    copy_count: 3,
    created_at: Math.floor(Date.now() / 1000) - 120,
    last_copied_at: Math.floor(Date.now() / 1000) - 20,
    auto_purge_at: Math.floor(Date.now() / 1000) + 40,
  },
  {
    id: "mock-2",
    preview_text: 'curl -X POST https://api.stripe.com/v1/charges -H "Authorization: Bearer sk_live_••••••••••••"',
    masked_content: 'curl -X POST https://api.stripe.com/v1/charges -H "Authorization: Bearer sk_live_••••••••••••"',
    char_count: 98,
    byte_count: 98,
    line_count: 1,
    is_pinned: false,
    is_secret: true,
    secret_types: ["Stripe Secret Key"],
    category_id: "secrets",
    tags: ["api", "stripe"],
    copy_count: 1,
    created_at: Math.floor(Date.now() / 1000) - 300,
    last_copied_at: Math.floor(Date.now() / 1000) - 300,
    auto_purge_at: Math.floor(Date.now() / 1000) + 15,
  },
  {
    id: "mock-3",
    preview_text: '{\n  "service": "auth-gateway",\n  "port": 8080,\n  "rateLimit": 500\n}',
    masked_content: '{\n  "service": "auth-gateway",\n  "port": 8080,\n  "rateLimit": 500\n}',
    char_count: 67,
    byte_count: 67,
    line_count: 5,
    is_pinned: false,
    is_secret: false,
    secret_types: [],
    category_id: "code",
    tags: ["json", "config"],
    copy_count: 5,
    created_at: Math.floor(Date.now() / 1000) - 600,
    last_copied_at: Math.floor(Date.now() / 1000) - 150,
    auto_purge_at: null,
  },
  {
    id: "mock-4",
    preview_text: "#3B82F6",
    masked_content: "#3B82F6",
    char_count: 7,
    byte_count: 7,
    line_count: 1,
    is_pinned: true,
    is_secret: false,
    secret_types: [],
    category_id: "colors",
    tags: ["tailwind", "brand"],
    copy_count: 8,
    created_at: Math.floor(Date.now() / 1000) - 1800,
    last_copied_at: Math.floor(Date.now() / 1000) - 500,
    auto_purge_at: null,
  },
  {
    id: "mock-5",
    preview_text: "https://github.com/alexandrmotologa/clipstash",
    masked_content: "https://github.com/alexandrmotologa/clipstash",
    char_count: 45,
    byte_count: 45,
    line_count: 1,
    is_pinned: false,
    is_secret: false,
    secret_types: [],
    category_id: "links",
    tags: ["github", "repo"],
    copy_count: 2,
    created_at: Math.floor(Date.now() / 1000) - 3600,
    last_copied_at: Math.floor(Date.now() / 1000) - 1200,
    auto_purge_at: null,
  },
];

let mockPaused = false;
let mockPurgedCount = 14;

async function mockBrowserInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (cmd === "get_clips") {
    const search = ((args.search as string) || "").toLowerCase().trim();
    const cat = args.category as string;
    const pinnedOnly = Boolean(args.pinned_only);
    const secretOnly = Boolean(args.secret_only);

    let list = [...mockClips];
    if (pinnedOnly) list = list.filter((c) => c.is_pinned);
    if (secretOnly) list = list.filter((c) => c.is_secret);
    if (cat && cat !== "all") {
      list = list.filter((c) => c.category_id === cat);
    }
    if (search) {
      list = list.filter(
        (c) =>
          c.preview_text.toLowerCase().includes(search) ||
          c.tags.some((t) => t.toLowerCase().includes(search)),
      );
    }
    return list as T;
  }
  if (cmd === "get_clip_content") {
    const id = args.id as string;
    const item = mockClips.find((c) => c.id === id);
    return (item ? item.masked_content : "") as T;
  }
  if (cmd === "copy_clip") {
    const id = args.id as string;
    const item = mockClips.find((c) => c.id === id);
    if (item && navigator.clipboard) {
      await navigator.clipboard.writeText(item.masked_content);
    }
    return undefined as T;
  }
  if (cmd === "copy_custom_text") {
    const text = args.text as string;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    return undefined as T;
  }
  if (cmd === "toggle_pin") {
    const id = args.id as string;
    const item = mockClips.find((c) => c.id === id);
    if (item) {
      item.is_pinned = !item.is_pinned;
      return item.is_pinned as T;
    }
    return false as T;
  }
  if (cmd === "delete_clip" || cmd === "burn_secret_now") {
    const id = args.id as string;
    mockClips = mockClips.filter((c) => c.id !== id);
    mockPurgedCount++;
    return undefined as T;
  }
  if (cmd === "clear_history") {
    const keepPinned = Boolean(args.keep_pinned);
    if (keepPinned) {
      mockClips = mockClips.filter((c) => c.is_pinned);
    } else {
      mockClips = [];
    }
    return mockClips.length as T;
  }
  if (cmd === "toggle_pause") {
    mockPaused = !mockPaused;
    return mockPaused as T;
  }
  if (cmd === "is_paused") {
    return mockPaused as T;
  }
  if (cmd === "get_stats") {
    return {
      total_clips: mockClips.length,
      secret_clips: mockClips.filter((c) => c.is_secret).length,
      pinned_clips: mockClips.filter((c) => c.is_pinned).length,
      total_purged: mockPurgedCount,
      db_size_bytes: 48 * 1024,
    } as T;
  }
  if (cmd === "add_manual_clip") {
    const content = args.content as string;
    const newItem: ClipItem = {
      id: "manual-" + Date.now(),
      preview_text: content.slice(0, 100),
      masked_content: content,
      char_count: content.length,
      byte_count: content.length,
      line_count: content.split("\n").length,
      is_pinned: false,
      is_secret: false,
      secret_types: [],
      category_id: (args.category as string) || "general",
      tags: (args.tags as string[]) || [],
      copy_count: 1,
      created_at: Math.floor(Date.now() / 1000),
      last_copied_at: Math.floor(Date.now() / 1000),
      auto_purge_at: null,
    };
    mockClips.unshift(newItem);
    return newItem as T;
  }
  return undefined as T;
}

export function useClips() {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchClips = useCallback(async () => {
    try {
      const pinnedOnly = activeCategory === "pinned";
      const secretOnly = activeCategory === "secrets";
      const categoryParam =
        activeCategory !== "all" && activeCategory !== "pinned" && activeCategory !== "secrets"
          ? activeCategory
          : null;

      const items = await tauriInvoke<ClipItem[]>("get_clips", {
        search: searchQuery || null,
        category: categoryParam,
        pinned_only: pinnedOnly,
        secret_only: secretOnly,
      });

      setClips(items);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load clips:", err);
      setIsLoading(false);
    }
  }, [searchQuery, activeCategory]);

  const fetchStats = useCallback(async () => {
    try {
      const st = await tauriInvoke<DatabaseStats>("get_stats");
      setStats(st);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const checkPaused = useCallback(async () => {
    try {
      const p = await tauriInvoke<boolean>("is_paused");
      setIsPaused(p);
    } catch {
      // ignore
    }
  }, []);

  // Initialize and register Tauri listeners
  useEffect(() => {
    fetchClips();
    fetchStats();
    checkPaused();

    let unlistenClipAdded: (() => void) | undefined;
    let unlistenClipsPurged: (() => void) | undefined;

    if (
      typeof window !== "undefined" &&
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    ) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<ClipItem>("clip-added", () => {
          fetchClips();
          fetchStats();
        }).then((unlisten) => {
          unlistenClipAdded = unlisten;
        });

        listen<string[]>("clips-purged", () => {
          sounds.playBurnChime();
          fetchClips();
          fetchStats();
        }).then((unlisten) => {
          unlistenClipsPurged = unlisten;
        });
      });
    }

    return () => {
      if (unlistenClipAdded) unlistenClipAdded();
      if (unlistenClipsPurged) unlistenClipsPurged();
    };
  }, [fetchClips, fetchStats, checkPaused]);

  // Keep selected index within bounds
  useEffect(() => {
    if (clips.length === 0) {
      setSelectedIndex(0);
      setSelectedClip(null);
    } else if (selectedIndex >= clips.length) {
      setSelectedIndex(clips.length - 1);
      setSelectedClip(clips[clips.length - 1]);
    } else {
      setSelectedClip(clips[selectedIndex]);
    }
  }, [clips, selectedIndex]);

  const copyClip = async (clip: ClipItem) => {
    try {
      await tauriInvoke("copy_clip", { id: clip.id });
      sounds.playCopyChime();
      setCopiedId(clip.id);
      setTimeout(() => setCopiedId(null), 1500);
      fetchClips();
    } catch (err) {
      console.error("Failed to copy clip:", err);
    }
  };

  const copyCustomText = async (text: string) => {
    try {
      await tauriInvoke("copy_custom_text", { text });
      sounds.playCopyChime();
    } catch (err) {
      console.error("Failed to copy custom text:", err);
    }
  };

  const togglePin = async (id: string) => {
    try {
      await tauriInvoke("toggle_pin", { id });
      fetchClips();
      fetchStats();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const deleteClip = async (id: string) => {
    try {
      await tauriInvoke("delete_clip", { id });
      sounds.playBurnChime();
      fetchClips();
      fetchStats();
    } catch (err) {
      console.error("Failed to delete clip:", err);
    }
  };

  const burnSecretNow = async (id: string) => {
    try {
      await tauriInvoke("burn_secret_now", { id });
      sounds.playBurnChime();
      fetchClips();
      fetchStats();
    } catch (err) {
      console.error("Failed to burn secret:", err);
    }
  };

  const clearHistory = async (keepPinned: boolean) => {
    try {
      await tauriInvoke("clear_history", { keep_pinned: keepPinned });
      sounds.playBurnChime();
      fetchClips();
      fetchStats();
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const togglePauseMonitoring = async () => {
    try {
      const next = await tauriInvoke<boolean>("toggle_pause");
      setIsPaused(next);
    } catch (err) {
      console.error("Failed to toggle pause:", err);
    }
  };

  const revealSecret = async (id: string) => {
    if (revealedSecrets[id]) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      const fullText = await tauriInvoke<string>("get_clip_content", { id });
      setRevealedSecrets((prev) => ({ ...prev, [id]: fullText }));
    } catch (err) {
      console.error("Failed to decrypt secret:", err);
    }
  };

  const addManualClip = async (content: string, category?: string, tags?: string[]) => {
    try {
      const item = await tauriInvoke<ClipItem>("add_manual_clip", {
        content,
        category: category || null,
        tags: tags || null,
      });
      fetchClips();
      fetchStats();
      return item;
    } catch (err) {
      console.error("Failed to add clip:", err);
      return null;
    }
  };

  return {
    clips,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    isLoading,
    isPaused,
    stats,
    selectedIndex,
    setSelectedIndex,
    selectedClip,
    setSelectedClip,
    revealedSecrets,
    copiedId,
    copyClip,
    copyCustomText,
    togglePin,
    deleteClip,
    burnSecretNow,
    clearHistory,
    togglePauseMonitoring,
    revealSecret,
    addManualClip,
    refreshClips: fetchClips,
  };
}
