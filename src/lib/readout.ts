import { RHYTHMS } from "./rhythms";
import type { SessionState } from "./session-state";

// Shown for any value the monitor cannot show — either the module is switched off
// or the rhythm produces no measurable value ("nicht messbar"). Both look the same.
export const NO_SIGNAL = "– –";

export interface MonitorReadout {
  hf: string;
  spo2: string;
  pulse: string;
}

// Derives the numeric block both the monitor and the admin mirror render. Every
// readout is always shown; a switched-off module reads "– –", same as a rhythm that
// can't produce that value. HF follows the EKG; peripheral pulse and SpO2 follow the
// rhythm's output flag — so PEA shows a heart rate while pulse/SpO2 stay "nicht messbar".
export function monitorReadout(state: SessionState): MonitorReadout {
  const rhythm = RHYTHMS[state.rhythm];

  return {
    hf: state.modules.ekg && rhythm.hf !== null ? String(rhythm.hf) : NO_SIGNAL,
    spo2:
      state.modules.pulsoxi && rhythm.generatesOutput && rhythm.spo2 !== null
        ? String(rhythm.spo2)
        : NO_SIGNAL,
    pulse:
      state.modules.pulsoxi && rhythm.generatesOutput && rhythm.hf !== null
        ? String(rhythm.hf)
        : NO_SIGNAL,
  };
}
