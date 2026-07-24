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
