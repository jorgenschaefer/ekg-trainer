import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDeviceControls } from "./useDeviceControls";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
