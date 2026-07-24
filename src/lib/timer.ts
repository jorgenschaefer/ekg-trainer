// Formats an elapsed-seconds count as mm:ss for the resuscitation-time stopwatch.
// Minutes are not capped — a long resuscitation just keeps counting (e.g. 100:00).
export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
