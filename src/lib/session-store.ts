import { randomBytes, randomInt } from "node:crypto";
import { createStore, type SessionStore } from "./store";

// The process-wide, in-RAM session store. The whole architecture assumes a single
// long-running Node instance — on serverless/edge the Map would not be shared and
// synchronization would silently break (see FEATURE.md, SSE-Betrieb).
//
// Stashed on globalThis so Next.js dev hot-reload reuses the same store instead of
// dropping every live session on each module reload.
const globalForStore = globalThis as unknown as {
  __sessionStore?: SessionStore;
  __sessionSweep?: ReturnType<typeof setInterval>;
};

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const store: SessionStore =
  globalForStore.__sessionStore ??
  createStore({
    now: () => Date.now(),
    // 4 digits, leading zeros allowed.
    randomCode: () => String(randomInt(0, 10_000)).padStart(4, "0"),
    // Crypto-random secret carried in the admin link's URL fragment.
    randomToken: () => randomBytes(16).toString("hex"),
  });

globalForStore.__sessionStore = store;

// Periodically drop sessions that have been idle for over an hour, ending any
// streams still attached. Guarded so dev hot-reload doesn't stack up timers.
if (!globalForStore.__sessionSweep) {
  globalForStore.__sessionSweep = setInterval(
    () => store.sweep(),
    SWEEP_INTERVAL_MS,
  );
}
