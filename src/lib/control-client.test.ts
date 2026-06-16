import { afterEach, describe, expect, test, vi } from "vitest";
import { sendControl } from "./control-client";

afterEach(() => vi.unstubAllGlobals());

describe("sendControl", () => {
  test("POSTs the command to the session with the admin token", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await sendControl("123456", "secret", { type: "setRhythm", rhythm: "pvt" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/123456/control",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
        body: JSON.stringify({ type: "setRhythm", rhythm: "pvt" }),
      }),
    );
  });

  test("rejects when the server refuses the command", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 403 }))));
    await expect(
      sendControl("123456", "wrong", { type: "spike" }),
    ).rejects.toThrow();
  });
});
