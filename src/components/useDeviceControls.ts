"use client";

import { useEffect, useState } from "react";
import { type DefiStatus, defiTransition } from "@/lib/defibrillator";
import { formatElapsed } from "@/lib/timer";

// Charge time of the real corpuls1 (data sheet: ca. 5.5 s).
const CHARGE_MS = 5500;
// The charge indicator counts down whole seconds — a rough "verbleibende Sekunden".
const CHARGE_COUNTDOWN_START = Math.floor(CHARGE_MS / 1000);

// The trainee monitor's local device controls: a resuscitation-time stopwatch and
// the defibrillator (Laden → Schock/Abbrechen). All state is local to this device —
// nothing is synced to the server or other monitors.
export interface DeviceControls {
  timer: { running: boolean; label: string };
  toggleTimer: () => void;
  defi: { status: DefiStatus; chargeRemaining: number | null };
  charge: () => void;
  shock: () => void;
  cancel: () => void;
  // Advances on every local shock; drives the spike artifact in Waveforms.
  spikeNonce: number;
}

export function useDeviceControls(): DeviceControls {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<DefiStatus>("idle");
  const [chargeRemaining, setChargeRemaining] = useState<number | null>(null);
  const [spikeNonce, setSpikeNonce] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // While charging, tick the rough countdown and arm after the full charge time.
  useEffect(() => {
    if (status !== "charging") return;
    setChargeRemaining(CHARGE_COUNTDOWN_START);
    const countdown = setInterval(
      () => setChargeRemaining((r) => (r && r > 1 ? r - 1 : r)),
      1000,
    );
    const arm = setTimeout(() => {
      setStatus((s) => defiTransition(s, "chargeComplete").status);
      setChargeRemaining(null);
    }, CHARGE_MS);
    return () => {
      clearInterval(countdown);
      clearTimeout(arm);
    };
  }, [status]);

  // Start runs from 00:00; Stop halts and resets to 00:00 (two states, no pause).
  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      setElapsed(0);
    } else {
      setRunning(true);
    }
  };

  const charge = () => setStatus((s) => defiTransition(s, "charge").status);
  const cancel = () => setStatus((s) => defiTransition(s, "cancel").status);
  // Reads `status` from the render's closure (not a functional update) because we
  // also need the transition's fireSpike flag. Safe: the Schock button is disabled
  // unless armed, so a click can only land on the current, up-to-date status.
  const shock = () => {
    const { status: next, fireSpike } = defiTransition(status, "shock");
    setStatus(next);
    if (fireSpike) setSpikeNonce((n) => n + 1);
  };

  return {
    timer: { running, label: formatElapsed(elapsed) },
    toggleTimer,
    defi: { status, chargeRemaining },
    charge,
    shock,
    cancel,
    spikeNonce,
  };
}
