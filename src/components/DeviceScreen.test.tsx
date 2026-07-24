import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { SessionState } from "@/lib/session-state";
import DeviceScreen from "./DeviceScreen";
import type { DeviceControls } from "./useDeviceControls";

// Stub the canvas renderer so we can assert which spikeNonce DeviceScreen forwards
// to it (the real sweep is covered in Waveforms.test.tsx).
vi.mock("./Waveforms", () => ({
  default: ({ spikeNonce }: { spikeNonce?: number }) => (
    <div data-testid="pleth-curve" data-spike-nonce={String(spikeNonce)} />
  ),
}));

afterEach(cleanup);

function state(overrides: Partial<SessionState> = {}): SessionState {
  return {
    rhythm: "sinus-normo",
    drueckt: false,
    modules: { ekg: true, pulsoxi: true },
    ...overrides,
  };
}

function controls(overrides: Partial<DeviceControls> = {}): DeviceControls {
  return {
    timer: { running: false, label: "00:00" },
    toggleTimer: vi.fn(),
    defi: { status: "idle", chargeRemaining: null },
    charge: vi.fn(),
    shock: vi.fn(),
    cancel: vi.fn(),
    spikeNonce: 0,
    ...overrides,
  };
}

function readout(label: string) {
  return screen.getByRole("group", { name: label });
}

describe("DeviceScreen", () => {
  test("shows the mode label", () => {
    render(<DeviceScreen state={state()} mode="MONITOR" />);
    expect(screen.getByText("MONITOR")).toBeInTheDocument();
  });

  test("sinus shows HF, SpO2 and peripheral pulse values", () => {
    render(<DeviceScreen state={state()} mode="MONITOR" />);
    expect(within(readout("HF")).getByText("70")).toBeInTheDocument();
    expect(within(readout("SpO2")).getByText("98")).toBeInTheDocument();
    expect(within(readout("Puls")).getByText("70")).toBeInTheDocument();
  });

  test("PEA shows HF but pulse and SpO2 are not measurable", () => {
    render(<DeviceScreen state={state({ rhythm: "pea" })} mode="MONITOR" />);
    expect(within(readout("HF")).getByText("50")).toBeInTheDocument();
    expect(within(readout("SpO2")).getByText("– –")).toBeInTheDocument();
    expect(within(readout("Puls")).getByText("– –")).toBeInTheDocument();
  });

  test("HF module off keeps the HF readout present, showing '– –'", () => {
    render(
      <DeviceScreen
        state={state({ modules: { ekg: false, pulsoxi: true } })}
        mode="MONITOR"
      />,
    );
    expect(within(readout("HF")).getByText("– –")).toBeInTheDocument();
  });

  test("pulsoxi off keeps SpO2 and pulse present, both showing '– –'", () => {
    render(
      <DeviceScreen
        state={state({ modules: { ekg: true, pulsoxi: false } })}
        mode="MONITOR"
      />,
    );
    expect(within(readout("SpO2")).getByText("– –")).toBeInTheDocument();
    expect(within(readout("Puls")).getByText("– –")).toBeInTheDocument();
  });

  test("the pleth lane is always present, with or without pulsoxi", () => {
    const { rerender } = render(
      <DeviceScreen state={state()} mode="MONITOR" />,
    );
    expect(screen.getByTestId("pleth-curve")).toBeInTheDocument();
    rerender(
      <DeviceScreen
        state={state({ modules: { ekg: true, pulsoxi: false } })}
        mode="MONITOR"
      />,
    );
    expect(screen.getByTestId("pleth-curve")).toBeInTheDocument();
  });

  test("shows a reconnect pill while reconnecting", () => {
    const { rerender } = render(
      <DeviceScreen state={state()} mode="MONITOR" />,
    );
    expect(screen.queryByText(/Verbinde neu/)).not.toBeInTheDocument();
    rerender(<DeviceScreen state={state()} mode="MONITOR" reconnecting />);
    expect(screen.getByText(/Verbinde neu/)).toBeInTheDocument();
  });

  describe("Vollbild toggle", () => {
    const fullscreen = (overrides = {}) => ({
      supported: true,
      active: false,
      toggle: vi.fn(),
      ...overrides,
    });

    test("is absent when no fullscreen capability is passed (e.g. admin mirror)", () => {
      render(<DeviceScreen state={state()} mode="MONITOR" />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    test("is absent when the device supports neither fullscreen nor wake lock", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          fullscreen={fullscreen({ supported: false })}
        />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    test("when inactive, offers to enter and is not pressed", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          fullscreen={fullscreen()}
        />,
      );
      const button = screen.getByRole("button", {
        name: "Vollbild aktivieren",
      });
      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    test("when active, offers to leave and is pressed", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          fullscreen={fullscreen({ active: true })}
        />,
      );
      const button = screen.getByRole("button", { name: "Vollbild verlassen" });
      expect(button).toHaveAttribute("aria-pressed", "true");
    });

    test("tapping it toggles the mode", () => {
      const toggle = vi.fn();
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          fullscreen={fullscreen({ toggle })}
        />,
      );
      screen.getByRole("button").click();
      expect(toggle).toHaveBeenCalledOnce();
    });
  });

  describe("timer", () => {
    function topbar() {
      // The topbar is the element holding the mode badge, clock and timer.
      return screen.getByText("MONITOR").parentElement as HTMLElement;
    }

    test("shows a Start button and 00:00 in the topbar when stopped", () => {
      render(
        <DeviceScreen state={state()} mode="MONITOR" controls={controls()} />,
      );
      const bar = topbar();
      expect(
        within(bar).getByRole("button", { name: "Start" }),
      ).toBeInTheDocument();
      expect(within(bar).getByText("00:00")).toBeInTheDocument();
    });

    test("shows a Stop button and the running time when running", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({ timer: { running: true, label: "01:47" } })}
        />,
      );
      const bar = topbar();
      expect(
        within(bar).getByRole("button", { name: "Stop" }),
      ).toBeInTheDocument();
      expect(within(bar).getByText("01:47")).toBeInTheDocument();
    });

    test("tapping Start/Stop calls toggleTimer", () => {
      const toggleTimer = vi.fn();
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({ toggleTimer })}
        />,
      );
      screen.getByRole("button", { name: "Start" }).click();
      expect(toggleTimer).toHaveBeenCalledOnce();
    });

    test("is absent without a controls prop (e.g. admin mirror)", () => {
      render(<DeviceScreen state={state()} mode="ADMIN" />);
      expect(
        screen.queryByRole("button", { name: /Start|Stop/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("defibrillator", () => {
    test("idle offers Laden and a disabled Schock", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({
            defi: { status: "idle", chargeRemaining: null },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "Laden" })).toBeEnabled();
      expect(screen.getByRole("button", { name: /Schock/ })).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Abbrechen" }),
      ).not.toBeInTheDocument();
    });

    test("charging shows the remaining seconds and keeps Schock disabled", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({
            defi: { status: "charging", chargeRemaining: 3 },
          })}
        />,
      );
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Schock/ })).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Laden" }),
      ).not.toBeInTheDocument();
    });

    test("armed enables Schock and offers Abbrechen", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({
            defi: { status: "armed", chargeRemaining: null },
          })}
        />,
      );
      expect(screen.getByRole("button", { name: /Schock/ })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Abbrechen" })).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: "Laden" }),
      ).not.toBeInTheDocument();
    });

    test("the therapy buttons call their handlers", () => {
      const charge = vi.fn();
      const shock = vi.fn();
      const cancel = vi.fn();
      const { rerender } = render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({ charge })}
        />,
      );
      screen.getByRole("button", { name: "Laden" }).click();
      expect(charge).toHaveBeenCalledOnce();
      rerender(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({
            defi: { status: "armed", chargeRemaining: null },
            shock,
            cancel,
          })}
        />,
      );
      screen.getByRole("button", { name: /Schock/ }).click();
      expect(shock).toHaveBeenCalledOnce();
      screen.getByRole("button", { name: "Abbrechen" }).click();
      expect(cancel).toHaveBeenCalledOnce();
    });

    test("forwards the controls spikeNonce to the waveform renderer", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls({ spikeNonce: 7 })}
        />,
      );
      expect(screen.getByTestId("pleth-curve")).toHaveAttribute(
        "data-spike-nonce",
        "7",
      );
    });

    test("is absent without a controls prop (admin mirror)", () => {
      render(<DeviceScreen state={state()} mode="ADMIN" />);
      expect(
        screen.queryByRole("button", { name: "Laden" }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("pleth-curve")).toHaveAttribute(
        "data-spike-nonce",
        "undefined",
      );
    });

    test("timer and therapy stay available alongside the Vollbild toggle", () => {
      render(
        <DeviceScreen
          state={state()}
          mode="MONITOR"
          controls={controls()}
          fullscreen={{ supported: true, active: true, toggle: vi.fn() }}
        />,
      );
      expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Laden" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Vollbild/ }),
      ).toBeInTheDocument();
    });
  });
});
