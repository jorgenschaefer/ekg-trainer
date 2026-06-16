import { describe, expect, test } from "vitest";
import { resolveAdminToken } from "./admin-token";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

describe("resolveAdminToken", () => {
  test("takes the token from the URL fragment and caches it for this device", () => {
    const storage = fakeStorage();
    const token = resolveAdminToken("123456", "#secret", storage);
    expect(token).toBe("secret");
    expect(storage.map.get("admin:123456")).toBe("secret");
  });

  test("falls back to the cached token when there is no fragment", () => {
    const storage = fakeStorage({ "admin:123456": "cached" });
    expect(resolveAdminToken("123456", "", storage)).toBe("cached");
  });

  test("returns null when neither a fragment nor a cached token exists", () => {
    expect(resolveAdminToken("123456", "", fakeStorage())).toBeNull();
  });
});
