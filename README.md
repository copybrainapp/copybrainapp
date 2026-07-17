# ZiCopy

> Never lose a copied text again.

ZiCopy adalah aplikasi clipboard timeline modern untuk Windows, macOS, dan Linux. Berbeda dari clipboard manager pada umumnya yang hanya menyimpan beberapa item terakhir, ZiCopy otomatis mengarsipkan seluruh riwayat clipboard ke dalam timeline yang bisa dicari kapan saja — kemarin, minggu lalu, bulan lalu, bahkan tahun lalu.

---

## Fitur

- Riwayat clipboard tanpa batas, tersimpan lokal di SQLite
- Timeline view (dikelompokkan per hari) dengan virtual scrolling
- Instant search (full-text search via SQLite FTS5)
- Favorites & Collections
- Deteksi tipe konten otomatis: Text, URL, Email, Phone, File Path
- Tray icon + global shortcut (`Cmd/Ctrl+Shift+V`) untuk show/hide window
- Auto start saat login (opsional)
- Single instance (tidak bisa buka dobel window)
- 100% local-first, tidak ada data yang dikirim ke server manapun

---

## Tech Stack

### Desktop shell
- **Tauri v2** — bridge Rust ⟷ Webview native per platform

### Frontend
- **React 19** + **TypeScript**
- **Vite 7** — dev server & bundler
- **Tailwind CSS v4** — styling (CSS-first config, tanpa `tailwind.config.js`)
- **shadcn/ui** (Base UI primitives) — komponen UI
- **TanStack Query** — data fetching & caching ke Tauri commands
- **TanStack Virtual** — virtualized list untuk timeline
- **Zustand** — UI state (filter aktif, search query, dsb)
- **date-fns**, **lucide-react**

### Backend (Rust, di `src-tauri/`)
- **rusqlite** (`bundled` feature) — SQLite dibundle langsung ke binary, sudah include **FTS5** untuk full-text search
- **arboard** — baca/tulis clipboard sistem, dipoll di background thread
- **tauri-plugin-global-shortcut** — shortcut global show/hide window
- **tauri-plugin-autostart** — auto start di OS
- **tauri-plugin-single-instance** — cegah multi instance
- **chrono**, **regex**, **uuid**, **once_cell**, **serde**

### Database
- SQLite (file lokal, disimpan di app data dir masing-masing OS)
- FTS5 virtual table + triggers untuk keep index tetap sinkron
- SQLCipher (opsional, belum diaktifkan — lihat bagian Roadmap)

---

## Prasyarat (semua platform)

Wajib ada di semua OS sebelum development atau build:

| Tool | Versi minimal | Cek dengan |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ (disarankan 20/22 LTS) | `node -v` |
| [pnpm](https://pnpm.io) | 9+ | `pnpm -v` |
| [Rust](https://rustup.rs) | stable terbaru | `rustc -V` & `cargo -V` |
| [Tauri CLI](https://tauri.app) | terpasang otomatis via `pnpm install` (devDependency) | `pnpm tauri -V` |

Install Rust (jika belum ada) lewat [rustup](https://rustup.rs):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Dependency tambahan per platform

**macOS**
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

**Windows**
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (workload "Desktop development with C++")
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) — biasanya sudah bawaan Windows 10/11, kalau belum ada tinggal download

**Linux** (Debian/Ubuntu, sesuaikan untuk distro lain)
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
  libayatana-appindicator3-dev
```
> Fedora/Arch pakai paket setara (`webkit2gtk4.1-devel`, dst). Lihat [dokumentasi resmi Tauri prerequisites](https://tauri.app/start/prerequisites/) untuk daftar lengkap per distro.

---

## Menjalankan (development mode)

```bash
# 1. clone / masuk ke folder project
cd ZiCopy

# 2. install dependency frontend
pnpm install

# 3. jalankan app (hot reload frontend + auto rebuild Rust saat file berubah)
pnpm tauri dev
```

Perintah di atas otomatis:
- Menjalankan Vite dev server di `http://localhost:1420`
- Compile backend Rust (`src-tauri`)
- Membuka window aplikasi native

Perintah dev lain yang berguna:

```bash
pnpm dev              # vite dev server saja (tanpa shell Tauri, untuk debug UI cepat)
cd src-tauri && cargo check   # cek Rust tanpa build penuh
```

---

## Build binary / installer production

Build dilakukan **di platform targetnya masing-masing** — Tauri tidak cross-compile installer native (misal build `.exe` harus dari mesin Windows, `.dmg`/`.app` dari macOS, `.deb`/`.AppImage` dari Linux), kecuali kamu setup cross-compilation toolchain sendiri (advanced, tidak dibahas di sini — lihat [Tauri cross-platform build guide](https://tauri.app/distribute/) kalau perlu).

### macOS

```bash
pnpm tauri build
```

Output di `src-tauri/target/release/bundle/`:
- `macos/ZiCopy.app`
- `dmg/ZiCopy_<versi>_<arch>.dmg`

Untuk build universal binary (Intel + Apple Silicon):
```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
pnpm tauri build --target universal-apple-darwin
```

### Windows

Jalankan di mesin/VM Windows:
```powershell
pnpm tauri build
```

Output di `src-tauri\target\release\bundle\`:
- `msi\ZiCopy_<versi>_x64_en-US.msi`
- `nsis\ZiCopy_<versi>_x64-setup.exe`

### Linux

```bash
pnpm tauri build
```

Output di `src-tauri/target/release/bundle/`:
- `deb/zicopy_<versi>_amd64.deb`
- `rpm/zicopy-<versi>-1.x86_64.rpm` (jika `rpmbuild` tersedia)
- `appimage/zicopy_<versi>_amd64.AppImage`

### Build binary mentah tanpa installer (semua platform)

```bash
pnpm tauri build --no-bundle
```
Binary standalone ada di `src-tauri/target/release/zicopy` (`.exe` di Windows).

### Build target spesifik

Kalau `bundle.targets` di `tauri.conf.json` di-set `"all"` (default project ini), semua format installer yang tersedia di OS tersebut akan dibuild sekaligus. Untuk membatasi:
```bash
pnpm tauri build --bundles dmg        # contoh: macOS, hanya dmg
pnpm tauri build --bundles msi,nsis   # contoh: Windows, msi + nsis
pnpm tauri build --bundles deb,appimage  # contoh: Linux
```

---

## Struktur project

```
ZiCopy/
├─ src/                     # Frontend React + TypeScript
│  ├─ components/           # UI components (timeline, sidebar, dialogs, ui/ = shadcn primitives)
│  ├─ hooks/                # TanStack Query hooks (data fetching ke Tauri commands)
│  ├─ store/                # Zustand UI state
│  ├─ lib/                  # helper (format tanggal, wrapper invoke Tauri, dll)
│  └─ types.ts              # tipe data yang match dengan struct Rust
├─ src-tauri/                # Backend Rust
│  ├─ src/
│  │  ├─ db/                # init SQLite + schema + FTS5
│  │  ├─ commands.rs        # semua Tauri command yang dipanggil dari frontend
│  │  ├─ clipboard_watcher.rs  # background thread polling clipboard
│  │  ├─ content_type.rs    # deteksi tipe konten (url/email/phone/path)
│  │  ├─ models.rs
│  │  └─ lib.rs             # setup app: plugin, tray, shortcut, invoke_handler
│  └─ tauri.conf.json       # konfigurasi window, bundle, identifier, dsb
└─ package.json
```

---

## Lokasi data

Database SQLite (`zicopy.db`) disimpan di app data directory bawaan OS:

| OS | Lokasi |
|---|---|
| macOS | `~/Library/Application Support/com.mac.zicopy/` |
| Windows | `%APPDATA%\com.mac.zicopy\` |
| Linux | `~/.local/share/com.mac.zicopy/` |

---

## Roadmap (belum diimplementasi)

- Dukungan clipboard gambar
- OCR
- AI semantic search
- Cloud sync
- Browser extension
- Mobile companion app
- Enkripsi database via SQLCipher (opsional, saat ini belum aktif)
