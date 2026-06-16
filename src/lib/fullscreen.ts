// Thin adapter over the browser Fullscreen and Screen Wake Lock APIs. This is the
// untested IO seam: useVollbildmodus drives it and is tested by mocking this module,
// so nothing here carries logic beyond the single call it wraps.

export function supportsFullscreen(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled;
}

export function supportsWakeLock(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export function isFullscreen(): boolean {
  return typeof document !== "undefined" && document.fullscreenElement !== null;
}

export function enterFullscreen(element: Element): Promise<void> {
  return element.requestFullscreen();
}

export function exitFullscreen(): Promise<void> {
  return document.exitFullscreen();
}

export function acquireWakeLock(): Promise<WakeLockSentinel> {
  return navigator.wakeLock.request("screen");
}

export function lockLandscape(): Promise<void> {
  return screen.orientation.lock("landscape");
}
