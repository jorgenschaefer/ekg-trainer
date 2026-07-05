import { describe, expect, test } from "vitest";
import { store } from "@/lib/session-store";
import { POST } from "./route";

describe("POST /api/session", () => {
  test("creates a session and returns its code and admin token", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toMatch(/^\d{4}$/);
    // Crypto-random 32 hex chars (16 bytes).
    expect(body.adminToken).toMatch(/^[0-9a-f]{32}$/);
    // The session is now retrievable from the shared store.
    expect(store.getSession(body.code)?.adminToken).toBe(body.adminToken);
  });
});
