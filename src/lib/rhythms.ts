// Shared rhythm catalog — the contract both server and clients render from.
// Numeric values are FIXED constants per rhythm (never random/jittered) so every
// monitor in a session shows identical numbers. The synced state carries only the
// RhythmId; everything displayed about a rhythm is looked up here.

export type RhythmId =
  | "sinus-normo"
  | "sinus-brady"
  | "sinus-tachy"
  | "vf-fein"
  | "vf-grob"
  | "pvt"
  | "pea"
  | "asystolie";

export type RhythmFamily = "sinus" | "kammerflimmern" | "weitere";

// How the EKG curve is drawn locally on each client.
export type WaveformKind = "sinus" | "vf" | "vt" | "asystolie";

export interface Rhythm {
  id: RhythmId;
  label: string;
  family: RhythmFamily;
  waveform: WaveformKind;
  // VF amplitude: fine vs coarse fibrillation.
  amplitude?: number;
  // Heart rate shown for HF (green, from the EKG). null → "– –" (no assessable rate,
  // e.g. fibrillation). Asystole is a real 0.
  hf: number | null;
  // Drives the pulse oximeter: peripheral pulse and SpO2 are only measurable with output.
  generatesOutput: boolean;
  // SpO2 shown when there is output; null when there is none.
  spo2: number | null;
}

export const RHYTHMS: Record<RhythmId, Rhythm> = {
  "sinus-normo": {
    id: "sinus-normo",
    label: "Sinus normo",
    family: "sinus",
    waveform: "sinus",
    hf: 70,
    generatesOutput: true,
    spo2: 98,
  },
  "sinus-brady": {
    id: "sinus-brady",
    label: "Sinus brady",
    family: "sinus",
    waveform: "sinus",
    hf: 40,
    generatesOutput: true,
    spo2: 97,
  },
  "sinus-tachy": {
    id: "sinus-tachy",
    label: "Sinus tachy",
    family: "sinus",
    waveform: "sinus",
    hf: 130,
    generatesOutput: true,
    spo2: 96,
  },
  "vf-fein": {
    id: "vf-fein",
    label: "Kammerflimmern fein",
    family: "kammerflimmern",
    waveform: "vf",
    amplitude: 0.25,
    hf: null,
    generatesOutput: false,
    spo2: null,
  },
  "vf-grob": {
    id: "vf-grob",
    label: "Kammerflimmern grob",
    family: "kammerflimmern",
    waveform: "vf",
    amplitude: 1,
    hf: null,
    generatesOutput: false,
    spo2: null,
  },
  pvt: {
    id: "pvt",
    label: "pulslose VT",
    family: "weitere",
    waveform: "vt",
    hf: 180,
    generatesOutput: false,
    spo2: null,
  },
  pea: {
    id: "pea",
    label: "PEA",
    family: "weitere",
    // Organized electrical activity with a rate, but no output — the teaching point:
    // HF (green) shows a frequency while pulse/SpO2 (cyan) stay "– –".
    waveform: "sinus",
    hf: 50,
    generatesOutput: false,
    spo2: null,
  },
  asystolie: {
    id: "asystolie",
    label: "Asystolie",
    family: "weitere",
    waveform: "asystolie",
    hf: 0,
    generatesOutput: false,
    spo2: null,
  },
};

export const RHYTHM_IDS = Object.keys(RHYTHMS) as RhythmId[];

export function isRhythmId(value: unknown): value is RhythmId {
  return typeof value === "string" && value in RHYTHMS;
}
