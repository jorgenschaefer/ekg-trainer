# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web-based defibrillator/patient-monitor simulator for resuscitation training. An instructor opens a session and gets a 4-digit code plus a secret admin link; trainees join that code on their own devices and see a live EKG monitor. The instructor drives the rhythm, compressions ("Drückt"), defib spikes, and which modules (EKG leads, pulse oximeter) are connected — every joined monitor updates in real time. The UI is in German.

## Commands

```bash
npm run dev          # Next.js dev server (single Node process — see "single-instance" below)
npm test             # Vitest, run once
npm run test:watch   # Vitest watch mode
npx vitest run src/lib/waveform.test.ts        # single test file
npx vitest run -t "restarts the sweep clean"   # single test by name
npm run build        # production build (standalone output)
npx tsc --noEmit     # typecheck
npm run lint         # tsc --noEmit + biome check (lint + format check)
npm run format       # biome check --write (apply lint/format fixes)
```

Linting/formatting is [Biome](https://biomejs.dev) (`biome.json`): recommended preset, 2-space indent, import organizing on. `npm run lint` typechecks then runs `biome check`; `npm run format` applies safe fixes. Tests remain the primary quality gate.

Deploy: `bin/deploy-prod` builds the Docker image, pushes it, and restarts the stack on `drk-barmbek.de` over SSH. Runs as a Next standalone server (`output: "standalone"`).

## Architecture

Three roles, one session:
- **Start** (`/`, `StartCard`) — creates a session via `POST /api/session`, receives `{ code, adminToken }`.
- **Admin** (`/admin/[code]`, `AdminView`) — the instructor's control panel. Sends commands.
- **Monitor** (`/monitor/[code]`, `MonitorView`) — the trainee-facing patient monitor display.

### The synchronization contract is deliberately tiny

The server broadcasts **only `SessionState`** (`src/lib/session-state.ts`): the current `rhythm` id, the `drueckt` flag, and which `modules` are connected. It never streams pixels or measured numbers. Every client renders its own curves and looks up every displayed value (HF, SpO2, labels) from the shared **rhythm catalog** (`src/lib/rhythms.ts`). Catalog numbers are fixed constants per rhythm — never randomized — so every monitor in a session shows identical readings despite rendering independently. When adding anything patient-observable, decide deliberately: does it belong in the synced state, or is it derived from the rhythm id via the catalog? Default to the catalog.

### Server: in-memory store + SSE

- `src/lib/store.ts` — `createStore(deps)` is the pure, dependency-injected session store (codes, admin tokens, subscribers, `applyControl`, idle `sweep`). All time/randomness is injected via `StoreDeps` so it's fully testable.
- `src/lib/session-store.ts` — the single process-wide instance, stashed on `globalThis` so dev hot-reload doesn't drop live sessions, with an idle-sweep `setInterval`. **The whole design assumes one long-running Node instance** — on serverless/edge the `Map` wouldn't be shared and sync would silently break. All API routes are `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- API routes under `src/app/api/session/`:
  - `POST /api/session` → create session.
  - `GET /api/session/[code]/stream` → SSE. First write is a full state snapshot; every change is another full snapshot, plus `spike` and terminal `ended` events. Connecting and each 20s keepalive `touch`es the session to keep it alive.
  - `POST /api/session/[code]/control` → apply one command.

### Auth model: code joins, token controls

The 4-digit **code** is public (it's how monitors join). The **admin token** is the secret that authorizes control — sent as `Authorization: Bearer <token>` and checked against the session in `applyControl` (`store.ts`). The code alone can never push state. Client-side, the token rides in the URL **fragment** (never sent to the server on navigation) and is cached per-device in storage so a bare `/admin/:code` still restores control (`src/lib/admin-token.ts`).

### Commands are a closed, validated vocabulary

`src/lib/commands.ts` defines the only `Command` types (`setRhythm`, `setDrueckt`, `setModule`, `spike`) and `parseCommand` validates every field against the catalog and key whitelists, so a malformed or stray request can never push unknown state to monitors. `spike` is a fire-and-forget event (broadcast as `{type:"spike"}`); everything else broadcasts a full state snapshot. Adding a control means: extend `Command` + `parseCommand` + the `applyControl` switch + the admin UI.

### Client rendering

- `useSessionStream` (`src/components/useSessionStream.ts`) — subscribes to the SSE stream, exposes `{ state, status, spikeNonce }`. Native `EventSource` auto-reconnects; a brief drop only flashes the reconnect pill after a 1s debounce while the curve keeps running on the last synced state. Only a definitive `ended` shows the terminal screen — a transient drop must never read as asystole.
- `src/lib/waveform.ts` — pure waveform sampling, sampled fresh every animation frame so a rhythm switch lands immediately (even mid-compression). `ekgFrameSample` resolves precedence: leads disconnected → flat; live defib spike → spike artifact; `drueckt` → compression artifact; else the rhythm. Outputs carry no measured value, so exact phase need not match between devices.
- `Waveforms.tsx` — the canvas sweep renderer. It draws a moving head and erases a small gap ahead of it. The loop self-corrects against stalls (hidden tab, occluded/blurred window, rAF throttling, sleep): a frame gap larger than `STALL_GAP_S` means the loop paused, so it fully clears and restarts the sweep rather than streaking the old trace across.

## Conventions

- Domain/UI terms are German and intentional (`drueckt`/"Drückt" = chest compressions, `Vollbildmodus` = fullscreen, HF = Herzfrequenz). Match existing terms; don't anglicize.
- TDD is expected here (strict red-green-refactor). Test cases use `test()` (the codebase uses it uniformly — not `it()`). Pure logic lives in `src/lib/` with injected deps and is unit-tested directly; jsdom has no real canvas backing, so canvas tests stub `getContext`.
- Path alias: `@/` → `src/`.
