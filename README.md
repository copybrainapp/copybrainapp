# CopyBrain

[![Latest release](https://img.shields.io/github/v/release/copybrainapp/copybrainapp?label=latest)](https://github.com/copybrainapp/copybrainapp/releases/latest)
[![Total downloads](https://img.shields.io/github/downloads/copybrainapp/copybrainapp/total)](https://github.com/copybrainapp/copybrainapp/releases)

> Never lose a copied text again.

CopyBrain is a modern clipboard timeline application for Windows, macOS, and Linux. Unlike typical clipboard managers that only keep the last few items, CopyBrain automatically archives your entire clipboard history into a searchable timeline — find anything you copied yesterday, last week, last month, or even years ago.

CopyBrain is **open source** and MIT-licensed. Since it stores everything you've ever copied — including things like passwords or tokens that end up on your clipboard by accident — the source is public so anyone can audit exactly what it does with your data (spoiler: nothing leaves your machine) or build it themselves from source instead of trusting a downloaded binary. 100% private, secure, and transparent by design — see [PRIVACY.md](./PRIVACY.md) for the details.

---

## Download

Grab the latest installer for your platform from the [Releases page](https://github.com/copybrainapp/copybrainapp/releases/latest):

- **macOS**: `CopyBrain_<version>_universal.dmg`
- **Windows**: `CopyBrain_<version>_x64-setup.exe` (installer), `CopyBrain_<version>_x64_en-US.msi` (installer), or `CopyBrain_<version>_x64_portable.zip` (no install required)
- **Linux**: `CopyBrain_<version>_amd64.deb`, `CopyBrain-<version>-1.x86_64.rpm`, or `CopyBrain_<version>_amd64.AppImage`

Prefer to build it yourself? See [Building production binaries / installers](#building-production-binaries--installers) below.

---

## Features

- Unlimited clipboard history, stored locally in SQLite
- Timeline view (grouped by day) with virtual scrolling
- Instant search (full-text search via SQLite FTS5)
- Favorites & Collections
- Automatic content-type detection: Text, URL, Email, Phone, File Path, Secret (masked by default), Social (per-platform icons), Code
- Tracks which app each item was copied from
- Tray icon + global shortcut (`Cmd/Ctrl+Shift+V`) to show/hide the window
- Auto start on login (optional)
- Single instance (no duplicate windows)
- 100% local-first — no data is ever sent to any server

---

## Tech Stack

### Desktop shell
- **Tauri v2** — Rust ⟷ native webview bridge per platform

### Frontend
- **React 19** + **TypeScript**
- **Vite 7** — dev server & bundler
- **Tailwind CSS v4** — styling (CSS-first config, no `tailwind.config.js`)
- **shadcn/ui** (Base UI primitives) — UI components
- **TanStack Query** — data fetching & caching against Tauri commands
- **TanStack Virtual** — virtualized list for the timeline
- **Zustand** — UI state (active filter, search query, etc.)
- **date-fns**, **lucide-react**

### Backend (Rust, in `src-tauri/`)
- **rusqlite** (`bundled` feature) — SQLite compiled directly into the binary, with **FTS5** built in for full-text search
- **arboard** — reads/writes the system clipboard, polled from a background thread
- **active-win-pos-rs** — identifies which app was frontmost when an item was copied
- **tauri-plugin-global-shortcut** — global show/hide window shortcut
- **tauri-plugin-autostart** — OS-level auto start
- **tauri-plugin-single-instance** — prevents duplicate app instances
- **chrono**, **regex**, **uuid**, **once_cell**, **serde**

### Database
- SQLite (local file, stored in the OS's app data directory)
- FTS5 virtual table + triggers to keep the search index in sync
- SQLCipher (optional, not yet enabled — see Roadmap)

---

## Prerequisites (all platforms)

Required on every OS before development or building:

| Tool | Minimum version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ (20/22 LTS recommended) | `node -v` |
| [pnpm](https://pnpm.io) | 9+ | `pnpm -v` |
| [Rust](https://rustup.rs) | latest stable | `rustc -V` & `cargo -V` |
| [Tauri CLI](https://tauri.app) | installed automatically via `pnpm install` (devDependency) | `pnpm tauri -V` |

Install Rust (if you don't have it) via [rustup](https://rustup.rs):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Additional per-platform dependencies

**macOS**
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

**Windows**
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (workload "Desktop development with C++")
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) — usually already bundled with Windows 10/11; download it if missing

**Linux** (Debian/Ubuntu, adjust for other distros)
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libxdo-dev \
  libayatana-appindicator3-dev \
  libxcb-ewmh-dev \
  libxcb-randr0-dev \
  libdbus-1-dev
```
> Fedora/Arch use equivalent packages (`webkit2gtk4.1-devel`, etc). See the [official Tauri prerequisites docs](https://tauri.app/start/prerequisites/) for the full per-distro list.

---

## Running in development

```bash
# 1. enter the project folder
cd CopyBrain

# 2. install frontend dependencies
pnpm install

# 3. run the app (frontend hot reload + auto rebuild Rust on change)
pnpm tauri dev
```

This automatically:
- Starts the Vite dev server at `http://localhost:1420`
- Compiles the Rust backend (`src-tauri`)
- Opens the native app window

Other useful dev commands:

```bash
pnpm dev                      # vite dev server only (no Tauri shell, for quick UI debugging)
cd src-tauri && cargo check   # check Rust code without a full build
```

---

## Building production binaries / installers

Builds must be produced **on their target platform** — Tauri does not cross-compile native installers (e.g. a `.exe` must be built on Windows, a `.dmg`/`.app` on macOS, a `.deb`/`.AppImage` on Linux), unless you set up your own cross-compilation toolchain (advanced, not covered here — see the [Tauri distribution guide](https://tauri.app/distribute/) if needed).

### macOS

```bash
pnpm tauri build
```

Output in `src-tauri/target/release/bundle/`:
- `macos/CopyBrain.app`
- `dmg/CopyBrain_<version>_<arch>.dmg`

To build a universal binary (Intel + Apple Silicon):
```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
pnpm tauri build --target universal-apple-darwin
```

### Windows

Run on a Windows machine/VM:
```powershell
pnpm tauri build
```

Output in `src-tauri\target\release\bundle\`:
- `msi\CopyBrain_<version>_x64_en-US.msi`
- `nsis\CopyBrain_<version>_x64-setup.exe`

### Linux

```bash
pnpm tauri build
```

Output in `src-tauri/target/release/bundle/`:
- `deb/copybrain_<version>_amd64.deb`
- `rpm/copybrain-<version>-1.x86_64.rpm` (if `rpmbuild` is available)
- `appimage/copybrain_<version>_amd64.AppImage`

### Raw binary without an installer (all platforms)

```bash
pnpm tauri build --no-bundle
```
The standalone binary is at `src-tauri/target/release/copybrain` (`.exe` on Windows).

### Building specific targets

With `bundle.targets` set to `"all"` in `tauri.conf.json` (this project's default), every installer format available on the current OS gets built. To restrict it:
```bash
pnpm tauri build --bundles dmg           # example: macOS, dmg only
pnpm tauri build --bundles msi,nsis      # example: Windows, msi + nsis
pnpm tauri build --bundles deb,appimage  # example: Linux
```

---

## Project structure

```
CopyBrain/
├─ src/                     # React + TypeScript frontend
│  ├─ components/           # UI components (timeline, sidebar, dialogs, ui/ = shadcn primitives)
│  ├─ hooks/                # TanStack Query hooks (data fetching against Tauri commands)
│  ├─ store/                # Zustand UI state
│  ├─ lib/                  # helpers (date formatting, Tauri invoke wrapper, etc)
│  └─ types.ts              # data types matching the Rust structs
├─ src-tauri/                # Rust backend
│  ├─ src/
│  │  ├─ db/                # SQLite init + schema + FTS5
│  │  ├─ commands.rs        # all Tauri commands called from the frontend
│  │  ├─ clipboard_watcher.rs  # background thread polling the clipboard
│  │  ├─ content_type.rs    # content-type detection (url/email/phone/path)
│  │  ├─ models.rs
│  │  └─ lib.rs             # app setup: plugins, tray, shortcut, invoke_handler
│  └─ tauri.conf.json       # window, bundle, identifier config, etc
└─ package.json
```

---

## Data location

The SQLite database (`copybrain.db`) is stored in the OS's default app data directory:

| OS | Location |
|---|---|
| macOS | `~/Library/Application Support/com.mac.copybrain/` |
| Windows | `%APPDATA%\com.mac.copybrain\` |
| Linux | `~/.local/share/com.mac.copybrain/` |

---

## Roadmap (not yet implemented)

- Image clipboard support
- OCR
- AI semantic search
- Cloud sync
- Browser extension
- Mobile companion app
- Database encryption via SQLCipher (optional, currently disabled)

---

## Contributing

Contributions are welcome — bug fixes, features, docs, or just filing an issue.

1. Fork the repo and create a branch off `main`
2. Follow the existing project structure and conventions (see above)
3. Make sure `pnpm build` (frontend + TypeScript) and `cargo check` (in `src-tauri/`) both pass
4. Open a pull request describing what changed and why

For larger changes (new features, architecture changes), open an issue first to discuss the approach before investing time in a PR.

---

## Privacy & Security

CopyBrain is 100% private and secure — no data collection, no network requests, fully open source. See [PRIVACY.md](./PRIVACY.md) for the full breakdown of what it does and doesn't do with your data.

## License

MIT — see [LICENSE](./LICENSE).
