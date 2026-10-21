<p align="center">
  <img src="docs/images/clipstash_logo.png" alt="ClipStash Logo" width="128" height="128" />
</p>

<h1 align="center">ClipStash</h1>

<p align="center">
  <strong>Local-first smart clipboard manager, secret-masking vault, and developer transformation studio built with Rust, Tauri v2, and React 19.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Runtime-Tauri_v2-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/Core-Rust_1.85-DEA584?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/Frontend-React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Storage-SQLite_FTS5-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite FTS5" />
  <img src="https://img.shields.io/badge/Security-AES--256--GCM-10B981?style=flat-square" alt="AES-256-GCM" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License" />
</p>

---

## Overview

Traditional desktop clipboard managers frequently consume 300MB to 500MB of resident RAM because they package a full Chromium runtime via Electron. More critically, they persist passwords, bearer tokens, and private API keys copied from terminal sessions or `.env` files directly to plain disk storage without encryption or masking.

ClipStash addresses this problem directly. Written in Rust and Tauri v2 with a React 19 interface, it operates under 15MB of RAM, encrypts all captured clips at rest using AES-256-GCM, automatically detects and masks sensitive credentials, shreds temporary secrets after 60 seconds, and provides single-key code conversions for developers.

<p align="center">
  <img src="docs/images/clipstash_demo.gif" alt="ClipStash Animated Workflow Demo" width="900" />
</p>

---

## Key Capabilities

### 1. Ultra-Low Resource Footprint
- Native Rust engine paired with system webviews.
- Resident memory footprint stays under 15MB RAM during continuous operation.
- Non-blocking clipboard listener with deduplication and self-copy suppression.
- Instant summon via global keyboard shortcut (`Alt + V`).

### 2. Automatic Secret Masking and Ephemeral Shredding
- Scans every clipboard item through compiled regular expressions and entropy estimators.
- Detects AWS IAM keys, GitHub tokens (`ghp_`), OpenAI keys (`sk-proj-`), Anthropic tokens, Google API keys, Stripe secret keys, Slack tokens, private certificates, and database connection strings.
- Validates credit card candidates with the Luhn checksum algorithm before classification.
- Visually replaces sensitive characters with masked placeholders (`••••••••••••`).
- Configures an automatic purge timer (default 60 seconds) that permanently erases expired credentials from both SQLite and memory.

### 3. Developer Transformation Studio
- **JSON Workbench**: Format 2-space, format 4-space, minify, escape, unescape, convert to YAML, or generate TypeScript interfaces directly from JSON structures.
- **cURL Converter**: Translates raw terminal cURL commands into production JavaScript `fetch()`, Axios requests, or Python `requests` scripts.
- **Encoders and Decoders**: Bi-directional UTF-8 Base64, URL encode/decode, Hex, Binary, and HTML entities.
- **Token Inspector**: Decodes JWT headers and payload claims, displaying human-readable expiration dates and validity status.
- **Color Studio**: Converts HEX, RGB, RGBA, and HSL values while generating CSS variables.
- **Text and Regex Utilities**: Formats camelCase, snake_case, kebab-case, PascalCase, and CONSTANT_CASE. Extracts email addresses, URLs, IPv4 addresses, and UUIDs. Sorts and deduplicates lines.

### 4. Encrypted Local Storage and Instant FTS5 Search
- Embedded SQLite with FTS5 virtual tables for sub-2ms full-text search.
- Payload content is encrypted on disk using AES-256-GCM with a machine-bound key.
- Pinned items remain permanent while unpinned history can be cleared on demand.

---

## Screen Walkthrough

### Main Dual-Pane Workspace
The left panel presents the indexed clip list with category filters (All, Pinned, Secrets, Code, Colors, Links), secret indicator badges, and auto-burn countdown timers. The right panel houses the Developer Transformation Studio.

<p align="center">
  <img src="docs/images/clipstash_workspace.png" alt="ClipStash Main Workspace" width="900" />
</p>

### Developer Transformation Studio
Paste or select any cURL command or JSON payload to inspect and convert it instantly across languages.

<p align="center">
  <img src="docs/images/clipstash_curl_studio.png" alt="ClipStash Developer Transformation Studio" width="900" />
</p>

### Cryptographic Secret Vault
Tokens and sensitive variables are masked upon arrival. Users can reveal the original text with intentional focus or click "Burn Now" to wipe the payload immediately.

<p align="center">
  <img src="docs/images/clipstash_vault_masking.png" alt="ClipStash Secret Vault Masking" width="900" />
</p>

### Performance and Telemetry
Benchmarks demonstrate the contrast between ClipStash and conventional Electron clipboard utilities.

<p align="center">
  <img src="docs/images/clipstash_telemetry.png" alt="ClipStash Telemetry and Benchmarks" width="900" />
</p>

---

## Architecture

```
clipstash/
├── src/                          # React 19 Frontend
│   ├── components/               # UI components
│   │   ├── Header.tsx            # FTS5 search, pause toggle, status
│   │   ├── CategoryTabs.tsx      # Category filters & counters
│   │   ├── ClipList.tsx          # Keyboard navigable list
│   │   ├── ClipItem.tsx          # Clip item view & countdown badges
│   │   ├── StudioDrawer.tsx      # Developer transformation workbench
│   │   ├── StatsModal.tsx        # Telemetry & performance dialog
│   │   └── SettingsModal.tsx     # Purge timeouts & preferences
│   ├── hooks/
│   │   └── useClips.ts           # Tauri IPC state bridge & event listener
│   ├── lib/
│   │   ├── audio.ts              # Web Audio tactile sound effects
│   │   ├── transformers.ts       # Pure developer transformation library
│   │   └── transformers.test.ts  # Vitest test suite (17 tests)
│   ├── types/
│   │   └── clip.ts               # TypeScript data definitions
│   └── App.tsx                   # Root dual-pane application
├── src-tauri/                    # Rust Backend Core
│   ├── src/
│   │   ├── clipboard.rs          # Cross-platform monitor thread
│   │   ├── commands.rs           # Tauri command dispatch handlers
│   │   ├── crypto.rs             # AES-256-GCM encryption & hashing
│   │   ├── db.rs                 # SQLite connection & FTS5 queries
│   │   ├── detector.rs           # Secret regexes & Luhn validator
│   │   ├── lib.rs                # Tauri builder & tray icon menu
│   │   └── main.rs               # Windows subsystem entrypoint
│   ├── tests/
│   │   └── unit_tests.rs         # Rust integration test suite (13 tests)
│   ├── Cargo.toml                # Rust crate definitions
│   └── tauri.conf.json           # Tauri bundle configuration
└── package.json                  # Node dependencies & build scripts
```

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `Alt + V` | System | Summon or hide the ClipStash application window |
| `/` or `Ctrl + F` | App | Focus the FTS5 search input |
| `↑` / `↓` | Clip List | Navigate up and down through clipboard records |
| `Enter` | Clip List | Copy selected clip to clipboard |
| `P` | Clip List | Toggle pinned status on the selected clip |
| `Delete` | Clip List | Delete clip or immediately burn secret |
| `Escape` | Modal | Dismiss dialog or close preferences |

---

## Building and Running

### Prerequisites
- Node.js 20 or higher
- Rust toolchain 1.85 or higher (`rustup default stable`)
- Platform C compiler (MSVC on Windows, GCC/Clang on Linux, Xcode command line tools on macOS)

### 1. Clone the repository
```bash
git clone https://github.com/alexandrmotologa/clipstash.git
cd clipstash
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run frontend unit tests
```bash
npm run test
```

### 4. Run Rust unit tests
```bash
cargo test --test unit_tests --manifest-path src-tauri/Cargo.toml
```

### 5. Start development mode
```bash
npm run tauri dev
```

### 6. Build production desktop application
```bash
npm run tauri build
```

---

## Security Model

1. **Zero Plaintext Storage**: Clip text is encrypted with an AES-256-GCM key generated locally on the host machine. If an unauthorized process reads `clipstash.db`, it encounters only encrypted ciphertext and truncated FTS search tokens.
2. **Ephemeral Credentials**: When sensitive patterns match, ClipStash sets an expiration deadline. The background sweeper checks this timestamp every 4 seconds, permanently dropping expired records.
3. **No External Network Calls**: ClipStash functions completely offline. No telemetry, clips, or tokens leave the local device.

---

## License

MIT License. See [LICENSE](LICENSE) for terms.
