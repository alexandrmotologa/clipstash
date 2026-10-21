# ClipStash — Master Engineering Plan

## 1. Overview
ClipStash is a local-first smart clipboard manager, secret-masking vault, and developer transformation studio built with Rust, Tauri v2, and React 19. It solves the high memory usage of legacy Electron clipboard utilities by running with minimal resource consumption (<15MB RAM) while adding automated credential protection and single-key developer data transformations.

## 2. Technical Stack
- **Desktop Runtime**: Tauri v2.12
- **Backend Language**: Rust 1.85+ (Edition 2024)
- **Local Database**: SQLite 3 with FTS5 full-text indexing (`rusqlite` bundled)
- **Cryptography**: AES-256-GCM authenticated encryption at rest (`aes-gcm`) with local key derivation
- **Clipboard Engine**: Cross-platform thread monitor (`arboard`) with programmatic copy bypass
- **Frontend Framework**: React 19.0 with TypeScript 5.7
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Unit Testing**: Vitest for frontend transformers and Rust `cargo test` for backend engines

## 3. Core Architecture

### 3.1 Backend Modules (`src-tauri/src/`)
- `crypto.rs`: Local machine key generation, AES-256-GCM encryption and decryption of payload content, SHA-256 hashing for deduplication.
- `detector.rs`: Pattern matcher identifying credentials (AWS keys, GitHub tokens, OpenAI keys, Anthropic keys, Google API tokens, Stripe keys, Slack tokens, private certificates, Luhn-validated credit cards, JWTs, and database URLs). Generates visual masks and schedules auto-purge timestamps.
- `db.rs`: SQLite connection pool, FTS5 virtual table synchronization, CRUD queries for clips, pinned items, categories, tags, and settings.
- `clipboard.rs`: Non-blocking clipboard monitoring thread (400ms polling cycle), self-copy loop suppression, and periodic expiration sweeper for sensitive records.
- `commands.rs`: Strongly typed Tauri command handlers for frontend IPC.
- `lib.rs`: Tauri builder configuration, system tray menu, window lifecycle, and application state.

### 3.2 Frontend Architecture (`src/`)
- `src/types/clip.ts`: TypeScript contracts for clips, secret classifications, categories, and settings.
- `src/lib/transformers.ts`: Pure transformation library:
  - JSON formatting (2-space, 4-space, minified, escaped, unescaped)
  - JSON to TypeScript interface generator
  - JSON to YAML / TOML
  - cURL to JavaScript `fetch()`, `axios`, and Python `requests`
  - Base64, URL, HTML entities, Hex, Binary, and Unicode conversions
  - JWT decoder with expiration validation and claims inspection
  - Color studio (HEX, RGB, RGBA, HSL, CSS variable generation)
  - Text case converters (camel, snake, kebab, pascal, constant, title)
  - Regex data extractors (emails, URLs, IPv4/v6, UUIDs)
  - Markdown table formatter, duplicate line remover, text sorting, token counter
  - Cryptographic hashing (SHA-256, SHA-1, MD5)
- `src/lib/audio.ts`: Web Audio interaction feedback for copy actions and secret purges.
- `src/components/`:
  - `Header.tsx`: Instant FTS5 search input, monitoring pause toggle, system stats trigger, and wipe action.
  - `CategoryTabs.tsx`: Category filter pills (All, Pinned, Secrets, Code, Colors, URLs).
  - `ClipList.tsx`: Keyboard navigable clip list (`ArrowUp`, `ArrowDown`, `Enter` to copy, `Delete` to remove).
  - `ClipItem.tsx`: High-contrast clip preview, secret indicator badge, countdown timer, and quick action bar.
  - `StudioDrawer.tsx`: Full developer transformation workbench with live input/output and format controls.
  - `SettingsModal.tsx`: Configuration for auto-purge duration, clipboard polling frequency, and retention limits.
  - `StatsModal.tsx`: Real-time telemetry on stored clips, masked secrets, and database size.

## 4. Database Schema
```sql
CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    content_encrypted TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    preview_text TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    byte_count INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_secret INTEGER NOT NULL DEFAULT 0,
    secret_types TEXT NOT NULL DEFAULT '[]',
    masked_content TEXT NOT NULL,
    category_id TEXT NOT NULL DEFAULT 'general',
    tags TEXT NOT NULL DEFAULT '[]',
    copy_count INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    last_copied_at INTEGER NOT NULL,
    auto_purge_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_clips_hash ON clips(content_hash);
CREATE INDEX IF NOT EXISTS idx_clips_last_copied ON clips(last_copied_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_is_pinned ON clips(is_pinned);
CREATE INDEX IF NOT EXISTS idx_clips_is_secret ON clips(is_secret);
CREATE INDEX IF NOT EXISTS idx_clips_auto_purge ON clips(auto_purge_at);

CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5(
    id UNINDEXED,
    preview_text,
    masked_content,
    tags
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## 5. Security Model
1. Sensitive items never hit disk unencrypted. Payloads are encrypted with AES-256-GCM using an authenticated key bound to the local user directory.
2. In the UI, discovered secrets are replaced by masked placeholders (`••••••••••••`) unless explicitly revealed with user intent.
3. Timed secrets are removed from both memory and SQLite when their expiration timestamp is reached, triggering an automated UI sync.

## 6. Implementation Milestones
- [x] Repository setup, GitHub public registration, and topics
- [x] Portfolio synchronization Phase 1
- [ ] Backend Rust implementation: crypto, detector, database, clipboard monitor, commands
- [ ] Backend unit and integration tests (`cargo test`)
- [ ] Developer transformation library with Vitest test suite
- [ ] Frontend user interface with keyboard navigation and dark theme
- [ ] End-to-end integration and manual verification
- [ ] Documentation, humanized README, and visual assets
- [ ] Portfolio synchronization Phase 2 and final push
