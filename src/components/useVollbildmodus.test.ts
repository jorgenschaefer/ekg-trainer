import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "@/lib/fullscreen";
import { useVollbildmodus } from "./useVollbildmodus";

vi.mock("@/lib/fullscreen");

const mocked = vi.mocked(fs);

// Each acquire hands back a distinct sentinel so tests can tell one lock from the
// next — and prove a prior one was released rather than orphaned.
let sentinels: { release: ReturnType<typeof vi.fn> }[];

beforeEach(() => {
  sentinels = [];
  mocked.supportsFullscreen.mockReturnValue(true);
  mocked.supportsWakeLock.mockReturnValue(true);
  mocked.isFullscreen.mockReturnValue(false);
  mocked.enterFullscreen.mockResolvedValue(undefined);
  mocked.exitFullscreen.mockResolvedValue(undefined);
  mocked.lockLandscape.mockResolvedValue(undefined);
  mocked.acquireWakeLock.mockImplementation(async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) };
    sentinels.push(sentinel);
    return sentinel as unknown as WakeLockSentinel;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// renderHook never mounts the ref onto a node, so stand in a real element for the
// requestFullscreen target the way the DOM would.
function mount() {
  const hook = renderHook(() => useVollbildmodus());
  hook.result.current.ref.current = document.createElement("div");
  return hook;
}

describe("useVollbildmodus", () => {
  test("is supported when either capability is present", () => {
    mocked.supportsFullscreen.mockReturnValue(false);
    mocked.supportsWakeLock.mockReturnValue(true);
    expect(mount().result.current.supported).toBe(true);
  });

  test("is unsupported when neither capability is present", () => {
    mocked.supportsFullscreen.mockReturnValue(false);
    mocked.supportsWakeLock.mockReturnValue(false);
    expect(mount().result.current.supported).toBe(false);
  });

  test("a tap enters fullscreen, acquires the wake lock and goes active", async () => {
    const { result } = mount();
    const el = result.current.ref.current;
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.enterFullscreen).toHaveBeenCalledWith(el);
    expect(mocked.acquireWakeLock).toHaveBeenCalled();
    expect(result.current.active).toBe(true);
  });

  test("entering fullscreen also requests a landscape lock", async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.lockLandscape).toHaveBeenCalled();
  });

  test("best-effort: a failed landscape lock still acquires the wake lock and activates", async () => {
    mocked.lockLandscape.mockRejectedValue(new Error("unsupported"));
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.acquireWakeLock).toHaveBeenCalled();
    expect(result.current.active).toBe(true);
  });

  test("best-effort: still requests the landscape lock even when fullscreen entry is denied", async () => {
    mocked.enterFullscreen.mockRejectedValue(new Error("denied"));
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.lockLandscape).toHaveBeenCalled();
  });

  test("does not request a landscape lock when fullscreen is unavailable", async () => {
    mocked.supportsFullscreen.mockReturnValue(false);
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.lockLandscape).not.toHaveBeenCalled();
  });

  test("on a wake-lock-only device it skips fullscreen but still activates", async () => {
    mocked.supportsFullscreen.mockReturnValue(false);
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.enterFullscreen).not.toHaveBeenCalled();
    expect(mocked.acquireWakeLock).toHaveBeenCalled();
    expect(result.current.active).toBe(true);
  });

  test("best-effort: a failed fullscreen request still acquires the wake lock", async () => {
    mocked.enterFullscreen.mockRejectedValue(new Error("denied"));
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.acquireWakeLock).toHaveBeenCalled();
    expect(result.current.active).toBe(true);
  });

  test("a second tap exits fullscreen, releases the wake lock and goes inactive", async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    mocked.isFullscreen.mockReturnValue(true);
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.exitFullscreen).toHaveBeenCalled();
    expect(sentinels[0].release).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  test("leaving fullscreen by a system gesture flips the toggle off and releases the lock", async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    // The browser reports fullscreen is gone, then fires fullscreenchange.
    mocked.isFullscreen.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.active).toBe(false);
    expect(sentinels[0].release).toHaveBeenCalled();

    // ein erneuter Tap startet beides wieder
    mocked.enterFullscreen.mockClear();
    await act(async () => {
      await result.current.toggle();
    });
    expect(mocked.enterFullscreen).toHaveBeenCalled();
    expect(sentinels).toHaveLength(2);
    expect(result.current.active).toBe(true);
  });

  test("re-acquires the wake lock when the page becomes visible again while active", async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    mocked.acquireWakeLock.mockClear();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mocked.acquireWakeLock).toHaveBeenCalled();
  });

  test("releases the prior sentinel before re-acquiring, so locks are never orphaned", async () => {
    const { result } = mount();
    await act(async () => {
      await result.current.toggle();
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(sentinels).toHaveLength(2);
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  test("does not re-acquire the wake lock on visibility change when inactive", async () => {
    mount();
    mocked.acquireWakeLock.mockClear();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mocked.acquireWakeLock).not.toHaveBeenCalled();
  });
});
