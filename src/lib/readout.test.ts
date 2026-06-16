import { describe, expect, test } from "vitest";
import { monitorReadout, NO_SIGNAL } from "./readout";
import type { SessionState } from "./session-state";

function state(overrides: Partial<SessionState> = {}): SessionState {
  return {
    rhythm: "sinus-normo",
    drueckt: false,
    modules: { ekg: true, pulsoxi: true },
    ...overrides,
  };
}

describe("monitorReadout", () => {
  test("sinus normo: HF, SpO2 and peripheral pulse all read out", () => {
    const r = monitorReadout(state());
    expect(r.hf).toBe("70");
    expect(r.spo2).toBe("98");
    expect(r.pulse).toBe("70");
  });

  test("PEA: HF shows the rate but pulse and SpO2 are not measurable", () => {
    const r = monitorReadout(state({ rhythm: "pea" }));
    expect(r.hf).toBe("50");
    expect(r.spo2).toBe(NO_SIGNAL);
    expect(r.pulse).toBe(NO_SIGNAL);
  });

  test("asystole shows HF 0", () => {
    expect(monitorReadout(state({ rhythm: "asystolie" })).hf).toBe("0");
  });

  test("fibrillation shows no assessable HF", () => {
    expect(monitorReadout(state({ rhythm: "vf-grob" })).hf).toBe(NO_SIGNAL);
  });

  test("HF module off shows '– –' but the readout stays present", () => {
    const r = monitorReadout(state({ modules: { ekg: false, pulsoxi: true } }));
    expect(r.hf).toBe(NO_SIGNAL);
  });

  test("pulsoxi off shows '– –' for SpO2 and peripheral pulse together", () => {
    const r = monitorReadout(state({ modules: { ekg: true, pulsoxi: false } }));
    expect(r.spo2).toBe(NO_SIGNAL);
    expect(r.pulse).toBe(NO_SIGNAL);
  });
});
