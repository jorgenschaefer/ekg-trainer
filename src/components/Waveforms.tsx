"use client";

import { useEffect, useRef } from "react";
import { RHYTHMS } from "@/lib/rhythms";
import { ekgFrameSample, plethFrameSample } from "@/lib/waveform";
import type { SessionState } from "@/lib/session-state";
import styles from "./Waveforms.module.css";

// Seconds of trace across the full canvas width (sweep period).
const WINDOW_S = 5;
// A gap between frames larger than this means the loop stalled (hidden tab,
// occluded/blurred window, rAF throttling, sleep) rather than ran normally.
const STALL_GAP_S = 0.2;
const EKG_COLOR = "#0c9a43";
const PLETH_COLOR = "#0a8f99";

// Curves are drawn locally from the synced state on each client (not streamed as
// pixels). A sweep head advances across the canvas; the rhythm, "Drückt" and the
// spike are read live each frame, so a rhythm switch lands immediately — even mid
// compression. The pleth lane is always present; it goes flat when the pulse
// oximeter is switched off, so the layout never reflows.
export default function Waveforms({
  state,
  spikeNonce,
}: {
  state: SessionState;
  spikeNonce?: number;
}) {
  const ekgRef = useRef<HTMLCanvasElement>(null);
  const plethRef = useRef<HTMLCanvasElement>(null);

  // Latest props read by the animation loop, so it never closes over stale state.
  const live = useRef({ state, spikeNonce });
  live.current = { state, spikeNonce };

  useEffect(() => {
    if (typeof requestAnimationFrame === "undefined") return;
    const ekgCtx = ekgRef.current?.getContext("2d") ?? null;
    if (!ekgCtx) return; // no canvas backing (e.g. jsdom) — nothing to draw

    const startedAt = performance.now();
    // Last sweep-head position per trace, so each frame connects to the previous one.
    const heads: Record<string, { x: number; y: number }> = {};
    let prevNonce = live.current.spikeNonce;
    let spikeStart = -Infinity;
    let prevNow = -Infinity;
    let raf = 0;

    function drawSweep(
      canvas: HTMLCanvasElement,
      trace: "ekg" | "pleth",
      now: number,
      color: string,
      baselineFrac: number,
      scale: number,
      amplitudeAt: (t: number) => number,
    ) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 120;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const x = ((now % WINDOW_S) / WINDOW_S) * w;
      const y = h * baselineFrac - amplitudeAt(now) * h * scale;

      // Erase a small gap just ahead of the head, like a monitor sweep.
      ctx.clearRect(x, 0, 10, h);

      const head = heads[trace];
      // Skip the wrap-around frame (x jumps back to 0) so the trace doesn't streak
      // back across the screen.
      if (head && x >= head.x) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      heads[trace] = { x, y };
    }

    function frame() {
      const now = (performance.now() - startedAt) / 1000;
      // The loop stalled and resumed: performance.now() kept running while rAF
      // was paused, so the sweep head jumped far ahead. The 10px gap eraser only
      // wipes a sliver, so a connecting stroke would streak the old trace across
      // the screen. Fully clear and drop the heads so the sweep restarts clean.
      if (now - prevNow > STALL_GAP_S) {
        for (const canvas of [ekgRef.current, plethRef.current]) {
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        for (const trace of Object.keys(heads)) delete heads[trace];
      }
      prevNow = now;
      const { state, spikeNonce } = live.current;
      if (spikeNonce !== prevNonce) {
        prevNonce = spikeNonce;
        spikeStart = now;
      }
      const rhythm = RHYTHMS[state.rhythm];

      if (ekgRef.current) {
        drawSweep(ekgRef.current, "ekg", now, EKG_COLOR, 0.5, 0.32, (t) =>
          ekgFrameSample(rhythm, t, {
            connected: state.modules.ekg,
            drueckt: state.drueckt,
            secondsSinceSpike: t - spikeStart,
          }),
        );
      }
      if (plethRef.current) {
        drawSweep(plethRef.current, "pleth", now, PLETH_COLOR, 0.9, 0.8, (t) =>
          plethFrameSample(rhythm, t, state.modules.pulsoxi),
        );
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.stack}>
      <canvas ref={ekgRef} data-testid="ekg-curve" className={styles.ekg} />
      <canvas ref={plethRef} data-testid="pleth-curve" className={styles.pleth} />
    </div>
  );
}
