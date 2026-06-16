import { describe, expect, test } from "vitest";
import { GET } from "./route";
import { store } from "@/lib/session-store";

function call(code: string) {
  return GET(new Request(`http://test/api/session/${code}`), {
    params: Promise.resolve({ code }),
  });
}

describe("GET /api/session/:code", () => {
  test("200 for an active session", async () => {
    const code = store.createSession().code;
    const res = await call(code);
    expect(res.status).toBe(200);
  });

  test("404 with an error message for an unknown code", async () => {
    const res = await call("0001");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeTruthy();
  });

  test("400 for a malformed code", async () => {
    const res = await call("12ab");
    expect(res.status).toBe(400);
  });
});
