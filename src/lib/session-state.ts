import type { RhythmId } from "./rhythms";

// The synchronized state — the whole contract object broadcast to every client.
// Kept deliberately tiny: curves are rendered locally from this, so the smaller
// the contract, the less divergence between clients.
export interface SessionState {
  rhythm: RhythmId;
  drueckt: boolean;
  modules: {
    // EKG leads connected — gates the EKG curve and the HF readout.
    ekg: boolean;
    // Pulse oximeter connected — gates the pleth curve, SpO2 and peripheral pulse.
    pulsoxi: boolean;
  };
}

export const INITIAL_STATE: SessionState = {
  rhythm: "sinus-normo",
  drueckt: false,
  modules: { ekg: true, pulsoxi: true },
};
