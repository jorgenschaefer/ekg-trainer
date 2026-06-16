import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { INITIAL_STATE } from "@/lib/session-state";

import Waveforms from "./Waveforms";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom canvases have no real 2D backing, so hand each canvas its own recording
// context and freeze the rAF loop — the visibility behaviour we test doesn't
// depend on frames actually running.
function stubCanvas() {
  const contexts = new Map<HTMLCanvasElement, { clearRect: ReturnType<typeof vi.fn> }>();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
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
  });
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return contexts;
}

describe("Waveforms", () => {
  test("fully clears every canvas when the tab becomes visible again", () => {
    const contexts = stubCanvas();
    render(<Waveforms state={INITIAL_STATE} spikeNonce={0} />);

    const ekg = screen.getByTestId("ekg-curve") as HTMLCanvasElement;
    const pleth = screen.getByTestId("pleth-curve") as HTMLCanvasElement;

    document.dispatchEvent(new Event("visibilitychange"));

    for (const canvas of [ekg, pleth]) {
      const ctx = contexts.get(canvas);
      expect(ctx?.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
    }
  });
});
