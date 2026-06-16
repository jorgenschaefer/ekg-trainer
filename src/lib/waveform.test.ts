import { describe, expect, test } from "vitest";
import {
  compressionArtifact,
  ekgAmplitude,
  ekgFrameSample,
  plethAmplitude,
  plethFrameSample,
  spikeArtifact,
} from "./waveform";
import { RHYTHMS } from "./rhythms";

function sample(fn: (t: number) => number, from: number, to: number, step = 0.005) {
  const values: number[] = [];
  for (let t = from; t < to; t += step) values.push(fn(t));
  return values;
}

describe("ekgAmplitude", () => {
  test("asystole is a flat line", () => {
    const flat = sample((t) => ekgAmplitude(RHYTHMS.asystolie, t), 0, 3);
    expect(Math.max(...flat.map(Math.abs))).toBe(0);
  });

  test("sinus has a tall QRS once per beat and a quiet baseline between beats", () => {
    const r = RHYTHMS["sinus-normo"];
    const period = 60 / 70;
    const peak = Math.max(...sample((t) => ekgAmplitude(r, t), 0, period));
    expect(peak).toBeGreaterThan(0.8);
    // mid-diastole is near the isoelectric line
    expect(Math.abs(ekgAmplitude(r, period * 0.6))).toBeLessThan(0.2);
  });

  test("the EKG repeats every beat period", () => {
    const r = RHYTHMS["sinus-normo"];
    const period = 60 / 70;
    expect(ekgAmplitude(r, 0.3)).toBeCloseTo(ekgAmplitude(r, 0.3 + period), 6);
  });

  test("fibrillation is chaotic but bounded by its amplitude", () => {
    const r = RHYTHMS["vf-grob"];
    const values = sample((t) => ekgAmplitude(r, t), 0, 2);
    expect(new Set(values.map((v) => v.toFixed(3))).size).toBeGreaterThan(50);
    expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(r.amplitude! + 0.001);
  });

  test("pVT is a fast, non-flat waveform", () => {
    const values = sample((t) => ekgAmplitude(RHYTHMS.pvt, t), 0, 1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
  });
});

describe("plethAmplitude", () => {
  test("is flat whenever the rhythm produces no output", () => {
    for (const id of ["pea", "vf-fein", "pvt", "asystolie"] as const) {
      const flat = sample((t) => plethAmplitude(RHYTHMS[id], t), 0, 3);
      expect(Math.max(...flat.map(Math.abs))).toBe(0);
    }
  });

  test("pulsates when there is output", () => {
    const r = RHYTHMS["sinus-normo"];
    const values = sample((t) => plethAmplitude(r, t), 0, 3);
    expect(Math.max(...values)).toBeGreaterThan(0.3);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
  });
});

describe("plethFrameSample (what the pleth lane draws each frame)", () => {
  test("is flat when the pulse oximeter is not connected, whatever the rhythm", () => {
    const r = RHYTHMS["sinus-normo"];
    const flat = sample((t) => plethFrameSample(r, t, false), 0, 3);
    expect(Math.max(...flat.map(Math.abs))).toBe(0);
  });

  test("follows the rhythm's pleth when the pulse oximeter is connected", () => {
    const r = RHYTHMS["sinus-normo"];
    const t = 0.42;
    expect(plethFrameSample(r, t, true)).toBe(plethAmplitude(r, t));
  });
});

describe("compressionArtifact", () => {
  test("is non-flat and bounded — it overrides the rhythm so it can't be read", () => {
    const values = sample(compressionArtifact, 0, 2);
    expect(new Set(values.map((v) => v.toFixed(3))).size).toBeGreaterThan(20);
    expect(Math.max(...values.map(Math.abs))).toBeLessThan(2);
  });
});

describe("ekgFrameSample (what the EKG draws each frame)", () => {
  const NO_SPIKE = -1; // spike already finished

  const frame = (over = {}) => ({ connected: true, drueckt: false, secondsSinceSpike: NO_SPIKE, ...over });

  test("without Drückt it shows the current rhythm", () => {
    const t = 0.37;
    expect(ekgFrameSample(RHYTHMS["sinus-normo"], t, frame())).toBe(
      ekgAmplitude(RHYTHMS["sinus-normo"], t),
    );
    // switching the rhythm is honored frame-to-frame
    expect(ekgFrameSample(RHYTHMS.pvt, t, frame())).toBe(ekgAmplitude(RHYTHMS.pvt, t));
  });

  test("Drückt overlays the compression artifact and hides the rhythm, whatever it is", () => {
    const t = 0.37;
    // asystole's clean curve is flat; with Drückt the trace is the (non-flat) artifact
    expect(ekgFrameSample(RHYTHMS.asystolie, t, frame({ drueckt: true }))).toBe(
      compressionArtifact(t),
    );
    expect(ekgFrameSample(RHYTHMS.pvt, t, frame({ drueckt: true }))).toBe(
      compressionArtifact(t),
    );
  });

  test("is flat when the EKG leads are not connected — overriding rhythm, compression and spike", () => {
    const t = 0.37;
    expect(ekgFrameSample(RHYTHMS["sinus-normo"], t, frame({ connected: false }))).toBe(0);
    expect(
      ekgFrameSample(RHYTHMS.pvt, t, frame({ connected: false, drueckt: true, secondsSinceSpike: 0 })),
    ).toBe(0);
  });

  test("a live spike overrides both the rhythm and the compression artifact", () => {
    // even under Drückt, the fresh spike wins
    expect(ekgFrameSample(RHYTHMS.asystolie, 0.37, frame({ drueckt: true, secondsSinceSpike: 0 }))).toBe(
      spikeArtifact(0),
    );
    // once the spike has passed it falls back to the running curve
    expect(ekgFrameSample(RHYTHMS.asystolie, 0.37, frame())).toBe(0);
  });
});

describe("spikeArtifact", () => {
  test("is a big deflection that then saturates briefly, then ends", () => {
    expect(Math.abs(spikeArtifact(0)!)).toBeGreaterThan(1);
    expect(spikeArtifact(0.1)).not.toBeNull(); // still drawing the saturation segment
    expect(spikeArtifact(0.5)).toBeNull(); // artifact is over
  });
});
