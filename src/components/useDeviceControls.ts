"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/timer";

// The trainee monitor's local device controls: a resuscitation-time stopwatch
// (and, later, the defibrillator). All state is local to this device — nothing is
// synced to the server or other monitors.
export interface DeviceControls {
  timer: { running: boolean; label: string };
  toggleTimer: () => void;
}

export function useDeviceControls(): DeviceControls {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Start runs from 00:00; Stop halts and resets to 00:00 (two states, no pause).
  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      setElapsed(0);
    } else {
      setRunning(true);
    }
  };

  return {
    timer: { running, label: formatElapsed(elapsed) },
    toggleTimer,
  };
}
