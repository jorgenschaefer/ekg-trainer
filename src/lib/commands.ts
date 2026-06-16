import { isRhythmId, type RhythmId } from "./rhythms";

// The one typed control vocabulary the admin sends. Validated against the catalog
// and key whitelists so a stray code can never push an unknown state to monitors.
export type Command =
  | { type: "setRhythm"; rhythm: RhythmId }
  | { type: "setDrueckt"; drueckt: boolean }
  | { type: "setModule"; module: ModuleKey; on: boolean }
  | { type: "spike" };

export type ModuleKey = "ekg" | "pulsoxi";

const MODULE_KEYS: ModuleKey[] = ["ekg", "pulsoxi"];

export function parseCommand(raw: unknown): Command | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;

  switch (c.type) {
    case "setRhythm":
      return isRhythmId(c.rhythm) ? { type: "setRhythm", rhythm: c.rhythm } : null;
    case "setDrueckt":
      return typeof c.drueckt === "boolean"
        ? { type: "setDrueckt", drueckt: c.drueckt }
        : null;
    case "setModule":
      return MODULE_KEYS.includes(c.module as ModuleKey) && typeof c.on === "boolean"
        ? { type: "setModule", module: c.module as ModuleKey, on: c.on }
        : null;
    case "spike":
      return { type: "spike" };
    default:
      return null;
  }
}
