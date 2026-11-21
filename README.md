# Typo Preview 0.1.0

Typo Preview is the first runnable slice of the Typo desktop writing-assistant project. It includes a local suggestion engine, a browser-based dashboard, saved local preferences, and a typing sandbox for trying completion and correction interactions.

## Run it

Requires Node.js 20 or newer. No package installation or build step is needed.

```sh
npm start
```

Open the localhost address printed by the server (default: `http://127.0.0.1:4173`). Stop the server with Ctrl+C.

## Try the preview

- Type `ty` and the local dictionary may show a muted `ping` suffix. Press Tab to accept it.
- Type `im` and Typo marks the token and offers `I’m`. Press Tab to accept or Escape to dismiss.
- With no candidate active, Tab is not intercepted by the page.
- Add a personal word in Dictionary. Typo will stop suggesting that word as a completion and will not apply its known correction to it.
- Change suggestion style, feature switches, or app exclusions; preferences are saved locally.
- Use the top-bar theme control to switch between dark and light dashboard themes.

The sandbox text remains in the open browser page and is never written to disk. The only persistent data is preferences and the personal word list in `.typo-data/` beside the app.

## Current boundary

This is a **local dashboard and engine preview**, not a system-wide keyboard integration. It does not connect to Fcitx5, IBus, Wayland, Windows TSF, or macOS InputMethodKit, and it cannot see or change text in other applications. The Apps page stores future exclusion preferences only. Password-field behavior must be implemented and validated in the native adapter before a system-wide release.

The engine uses a compact hand-curated English starter list and common correction examples. It is for interaction prototyping, not production spelling accuracy. It has no language-model dependency, network call, raw-text telemetry, or learning system. The learning and diagnostics switches are reserved preferences and do not enable those features in this preview.

## Local-only implementation

- Node standard library server bound to `127.0.0.1`.
- Static HTML/CSS/JavaScript dashboard with no build tools or third-party runtime dependencies.
- Local JSON settings and personal dictionary files created on first edit.
- A stateless suggestion endpoint; it does not log or persist the submitted preview text.
- Minimal local API origin check and response security headers.

## Next implementation step

Run a Fcitx5-versus-IBus pre-edit spike on the target Linux Wayland desktop. After choosing the framework, replace the preview-only boundary with a native adapter that follows the shared engine contract and secure-field rules in the Typo integration plan.
