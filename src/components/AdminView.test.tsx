import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SessionState } from "@/lib/session-state";
import type { SessionStream } from "./useSessionStream";

let stream: SessionStream;
vi.mock("./useSessionStream", () => ({ useSessionStream: () => stream }));

import AdminView from "./AdminView";

function state(overrides: Partial<SessionState> = {}): SessionState {
  return {
    rhythm: "sinus-normo",
    drueckt: false,
    modules: { ekg: true, pulsoxi: true },
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function lastBody() {
  const call = fetchMock.mock.calls.at(-1)!;
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe("AdminView", () => {
  test("shows the admin mirror and the code chip", () => {
    stream = { state: state(), status: "open" };
    render(<AdminView code="123456" token="t" />);
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("123456")).toBeInTheDocument();
  });

  test("marks the synced rhythm as the active (pressed) button", () => {
    stream = { state: state({ rhythm: "pvt" }), status: "open" };
    render(<AdminView code="123456" token="t" />);
    expect(
      screen.getByRole("button", { name: "pulslose VT", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sinus normo", pressed: false }),
    ).toBeInTheDocument();
  });

  test("choosing a rhythm posts setRhythm but does not optimistically change the selection", async () => {
    stream = {
      state: state({ rhythm: "sinus-normo" }),
      status: "open",
    };
    render(<AdminView code="123456" token="t" />);
    await userEvent.click(screen.getByRole("button", { name: "pulslose VT" }));
    expect(lastBody()).toEqual({ type: "setRhythm", rhythm: "pvt" });
    // Selection still reflects the (unchanged) synced state — the mirror is the echo.
    expect(
      screen.getByRole("button", { name: "Sinus normo", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "pulslose VT", pressed: false }),
    ).toBeInTheDocument();
  });

  test("the Drückt switch reflects state and toggles it", async () => {
    stream = {
      state: state({ drueckt: false }),
      status: "open",
    };
    render(<AdminView code="123456" token="t" />);
    const sw = screen.getByRole("switch", { name: /Drückt/ });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(lastBody()).toEqual({ type: "setDrueckt", drueckt: true });
  });

  test("module switches reflect state and post setModule", async () => {
    stream = {
      state: state({ modules: { ekg: true, pulsoxi: true } }),
      status: "open",
    };
    render(<AdminView code="123456" token="t" />);
    const pulsoxi = screen.getByRole("switch", {
      name: /Pulsoxi angeschlossen/,
    });
    expect(pulsoxi).toHaveAttribute("aria-checked", "true");
    await userEvent.click(pulsoxi);
    expect(lastBody()).toEqual({
      type: "setModule",
      module: "pulsoxi",
      on: false,
    });
  });

  test("the EKG module switch is labeled 'Patches/EKG angeschlossen' and toggles the ekg module", async () => {
    stream = {
      state: state({ modules: { ekg: true, pulsoxi: true } }),
      status: "open",
    };
    render(<AdminView code="123456" token="t" />);
    const ekg = screen.getByRole("switch", {
      name: /Patches\/EKG angeschlossen/,
    });
    expect(ekg).toHaveAttribute("aria-checked", "true");
    await userEvent.click(ekg);
    expect(lastBody()).toEqual({ type: "setModule", module: "ekg", on: false });
  });

  test("surfaces an error when a command is refused", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 403 })),
    );
    stream = { state: state(), status: "open" };
    render(<AdminView code="123456" token="t" />);
    await userEvent.click(screen.getByRole("button", { name: "pulslose VT" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /fehlgeschlagen/i,
    );
  });

  test("the admin mirror never offers the Vollbild toggle", () => {
    stream = { state: state(), status: "open" };
    render(<AdminView code="123456" token="t" />);
    expect(
      screen.queryByRole("button", { name: /Vollbild/ }),
    ).not.toBeInTheDocument();
  });

  test("the admin mirror shows no local device controls (timer/defi)", () => {
    stream = { state: state(), status: "open" };
    render(<AdminView code="123456" token="t" />);
    expect(
      screen.queryByRole("button", { name: /Start|Stop/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Laden" }),
    ).not.toBeInTheDocument();
  });

  test("no longer offers the Schock-Spike button (defibrillation moved to the device)", () => {
    stream = { state: state(), status: "open" };
    render(<AdminView code="123456" token="t" />);
    expect(
      screen.queryByRole("button", { name: /Schock/ }),
    ).not.toBeInTheDocument();
  });

  test("the mirror shows '– –' for a switched-off module, same as the monitors", () => {
    stream = {
      state: state({ modules: { ekg: true, pulsoxi: false } }),
      status: "open",
    };
    render(<AdminView code="123456" token="t" />);
    const spo2 = screen.getByRole("group", { name: "SpO2" });
    expect(within(spo2).getByText("– –")).toBeInTheDocument();
  });
});
