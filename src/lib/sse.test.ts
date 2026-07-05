import { describe, expect, test } from "vitest";
import { INITIAL_STATE } from "./session-state";
import { formatSse, SSE_KEEPALIVE } from "./sse";

describe("formatSse", () => {
  test("a state event carries the full state snapshot as JSON", () => {
    expect(formatSse({ type: "state", state: INITIAL_STATE })).toBe(
      `event: state\ndata: ${JSON.stringify(INITIAL_STATE)}\n\n`,
    );
  });

  test("spike and ended carry a non-empty data line so EventSource dispatches them", () => {
    expect(formatSse({ type: "spike" })).toBe("event: spike\ndata: {}\n\n");
    expect(formatSse({ type: "ended" })).toBe("event: ended\ndata: {}\n\n");
  });

  test("keep-alive is an SSE comment", () => {
    expect(SSE_KEEPALIVE).toBe(": ping\n\n");
  });
});
