import { describe, expect, test } from "vitest";
import { defiTransition } from "./defibrillator";

describe("defiTransition", () => {
  test("charge moves idle to charging without firing a spike", () => {
    expect(defiTransition("idle", "charge")).toEqual({
      status: "charging",
      fireSpike: false,
    });
  });

  test("charge is a no-op while charging or armed", () => {
    expect(defiTransition("charging", "charge").status).toBe("charging");
    expect(defiTransition("armed", "charge").status).toBe("armed");
  });

  test("chargeComplete moves charging to armed", () => {
    expect(defiTransition("charging", "chargeComplete")).toEqual({
      status: "armed",
      fireSpike: false,
    });
  });

  test("chargeComplete is a no-op from idle or armed", () => {
    expect(defiTransition("idle", "chargeComplete").status).toBe("idle");
    expect(defiTransition("armed", "chargeComplete").status).toBe("armed");
  });

  test("shock from armed returns to idle and fires the spike", () => {
    expect(defiTransition("armed", "shock")).toEqual({
      status: "idle",
      fireSpike: true,
    });
  });

  test("shock is impossible (no spike) from idle or charging", () => {
    expect(defiTransition("idle", "shock")).toEqual({
      status: "idle",
      fireSpike: false,
    });
    expect(defiTransition("charging", "shock")).toEqual({
      status: "charging",
      fireSpike: false,
    });
  });

  test("cancel disarms armed back to idle without a spike", () => {
    expect(defiTransition("armed", "cancel")).toEqual({
      status: "idle",
      fireSpike: false,
    });
  });

  test("cancel is a no-op while charging (charging runs through) or idle", () => {
    expect(defiTransition("charging", "cancel").status).toBe("charging");
    expect(defiTransition("idle", "cancel").status).toBe("idle");
  });
});
