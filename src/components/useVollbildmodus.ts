"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as fs from "@/lib/fullscreen";

export interface Vollbildmodus {
  supported: boolean;
  active: boolean;
  toggle: () => Promise<void>;
  ref: React.RefObject<HTMLElement | null>;
}

// Drives the monitor's Vollbildmodus: a best-effort bundle of real fullscreen and a
// screen wake lock. Either capability may be missing on a given device — a tap
// activates whatever works and silently skips the rest. The active flag mirrors the
// real browser state: a system gesture out of fullscreen flips it back off.
export function useVollbildmodus(): Vollbildmodus {
  const ref = useRef<HTMLElement | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // Detect support after mount so the server (which has neither API) and the first
  // client render agree, avoiding a hydration mismatch on the toggle.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(fs.supportsFullscreen() || fs.supportsWakeLock());
  }, []);

  const [active, setActive] = useState(false);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLock.current?.release();
    } catch {
      // Already released by the browser (e.g. on visibility change) — ignore.
    }
    wakeLock.current = null;
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if (!fs.supportsWakeLock()) return;
    // Drop any sentinel we still hold first: re-acquiring on visibility change
    // would otherwise overwrite and orphan it (the browser doesn't null our ref).
    await releaseWakeLock();
    try {
      wakeLock.current = await fs.acquireWakeLock();
    } catch {
      // Best-effort: a denied wake lock must not abort the rest.
    }
  }, [releaseWakeLock]);

  const toggle = useCallback(async () => {
    if (active) {
      if (fs.supportsFullscreen() && fs.isFullscreen()) {
        try {
          await fs.exitFullscreen();
        } catch {
          // Best-effort.
        }
      }
      await releaseWakeLock();
      setActive(false);
      return;
    }

    if (fs.supportsFullscreen() && ref.current) {
      try {
        await fs.enterFullscreen(ref.current);
      } catch {
        // Best-effort: fall through to the wake lock even if fullscreen is denied.
      }
    }
    await acquireWakeLock();
    setActive(true);
  }, [active, acquireWakeLock, releaseWakeLock]);

  // The toggle reflects the real browser state, not its own flag: when the user
  // leaves fullscreen by a system gesture, drop back to inactive and free the lock.
  useEffect(() => {
    if (!fs.supportsFullscreen()) return;
    const onChange = () => {
      if (!fs.isFullscreen()) {
        releaseWakeLock();
        setActive(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [releaseWakeLock]);

  // The browser drops the wake lock whenever the page is hidden; re-acquire it on
  // return so the screen keeps staying awake across a brief lock or tab switch.
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, acquireWakeLock]);

  return { supported, active, toggle, ref };
}
