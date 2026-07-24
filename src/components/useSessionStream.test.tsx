import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { INITIAL_STATE } from "@/lib/session-state";
import { useSessionStream } from "./useSessionStream";

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, (e: { data: string }) => void> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: { data: string }) => void) {
    this.listeners[type] = cb;
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data = "{}") {
    this.listeners[type]?.({ data });
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
  }
}

function latest() {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});
afterEach(() => vi.unstubAllGlobals());

describe("useSessionStream", () => {
  test("opens the stream for the code and starts connecting", () => {
    const { result } = renderHook(() => useSessionStream("123456"));
    expect(latest().url).toBe("/api/session/123456/stream");
    expect(result.current.status).toBe("connecting");
  });

  test("a state event updates the synced state; open switches to open", () => {
    const { result } = renderHook(() => useSessionStream("123456"));
    act(() => latest().open());
    expect(result.current.status).toBe("open");
    act(() =>
      latest().emit(
        "state",
        JSON.stringify({ ...INITIAL_STATE, rhythm: "pvt" }),
      ),
    );
    expect(result.current.state?.rhythm).toBe("pvt");
  });

  test("an ended event is terminal and closes the stream", () => {
    const { result } = renderHook(() => useSessionStream("123456"));
    const es = latest();
    act(() => es.emit("ended"));
    expect(result.current.status).toBe("ended");
    expect(es.closed).toBe(true);
  });

  test("a disconnect shows reconnecting only after a ~1s debounce, and clears on reopen", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSessionStream("123456"));
      act(() => latest().open());
      act(() => latest().fail());
      // Not yet — a brief blip must not flash the pill.
      expect(result.current.status).toBe("open");
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.status).toBe("reconnecting");
      act(() => latest().open());
      expect(result.current.status).toBe("open");
    } finally {
      vi.useRealTimers();
    }
  });

  test("unmounting closes the stream", () => {
    const { unmount } = renderHook(() => useSessionStream("123456"));
    const es = latest();
    unmount();
    expect(es.closed).toBe(true);
  });
});
