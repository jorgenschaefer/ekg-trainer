import type { Rhythm } from "./rhythms";

// Pure waveform sampling. Every client renders its curves locally from these; the
// outputs carry no measured value (those come from the catalog), so the exact phase
// need not match between devices.

const TWO_PI = Math.PI * 2;

function frac(x: number): number {
  return x - Math.floor(x);
}

function gauss(x: number, center: number, width: number): number {
  const d = (x - center) / width;
  return Math.exp(-0.5 * d * d);
}

// One PQRST complex over a normalized beat phase in [0, 1).
function pqrst(phase: number): number {
  return (
    0.18 * gauss(phase, 0.12, 0.025) + // P
    -0.12 * gauss(phase, 0.27, 0.008) + // Q
    1.0 * gauss(phase, 0.3, 0.012) + // R
    -0.22 * gauss(phase, 0.33, 0.01) + // S
    0.3 * gauss(phase, 0.55, 0.04) // T
  );
}

// One monomorphic VT complex over a normalized beat phase in [0, 1): a broad,
// bizarre, repetitive wide-QRS deflection — a tall asymmetric R running into a
// wide S and a fused T. Deliberately NOT a symmetric sine: the slopes differ and
// the positive and negative excursions are unequal, the visual hallmark of VT.
function vtComplex(phase: number): number {
  return (
    1.0 * gauss(phase, 0.34, 0.055) + // broad R
    -0.55 * gauss(phase, 0.5, 0.06) + // wide S
    0.18 * gauss(phase, 0.68, 0.07) // fused T
  );
}

// Ventricular fibrillation: a chaotic carrier in the VF band (≈3.5–11 Hz) whose
// amplitude itself swells and fades over time — fibrillation is irregular in both
// frequency AND amplitude. The carrier coefficients sum to 1 and the envelope peaks
// at 1, so the output stays bounded by `amplitude` (coarse vs fine VF is that one
// scale; the morphology is identical, a continuum).
function vfSample(amplitude: number, t: number): number {
  const carrier =
    0.42 * Math.sin(34.5 * t) +
    0.28 * Math.sin(53.1 * t + 1.3) +
    0.18 * Math.sin(71.2 * t + 2.7) +
    0.12 * Math.sin(22.3 * t + 0.5);
  // Slow, irregular envelope so the trace swells and fades instead of holding a
  // steady band. The floor stays well above zero so fibrillation never momentarily
  // flatlines into something that could read as asystole.
  const envelope =
    0.65 + 0.22 * Math.sin(1.6 * t) + 0.13 * Math.sin(0.9 * t + 1.4);
  return amplitude * envelope * carrier;
}

// Asystole is electrically flat, but a real monitor never draws a perfect line: it
// shows faint baseline wander and a little measurement noise. Kept tiny so it stays
// unmistakably a flat line, far below even fine fibrillation.
function asystoleArtifact(t: number): number {
  return (
    0.018 * Math.sin(0.8 * t) +
    0.012 * Math.sin(2.3 * t + 1.0) +
    0.006 * Math.sin(13.7 * t)
  );
}

function beatPhase(rhythm: Rhythm, t: number): number {
  const period = 60 / (rhythm.hf ?? 60);
  return frac(t / period);
}

// EKG amplitude around an isoelectric baseline of 0.
export function ekgAmplitude(rhythm: Rhythm, t: number): number {
  switch (rhythm.waveform) {
    case "asystolie":
      return asystoleArtifact(t);
    case "sinus":
      return pqrst(beatPhase(rhythm, t));
    case "vt":
      // Broad monomorphic, fast wide-complex waveform — a rate but no organized PQRST.
      return vtComplex(beatPhase(rhythm, t));
    case "vf":
      return vfSample(rhythm.amplitude ?? 1, t);
  }
}

// SpO2 plethysmography pulse in [0, 1]; flat (0) without peripheral output.
export function plethAmplitude(rhythm: Rhythm, t: number): number {
  if (!rhythm.generatesOutput) return 0;
  return Math.max(0, Math.sin(TWO_PI * beatPhase(rhythm, t))) ** 2;
}

// Thorax-compression artifact that overrides the EKG while "Drückt" is on — large
// and irregular so the underlying rhythm cannot be assessed.
export function compressionArtifact(t: number): number {
  return (
    1.1 * Math.sin(7.3 * t) +
    0.5 * Math.sin(17.1 * t + 0.7) +
    0.25 * Math.sin(2.7 * t)
  );
}

interface EkgFrame {
  connected: boolean;
  drueckt: boolean;
  secondsSinceSpike: number;
}

// What the EKG trace draws at one instant, resolving the precedence between the
// EKG leads being connected, a live defib spike, the compression artifact (while
// "Drückt"), and the running rhythm. Read fresh every frame so a rhythm switch lands
// immediately — even mid-compression.
export function ekgFrameSample(
  rhythm: Rhythm,
  t: number,
  { connected, drueckt, secondsSinceSpike }: EkgFrame,
): number {
  // No leads, no trace — a flat line, like an unplugged pulse oximeter's pleth.
  if (!connected) return 0;
  const spike = spikeArtifact(secondsSinceSpike);
  if (spike !== null) return spike;
  return drueckt ? compressionArtifact(t) : ekgAmplitude(rhythm, t);
}

// What the pleth lane draws each frame: the rhythm's pulse when the oximeter is
// connected, otherwise a flat line (the sensor reads nothing when unplugged).
export function plethFrameSample(
  rhythm: Rhythm,
  t: number,
  pulsoxiConnected: boolean,
): number {
  return pulsoxiConnected ? plethAmplitude(rhythm, t) : 0;
}

const SPIKE_DEFLECTION_S = 0.05;
const SPIKE_SATURATION_S = 0.2;

// Defibrillation artifact drawn at the sweep head when a spike fires: a big
// deflection then a brief saturation/flatline. null once it has passed.
export function spikeArtifact(secondsSinceSpike: number): number | null {
  if (secondsSinceSpike < 0) return null;
  if (secondsSinceSpike < SPIKE_DEFLECTION_S) return 1.6;
  if (secondsSinceSpike < SPIKE_SATURATION_S) return 0;
  return null;
}
