"use client";

import { useEffect, useRef, useState } from "react";
import { createDefiAudio, type DefiAudio } from "@/lib/defi-audio";
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

// The audio adapter is injectable so tests can assert the tone calls; production
// uses the real Web Audio adapter, created once per hook instance.
export function useDeviceControls(audio?: DefiAudio): DeviceControls {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<DefiStatus>("idle");
  const [chargeRemaining, setChargeRemaining] = useState<number | null>(null);
  const [spikeNonce, setSpikeNonce] = useState(0);

  const audioRef = useRef<DefiAudio | null>(null);
  if (!audioRef.current) audioRef.current = audio ?? createDefiAudio();
  const tones = audioRef.current;

  // Wall-clock anchor for the stopwatch: elapsed is derived from it, not counted
  // per tick, so a throttled/backgrounded tab can't make the resuscitation time
  // drift (skipped interval fires would otherwise under-count).
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Defi tones track the status: rising tone while charging, steady tone while
  // armed. The cleanup silences the previous tone on every change — including on
  // shock/cancel (→ idle) and on unmount.
  useEffect(() => {
    if (status === "charging") {
      tones.charge();
      return () => tones.stop();
    }
    if (status === "armed") {
      tones.ready();
      return () => tones.stop();
    }
  }, [status, tones]);

  // While charging, tick the rough countdown and arm after the full charge time.
  // (The initial count is set in charge() so the first painted frame already shows
  // it — no null flash.)
  useEffect(() => {
    if (status !== "charging") return;
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
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRunning(true);
    }
  };

  const charge = () => {
    const { status: next } = defiTransition(status, "charge");
    // Unlock audio here, in the tap's own call stack (WebKit requirement); the
    // rising tone itself is started by the status effect once we're charging.
    tones.unlock();
    // Seed the countdown synchronously so the first charging frame already shows it.
    if (next === "charging") setChargeRemaining(CHARGE_COUNTDOWN_START);
    setStatus(next);
  };
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
