import { describe, expect, test } from "vitest";
import { store } from "@/lib/session-store";
import { POST } from "./route";

function post(code: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return POST(
    new Request(`http://test/api/session/${code}/control`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) },
  );
}

describe("POST /api/session/:code/control", () => {
  test("applies a valid command with the admin token", async () => {
    const session = store.createSession();
    const res = await post(
      session.code,
      { type: "setRhythm", rhythm: "pvt" },
      session.adminToken,
    );
    expect(res.status).toBe(200);
    expect(store.getSession(session.code)!.state.rhythm).toBe("pvt");
  });

  test("403 without a token — code alone never controls", async () => {
    const session = store.createSession();
    const res = await post(session.code, { type: "setDrueckt", drueckt: true });
    expect(res.status).toBe(403);
    expect(store.getSession(session.code)!.state.drueckt).toBe(false);
  });

  test("403 with a wrong token", async () => {
    const session = store.createSession();
    const res = await post(
      session.code,
      { type: "setDrueckt", drueckt: true },
      "wrong-token",
    );
    expect(res.status).toBe(403);
  });

  test("404 for an unknown session", async () => {
    const res = await post(
      "0000",
      { type: "setDrueckt", drueckt: true },
      "any",
    );
    expect(res.status).toBe(404);
  });

  test("400 for a malformed code", async () => {
    const res = await post(
      "12ab",
      { type: "setDrueckt", drueckt: true },
      "any",
    );
    expect(res.status).toBe(400);
  });

  test("400 for an invalid command", async () => {
    const session = store.createSession();
    const res = await post(
      session.code,
      { type: "setRhythm", rhythm: "bogus" },
      session.adminToken,
    );
    expect(res.status).toBe(400);
  });

  test("400 for the removed spike command", async () => {
    const session = store.createSession();
    const res = await post(session.code, { type: "spike" }, session.adminToken);
    expect(res.status).toBe(400);
  });
});
