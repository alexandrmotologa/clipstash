import { useState, useEffect, useCallback, useRef } from "react";
import type { ClipItem, DatabaseStats, CategoryFilter, QueueItem } from "../types/clip";
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

// Local browser fallback storage when running outside the Tauri desktop wrapper
const DEFAULT_BROWSER_CLIPS: ClipItem[] = [
  {
    id: "clip-db-url",
    preview_text: 'export DATABASE_URL="postgres://postgres:••••••••••••@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"',
    masked_content: 'export DATABASE_URL="postgres://postgres:••••••••••••@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"',
    char_count: 104,
    byte_count: 104,
    line_count: 1,
    is_pinned: true,
    is_secret: true,
    secret_types: ["Database Credentials"],
    category_id: "secrets",
    tags: ["env", "postgres", "supabase"],
    copy_count: 8,
    created_at: Math.floor(Date.now() / 1000) - 300,
    last_copied_at: Math.floor(Date.now() / 1000) - 45,
    auto_purge_at: Math.floor(Date.now() / 1000) + 45,
  },
  {
    id: "clip-stripe-curl",
    preview_text: 'curl -X POST https://api.stripe.com/v1/payment_intents -H "Authorization: Bearer sk_test_••••••••••••••••••••••••" -d amount=4999 -d currency=usd',
    masked_content: 'curl -X POST https://api.stripe.com/v1/payment_intents -H "Authorization: Bearer sk_test_••••••••••••••••••••••••" -d amount=4999 -d currency=usd',
    char_count: 147,
    byte_count: 147,
    line_count: 1,
    is_pinned: true,
    is_secret: true,
    secret_types: ["Stripe Secret Key"],
    category_id: "secrets",
    tags: ["api", "stripe", "curl"],
    copy_count: 4,
    created_at: Math.floor(Date.now() / 1000) - 600,
    last_copied_at: Math.floor(Date.now() / 1000) - 120,
    auto_purge_at: Math.floor(Date.now() / 1000) + 30,
  },
  {
    id: "clip-json-gateway",
    preview_text: '{\n  "service": "auth-gateway",\n  "version": "2.4.0",\n  "port": 8080,\n  "rateLimit": 500,\n  "tls": true,\n  "cors": ["https://app.clipstash.dev"]\n}',
    masked_content: '{\n  "service": "auth-gateway",\n  "version": "2.4.0",\n  "port": 8080,\n  "rateLimit": 500,\n  "tls": true,\n  "cors": ["https://app.clipstash.dev"]\n}',
    char_count: 154,
    byte_count: 154,
    line_count: 8,
    is_pinned: false,
    is_secret: false,
    secret_types: [],
    category_id: "code",
    tags: ["json", "config", "gateway"],
    copy_count: 14,
    created_at: Math.floor(Date.now() / 1000) - 1200,
    last_copied_at: Math.floor(Date.now() / 1000) - 240,
    auto_purge_at: null,
  },
  {
    id: "clip-sql-query",
    preview_text: "SELECT id, email, created_at, role FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 50;",
    masked_content: "SELECT id, email, created_at, role FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 50;",
    char_count: 104,
    byte_count: 104,
    line_count: 1,
    is_pinned: false,
    is_secret: false,
    secret_types: [],
    category_id: "code",
    tags: ["sql", "postgres"],
    copy_count: 6,
    created_at: Math.floor(Date.now() / 1000) - 2400,
    last_copied_at: Math.floor(Date.now() / 1000) - 300,
    auto_purge_at: null,
  },
  {
    id: "clip-hex-brand",
    preview_text: "#6366f1",
    masked_content: "#6366f1",
    char_count: 7,
    byte_count: 7,
    line_count: 1,
    is_pinned: false,
    is_secret: false,
    secret_types: [],
    category_id: "colors",
    tags: ["color", "indigo", "brand"],
    copy_count: 9,
    created_at: Math.floor(Date.now() / 1000) - 3600,
    last_copied_at: Math.floor(Date.now() / 1000) - 600,
    auto_purge_at: null,
  },
  {
    id: "clip-github-repo",
    preview_text: "https://github.com/alexandrmotologa/clipstash",
    masked_content: "https://github.com/alexandrmotologa/clipstash",
    char_count: 44,
    byte_count: 44,
    line_count: 1,
    is_pinned: false,
    is_secret: false,
    secret_types: [],
    category_id: "links",
    tags: ["github", "repo", "rust"],
    copy_count: 12,
    created_at: Math.floor(Date.now() / 1000) - 7200,
    last_copied_at: Math.floor(Date.now() / 1000) - 1800,
    auto_purge_at: null,
  }
];

const BROWSER_UNMASKED_SECRETS: Record<string, string> = {
  "clip-db-url": 'export DATABASE_URL="postgres://postgres:s3cur3_p4ssw0rd!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"',
  "clip-stripe-curl": 'curl -X POST https://api.stripe.com/v1/payment_intents -H "Authorization: Bearer sk_test_mock_secret_key_clipstash_demo" -d amount=4999 -d currency=usd',
};

function getBrowserStoredClips(): ClipItem[] {
  if (typeof window === "undefined") return DEFAULT_BROWSER_CLIPS;
  try {
    const raw = localStorage.getItem("clipstash_clips");
    if (!raw) {
      localStorage.setItem("clipstash_clips", JSON.stringify(DEFAULT_BROWSER_CLIPS));
      return DEFAULT_BROWSER_CLIPS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem("clipstash_clips", JSON.stringify(DEFAULT_BROWSER_CLIPS));
      return DEFAULT_BROWSER_CLIPS;
    }
    return parsed;
  } catch {
    return DEFAULT_BROWSER_CLIPS;
  }
}

function saveBrowserStoredClips(clips: ClipItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("clipstash_clips", JSON.stringify(clips));
  } catch {
    // ignore
  }
}

let browserPaused = false;
let browserPurgedCount = 0;

async function mockBrowserInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const clips = getBrowserStoredClips();

  if (cmd === "get_clips") {
    const search = ((args.search as string) || "").toLowerCase().trim();
    const cat = args.category as string;
    const pinnedOnly = Boolean(args.pinned_only);
    const secretOnly = Boolean(args.secret_only);

    let list = [...clips];
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
    if (BROWSER_UNMASKED_SECRETS[id]) {
      return BROWSER_UNMASKED_SECRETS[id] as T;
    }
    const item = clips.find((c) => c.id === id);
    return (item ? item.masked_content : "") as T;
  }
  if (cmd === "copy_clip") {
    const id = args.id as string;
    const item = clips.find((c) => c.id === id);
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
    const item = clips.find((c) => c.id === id);
    if (item) {
      item.is_pinned = !item.is_pinned;
      saveBrowserStoredClips(clips);
      return item.is_pinned as T;
    }
    return false as T;
  }
  if (cmd === "delete_clip" || cmd === "burn_secret_now") {
    const id = args.id as string;
    const updated = clips.filter((c) => c.id !== id);
    saveBrowserStoredClips(updated);
    browserPurgedCount++;
    return undefined as T;
  }
  if (cmd === "clear_history") {
    const keepPinned = Boolean(args.keep_pinned);
    const updated = keepPinned ? clips.filter((c) => c.is_pinned) : [];
    saveBrowserStoredClips(updated);
    return updated.length as T;
  }
  if (cmd === "toggle_pause") {
    browserPaused = !browserPaused;
    return browserPaused as T;
  }
  if (cmd === "is_paused") {
    return browserPaused as T;
  }
  if (cmd === "get_stats") {
    return {
      total_clips: clips.length,
      secret_clips: clips.filter((c) => c.is_secret).length,
      pinned_clips: clips.filter((c) => c.is_pinned).length,
      total_purged: browserPurgedCount,
      db_size_bytes: new Blob([JSON.stringify(clips)]).size,
      memory_rss_bytes: 14 * 1024 * 1024,
    } as T;
  }
  if (cmd === "add_manual_clip") {
    const content = args.content as string;
    const newItem: ClipItem = {
      id: "clip-" + Date.now(),
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
    clips.unshift(newItem);
    saveBrowserStoredClips(clips);
    return newItem as T;
  }
  if (cmd === "export_encrypted_vault") {
    const payload = JSON.stringify({
      format: "clipstash-encrypted-vault",
      version: 1,
      salt: "bW9ja1NhbHQxMjM0NQ==",
      nonce: "bW9ja05vbmNlMTI=",
      ciphertext: btoa(JSON.stringify(clips)),
      count: clips.length,
    }, null, 2);
    return payload as T;
  }
  if (cmd === "import_encrypted_vault") {
    return 1 as T;
  }
  if (cmd === "is_bypass_sensitive_apps") {
    return true as T;
  }
  if (cmd === "set_bypass_sensitive_apps") {
    return undefined as T;
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
  const [pasteQueue, setPasteQueue] = useState<QueueItem[]>([]);
  const [bypassSensitiveApps, setBypassSensitiveAppsState] = useState<boolean>(true);

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
      const bypass = await tauriInvoke<boolean>("is_bypass_sensitive_apps");
      setBypassSensitiveAppsState(bypass);
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

  const addToQueue = async (clip: ClipItem) => {
    try {
      let content = clip.masked_content;
      if (clip.is_secret) {
        if (revealedSecrets[clip.id]) {
          content = revealedSecrets[clip.id];
        } else {
          content = await tauriInvoke<string>("get_clip_content", { id: clip.id });
        }
      }
      const newItem: QueueItem = {
        id: clip.id + "-" + Date.now(),
        preview: clip.preview_text.slice(0, 60),
        text: content,
        isSecret: clip.is_secret,
      };
      setPasteQueue((prev) => [...prev, newItem]);
      sounds.playQueueStepSound();
    } catch (err) {
      console.error("Failed to add clip to queue:", err);
    }
  };

  const removeFromQueue = (queueId: string) => {
    setPasteQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const popNextQueue = async (): Promise<QueueItem | null> => {
    if (pasteQueue.length === 0) return null;
    const [next, ...remaining] = pasteQueue;
    try {
      await tauriInvoke("copy_custom_text", { text: next.text });
      sounds.playQueueStepSound();
      setPasteQueue(remaining);
      return next;
    } catch (err) {
      console.error("Failed to pop next queue item:", err);
      return null;
    }
  };

  const clearQueue = () => {
    setPasteQueue([]);
  };

  const setBypassSensitiveApps = async (bypass: boolean) => {
    try {
      await tauriInvoke("set_bypass_sensitive_apps", { bypass });
      setBypassSensitiveAppsState(bypass);
    } catch (err) {
      console.error("Failed to update sensitive apps bypass:", err);
    }
  };

  const exportVault = async (passphrase: string): Promise<string> => {
    return tauriInvoke<string>("export_encrypted_vault", { passphrase });
  };

  const importVault = async (passphrase: string, payload: string): Promise<number> => {
    const count = await tauriInvoke<number>("import_encrypted_vault", { passphrase, payload });
    fetchClips();
    fetchStats();
    return count;
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
    refreshClips: fetchClips,
  };
}
