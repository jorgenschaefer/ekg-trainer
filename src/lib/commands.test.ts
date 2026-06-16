import { describe, expect, test } from "vitest";
import { parseCommand } from "./commands";

describe("parseCommand", () => {
  test("setRhythm with a catalogued rhythm", () => {
    expect(parseCommand({ type: "setRhythm", rhythm: "pvt" })).toEqual({
      type: "setRhythm",
      rhythm: "pvt",
    });
  });

  test("rejects setRhythm with an unknown rhythm", () => {
    expect(parseCommand({ type: "setRhythm", rhythm: "nope" })).toBeNull();
  });

  test("setDrueckt requires a boolean", () => {
    expect(parseCommand({ type: "setDrueckt", drueckt: true })).toEqual({
      type: "setDrueckt",
      drueckt: true,
    });
    expect(parseCommand({ type: "setDrueckt", drueckt: "yes" })).toBeNull();
  });

  test("setModule only accepts whitelisted module keys", () => {
    expect(parseCommand({ type: "setModule", module: "ekg", on: false })).toEqual({
      type: "setModule",
      module: "ekg",
      on: false,
    });
    expect(parseCommand({ type: "setModule", module: "pulsoxi", on: true })).toEqual({
      type: "setModule",
      module: "pulsoxi",
      on: true,
    });
    expect(parseCommand({ type: "setModule", module: "etco2", on: true })).toBeNull();
  });

  test("spike carries no payload", () => {
    expect(parseCommand({ type: "spike" })).toEqual({ type: "spike" });
  });

  test("rejects unknown command types and non-objects", () => {
    expect(parseCommand({ type: "explode" })).toBeNull();
    expect(parseCommand(null)).toBeNull();
    expect(parseCommand("setDrueckt")).toBeNull();
  });
});
