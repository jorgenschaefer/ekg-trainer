import { describe, expect, test } from "vitest";
import { formatElapsed } from "./timer";

describe("formatElapsed", () => {
  test("shows zero as 00:00", () => {
    expect(formatElapsed(0)).toBe("00:00");
  });

  test("pads seconds and minutes to two digits", () => {
    expect(formatElapsed(5)).toBe("00:05");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(107)).toBe("01:47");
  });

  test("keeps counting minutes with no upper cap", () => {
    expect(formatElapsed(600)).toBe("10:00");
    expect(formatElapsed(3600)).toBe("60:00");
    expect(formatElapsed(6000)).toBe("100:00");
  });
});
