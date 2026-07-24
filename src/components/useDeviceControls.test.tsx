import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DefiAudio } from "@/lib/defi-audio";
import { useDeviceControls } from "./useDeviceControls";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function mockAudio(): DefiAudio {
  return { unlock: vi.fn(), charge: vi.fn(), ready: vi.fn(), stop: vi.fn() };
}

describe("useDeviceControls — timer", () => {
  test("starts stopped at 00:00", () => {
    const { result } = renderHook(() => useDeviceControls());
    expect(result.current.timer.running).toBe(false);
    expect(result.current.timer.label).toBe("00:00");
  });

  test("start runs the timer and it counts up each second", () => {
    const { result } = renderHook(() => useDeviceControls());
    act(() => result.current.toggleTimer());
    expect(result.current.timer.running).toBe(true);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.timer.label).toBe("00:03");
  });

  test("stop halts the timer and resets the display to 00:00", () => {
    const { result } = renderHook(() => useDeviceControls());
    act(() => result.current.toggleTimer());
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.timer.label).toBe("00:05");
    act(() => result.current.toggleTimer());
    expect(result.current.timer.running).toBe(false);
    expect(result.current.timer.label).toBe("00:00");
    // Stays at 00:00 — no interval keeps ticking after stop.
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.timer.label).toBe("00:00");
  });
});

describe("useDeviceControls — defibrillator", () => {
  function charged() {
    const { result } = renderHook(() => useDeviceControls());
    act(() => result.current.charge());
    act(() => vi.advanceTimersByTime(5500));
    return result;
  }

  test("starts idle with no charge countdown and no spike yet", () => {
    const { result } = renderHook(() => useDeviceControls());
    expect(result.current.defi.status).toBe("idle");
    expect(result.current.defi.chargeRemaining).toBeNull();
    expect(result.current.spikeNonce).toBe(0);
  });

  test("charge runs 5.5s with a rough countdown, then arms", () => {
    const { result } = renderHook(() => useDeviceControls());
    act(() => result.current.charge());
    expect(result.current.defi.status).toBe("charging");
    expect(result.current.defi.chargeRemaining).toBe(5);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.defi.chargeRemaining).toBe(3);
    act(() => vi.advanceTimersByTime(3500));
    expect(result.current.defi.status).toBe("armed");
    expect(result.current.defi.chargeRemaining).toBeNull();
  });

  test("shock from armed fires the spike and returns to idle", () => {
    const result = charged();
    expect(result.current.defi.status).toBe("armed");
    act(() => result.current.shock());
    expect(result.current.defi.status).toBe("idle");
    expect(result.current.spikeNonce).toBe(1);
  });

  test("cancel from armed disarms to idle without a spike", () => {
    const result = charged();
    act(() => result.current.cancel());
    expect(result.current.defi.status).toBe("idle");
    expect(result.current.spikeNonce).toBe(0);
  });

  test("stays armed indefinitely — no auto-disarm", () => {
    const result = charged();
    expect(result.current.defi.status).toBe("armed");
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.defi.status).toBe("armed");
  });

  test("charge is ignored while armed — no re-charge", () => {
    const result = charged();
    act(() => result.current.charge());
    expect(result.current.defi.status).toBe("armed");
  });

  test("shock is ignored while idle — no spike", () => {
    const { result } = renderHook(() => useDeviceControls());
    act(() => result.current.shock());
    expect(result.current.spikeNonce).toBe(0);
    expect(result.current.defi.status).toBe("idle");
  });
});

describe("useDeviceControls — tones", () => {
  test("charge unlocks audio synchronously in the tap (before any effect)", () => {
    const audio = mockAudio();
    const { result } = renderHook(() => useDeviceControls(audio));
    // Call the handler outside act() so no effects have flushed yet — this proves
    // unlock() runs inside the gesture's own call stack, as WebKit requires.
    result.current.charge();
    expect(audio.unlock).toHaveBeenCalled();
  });

  test("charging plays the rising charge tone", () => {
    const audio = mockAudio();
    const { result } = renderHook(() => useDeviceControls(audio));
    act(() => result.current.charge());
    expect(audio.charge).toHaveBeenCalled();
    expect(audio.ready).not.toHaveBeenCalled();
  });

  test("arming plays the ready tone after stopping the charge tone", () => {
    const audio = mockAudio();
    const { result } = renderHook(() => useDeviceControls(audio));
    act(() => result.current.charge());
    (audio.stop as ReturnType<typeof vi.fn>).mockClear();
    act(() => vi.advanceTimersByTime(5500));
    expect(audio.stop).toHaveBeenCalled(); // charge tone silenced on charging→armed
    expect(audio.ready).toHaveBeenCalled();
  });

  test("shock stops the tones", () => {
    const audio = mockAudio();
    const { result } = renderHook(() => useDeviceControls(audio));
    act(() => result.current.charge());
    act(() => vi.advanceTimersByTime(5500));
    (audio.stop as ReturnType<typeof vi.fn>).mockClear();
    act(() => result.current.shock());
    expect(audio.stop).toHaveBeenCalled();
  });

  test("cancel stops the tones", () => {
    const audio = mockAudio();
    const { result } = renderHook(() => useDeviceControls(audio));
    act(() => result.current.charge());
    act(() => vi.advanceTimersByTime(5500));
    (audio.stop as ReturnType<typeof vi.fn>).mockClear();
    act(() => result.current.cancel());
    expect(audio.stop).toHaveBeenCalled();
  });

  test("unmounting while armed stops the tones", () => {
    const audio = mockAudio();
    const { result, unmount } = renderHook(() => useDeviceControls(audio));
    act(() => result.current.charge());
    act(() => vi.advanceTimersByTime(5500));
    (audio.stop as ReturnType<typeof vi.fn>).mockClear();
    unmount();
    expect(audio.stop).toHaveBeenCalled();
  });
});

describe("useDeviceControls — locality", () => {
  test("never touches the network — timer and defi are entirely local", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { result } = renderHook(() => useDeviceControls(mockAudio()));
      act(() => result.current.toggleTimer());
      act(() => result.current.charge());
      act(() => vi.advanceTimersByTime(5500));
      act(() => result.current.shock());
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
