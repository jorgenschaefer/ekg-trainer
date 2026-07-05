import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { INITIAL_STATE } from "@/lib/session-state";

import Waveforms from "./Waveforms";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom canvases have no real 2D backing, so hand each canvas its own recording
// context. We also capture the rAF callback and drive a fake clock so we can
// step the sweep loop frame by frame and simulate a stall (hidden tab, occluded
// window, throttling) as a jump in time.
function stubCanvas() {
  const contexts = new Map<
    HTMLCanvasElement,
    { clearRect: ReturnType<typeof vi.fn> }
  >();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      let ctx = contexts.get(this);
      if (!ctx) {
        ctx = {
          clearRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          strokeStyle: "",
          lineWidth: 0,
          lineJoin: "",
        } as never;
        contexts.set(this, ctx!);
      }
      return ctx as never;
    },
  );
  let nowMs = 0;
  let rafCb: FrameRequestCallback | null = null;
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCb = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    contexts,
    advanceTo(ms: number) {
      nowMs = ms;
      rafCb?.(ms);
    },
  };
}

// How often `clearRect` wiped the whole backing store at its current size — i.e.
// a full sweep restart, as opposed to the 10px gap eraser that runs every frame.
function fullClears(
  ctx: { clearRect: ReturnType<typeof vi.fn> } | undefined,
  canvas: HTMLCanvasElement,
) {
  return (ctx?.clearRect.mock.calls ?? []).filter(
    ([x, y, w, h]) =>
      x === 0 && y === 0 && w === canvas.width && h === canvas.height,
  ).length;
}

describe("Waveforms", () => {
  test("restarts the sweep clean after the loop stalls, not on a normal frame", () => {
    const { contexts, advanceTo } = stubCanvas();
    render(<Waveforms state={INITIAL_STATE} spikeNonce={0} />);

    const ekg = screen.getByTestId("ekg-curve") as HTMLCanvasElement;
    const pleth = screen.getByTestId("pleth-curve") as HTMLCanvasElement;

    advanceTo(0); // first frame establishes the sweep
    advanceTo(16); // a normal ~60fps step must not restart the sweep
    advanceTo(32);

    for (const canvas of [ekg, pleth]) {
      expect(fullClears(contexts.get(canvas), canvas)).toBe(0);
    }

    advanceTo(5000); // the loop stalled and resumed seconds later

    for (const canvas of [ekg, pleth]) {
      expect(fullClears(contexts.get(canvas), canvas)).toBe(1);
    }
  });
});
