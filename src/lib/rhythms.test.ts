import { describe, expect, test } from "vitest";
import { isRhythmId, RHYTHM_IDS, RHYTHMS } from "./rhythms";

describe("rhythm catalog", () => {
  test("sinus normo: rate 70, produces output", () => {
    const r = RHYTHMS["sinus-normo"];
    expect(r.hf).toBe(70);
    expect(r.generatesOutput).toBe(true);
  });
});

describe("isRhythmId", () => {
  test("accepts catalogued ids and rejects unknown ones", () => {
    expect(isRhythmId("sinus-normo")).toBe(true);
    expect(isRhythmId("not-a-rhythm")).toBe(false);
    expect(RHYTHM_IDS).toContain("sinus-normo");
  });
});
