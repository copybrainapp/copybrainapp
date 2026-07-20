# Privacy, Security & Terms

CopyBrain runs a background process that continuously reads your clipboard — by design, that's what a clipboard manager does. We know that description alone can sound alarming (it's the same behavior malware uses), so this document explains exactly what the app does, what it deliberately does not do, and how to verify all of it yourself.

## CopyBrain is not a keylogger

A keylogger records every keystroke you type, regardless of whether you ever copy anything. **CopyBrain never reads keystrokes.** It only reacts to the system clipboard actually changing — the same clipboard-change event every clipboard manager (Windows Clipboard History, macOS's own clipboard, Paste, Maccy, Ditto, etc.) relies on. If you never press Copy, CopyBrain has nothing to record.

## What CopyBrain does

- Watches the OS clipboard for changes (polled roughly every 600ms) and saves new text content to a local history.
- Detects the content type (link, email, code, etc.) so the timeline is easier to browse and search.
- Detects likely secrets (API keys, tokens, passwords) and masks them in the UI by default.
- Optionally records which app the copy came from, purely for your own context when scrolling the timeline.

## What CopyBrain does not do

- **No keystroke logging.** Ever.
- **No network requests.** CopyBrain makes no outbound connections at runtime — no analytics, no telemetry, no crash reporting, no ads, no "phone home" of any kind.
- **No cloud sync.** Nothing you copy ever leaves your machine.
- **No account, no sign-in, no tracking identifiers.**

## Where your data lives

Everything is stored in a local SQLite database in your OS's standard app-data directory (see the [README](./README.md#data-location) for exact paths). It's a plain file on your disk that you own — back it up, move it, delete it, or inspect it with any SQLite browser whenever you want.

## Open source — verify it yourself

You don't have to take our word for any of this. The full source code is public and MIT-licensed:

- Source: https://github.com/copybrainapp/copybrainapp
- Website: https://www.copybrainapp.xyz/

Search the codebase for network calls, telemetry, or anything else you're worried about — there's nothing hidden, because there's nothing to hide. If you find something that contradicts what's written here, please open an issue.

## Disclaimer

CopyBrain is provided "as is", without warranty of any kind, as stated in the [MIT License](./LICENSE). You're responsible for reviewing what gets stored in your clipboard history (including anything sensitive that ends up there by accident) and for keeping backups via the built-in Export feature. The maintainers are not liable for any loss or damage arising from use of the software, to the extent permitted by law.
