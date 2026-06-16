import { beforeEach, describe, expect, test, vi } from "vitest";
import { createStore, type SessionEvent, type SessionStore } from "./store";

function fixedDeps(codes: string[], token = "tok-abc") {
  let i = 0;
  return {
    now: () => 1000,
    randomCode: () => codes[Math.min(i++, codes.length - 1)],
    randomToken: () => token,
  };
}

describe("createSession", () => {
  let store: SessionStore;
  beforeEach(() => {
    store = createStore(fixedDeps(["123456"]));
  });

  test("returns a session with code, admin token and the initial state", () => {
    const s = store.createSession();
    expect(s.code).toBe("123456");
    expect(s.adminToken).toBe("tok-abc");
    expect(s.state).toEqual({
      rhythm: "sinus-normo",
      drueckt: false,
      modules: { ekg: true, pulsoxi: true },
    });
    expect(s.lastActivity).toBe(1000);
  });

  test("re-rolls the code when it collides with an active session", () => {
    const store = createStore(fixedDeps(["123456", "123456", "654321"]));
    const a = store.createSession();
    const b = store.createSession();
    expect(a.code).toBe("123456");
    expect(b.code).toBe("654321");
  });

  test("each session starts with its own state object", () => {
    const store = createStore(fixedDeps(["111111", "222222"]));
    const a = store.createSession();
    a.state.drueckt = true;
    const b = store.createSession();
    expect(b.state.drueckt).toBe(false);
  });
});

describe("getSession", () => {
  test("returns the stored session, or undefined for an unknown code", () => {
    const store = createStore(fixedDeps(["123456"]));
    const s = store.createSession();
    expect(store.getSession("123456")).toBe(s);
    expect(store.getSession("000000")).toBeUndefined();
  });
});

describe("sweep (expiry)", () => {
  function storeAt(now: () => number) {
    return createStore({ now, randomCode: () => "123456", randomToken: () => "t" });
  }

  test("removes a session idle for more than 60 minutes and ends its streams", () => {
    let now = 0;
    const store = storeAt(() => now);
    store.createSession();
    const events: SessionEvent[] = [];
    store.subscribe("123456", (e) => events.push(e));

    now = 60 * 60 * 1000 + 1;
    store.sweep();

    expect(store.getSession("123456")).toBeUndefined();
    expect(events).toEqual([{ type: "ended" }]);
  });

  test("keeps a session that was active within the last 60 minutes", () => {
    let now = 0;
    const store = storeAt(() => now);
    store.createSession();

    now = 60 * 60 * 1000 - 1;
    store.sweep();

    expect(store.getSession("123456")).toBeDefined();
  });
});

describe("applyControl", () => {
  let store: SessionStore;
  let token: string;
  let events: SessionEvent[];

  beforeEach(() => {
    store = createStore(fixedDeps(["123456"], "secret"));
    token = store.createSession().adminToken;
    events = [];
    store.subscribe("123456", (e) => events.push(e));
  });

  test("setRhythm changes the rhythm and broadcasts the new state", () => {
    const result = store.applyControl("123456", token, {
      type: "setRhythm",
      rhythm: "pvt",
    });
    expect(result).toBe("ok");
    expect(store.getSession("123456")!.state.rhythm).toBe("pvt");
    expect(events).toEqual([
      { type: "state", state: store.getSession("123456")!.state },
    ]);
  });

  test("setDrueckt and setModule mutate the right fields", () => {
    store.applyControl("123456", token, { type: "setDrueckt", drueckt: true });
    store.applyControl("123456", token, {
      type: "setModule",
      module: "pulsoxi",
      on: false,
    });
    const state = store.getSession("123456")!.state;
    expect(state.drueckt).toBe(true);
    expect(state.modules.pulsoxi).toBe(false);
  });

  test("broadcasts to every subscriber — many monitors share one session", () => {
    const a: SessionEvent[] = [];
    const b: SessionEvent[] = [];
    store.subscribe("123456", (e) => a.push(e));
    store.subscribe("123456", (e) => b.push(e));
    store.applyControl("123456", token, { type: "setRhythm", rhythm: "pvt" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a).toEqual(b);
  });

  test("spike broadcasts a spike event without changing state", () => {
    const before = structuredClone(store.getSession("123456")!.state);
    store.applyControl("123456", token, { type: "spike" });
    expect(events).toEqual([{ type: "spike" }]);
    expect(store.getSession("123456")!.state).toEqual(before);
  });

  test("a wrong token is forbidden and neither mutates nor broadcasts", () => {
    const result = store.applyControl("123456", "wrong", {
      type: "setDrueckt",
      drueckt: true,
    });
    expect(result).toBe("forbidden");
    expect(store.getSession("123456")!.state.drueckt).toBe(false);
    expect(events).toEqual([]);
  });

  test("an unknown code is not found", () => {
    expect(
      store.applyControl("000000", token, { type: "spike" }),
    ).toBe("not-found");
  });

  test("touch bumps lastActivity to now (used on SSE connect/heartbeat)", () => {
    const ticking = createStore({
      now: vi.fn().mockReturnValueOnce(1000).mockReturnValue(9000),
      randomCode: () => "123456",
      randomToken: () => "secret",
    });
    ticking.createSession();
    ticking.touch("123456");
    expect(ticking.getSession("123456")!.lastActivity).toBe(9000);
  });

  test("bumps lastActivity on a successful command", () => {
    const ticking = createStore({
      now: vi.fn().mockReturnValueOnce(1000).mockReturnValue(5000),
      randomCode: () => "123456",
      randomToken: () => "secret",
    });
    ticking.createSession();
    expect(ticking.getSession("123456")!.lastActivity).toBe(1000);
    ticking.applyControl("123456", "secret", { type: "spike" });
    expect(ticking.getSession("123456")!.lastActivity).toBe(5000);
  });

  test("unsubscribe stops further events", () => {
    const unsub = store.subscribe("123456", (e) => events.push(e));
    unsub();
    store.applyControl("123456", token, { type: "spike" });
    // Only the first subscriber (from beforeEach) still receives the event.
    expect(events).toEqual([{ type: "spike" }]);
  });
});
