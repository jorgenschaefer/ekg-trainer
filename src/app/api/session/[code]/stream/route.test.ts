import { describe, expect, test, vi } from "vitest";
import { store } from "@/lib/session-store";
import { GET } from "./route";

function open(code: string, signal?: AbortSignal) {
  return GET(
    new Request(`http://test/api/session/${code}/stream`, { signal }),
    {
      params: Promise.resolve({ code }),
    },
  );
}

async function readChunk(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  return new TextDecoder().decode(value);
}

describe("GET /api/session/:code/stream", () => {
  test("400 for a malformed code", async () => {
    expect((await open("12ab")).status).toBe(400);
  });

  test("404 for an unknown session", async () => {
    expect((await open("0000")).status).toBe(404);
  });

  test("opens an event stream whose first chunk is the full state snapshot", async () => {
    const session = store.createSession();
    const res = await open(session.code);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const chunk = await readChunk(res);
    expect(chunk).toContain("event: state");
    expect(chunk).toContain(JSON.stringify(session.state));
  });

  test("pushes a state event when the admin changes the rhythm", async () => {
    const session = store.createSession();
    const res = await open(session.code);
    await readChunk(res); // consume the initial snapshot
    const reader = res.body!.getReader();
    const next = reader.read();
    store.applyControl(session.code, session.adminToken, {
      type: "setRhythm",
      rhythm: "pvt",
    });
    const chunk = new TextDecoder().decode((await next).value);
    expect(chunk).toContain("event: state");
    expect(chunk).toContain('"rhythm":"pvt"');
  });

  test("a heartbeat keeps the session alive and writes a keep-alive ping", async () => {
    vi.useFakeTimers();
    try {
      const session = store.createSession();
      const before = store.getSession(session.code)!.lastActivity;
      const res = await open(session.code);
      await readChunk(res); // initial snapshot
      vi.advanceTimersByTime(20_000);
      const ping = await readChunk(res);
      expect(ping).toContain(": ping");
      expect(store.getSession(session.code)!.lastActivity).toBeGreaterThan(
        before,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("registers a subscriber and removes it when the client disconnects", async () => {
    const session = store.createSession();
    const controller = new AbortController();
    const res = await open(session.code, controller.signal);
    await readChunk(res);
    expect(store.getSession(session.code)!.subscribers.size).toBe(1);
    controller.abort();
    expect(store.getSession(session.code)!.subscribers.size).toBe(0);
  });
});
