import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import type { SessionStream } from "./useSessionStream";
import type { Vollbildmodus } from "./useVollbildmodus";
import { INITIAL_STATE } from "@/lib/session-state";

let stream: SessionStream;
vi.mock("./useSessionStream", () => ({
  useSessionStream: () => stream,
}));

let fullscreen: Vollbildmodus;
vi.mock("./useVollbildmodus", () => ({
  useVollbildmodus: () => fullscreen,
}));

import MonitorView from "./MonitorView";

afterEach(cleanup);

beforeEach(() => {
  fullscreen = {
    supported: false,
    active: false,
    toggle: vi.fn(),
    ref: createRef<HTMLElement>(),
  };
});

describe("MonitorView", () => {
  test("renders the device screen with the synced values", () => {
    stream = { state: INITIAL_STATE, status: "open", spikeNonce: 0 };
    render(<MonitorView code="123456" />);
    expect(screen.getByText("MONITOR")).toBeInTheDocument();
    const hf = screen.getByRole("group", { name: "HF" });
    expect(within(hf).getByText("70")).toBeInTheDocument();
  });

  test("shows the reconnect pill while reconnecting but keeps the screen", () => {
    stream = { state: INITIAL_STATE, status: "reconnecting", spikeNonce: 0 };
    render(<MonitorView code="123456" />);
    expect(screen.getByText("MONITOR")).toBeInTheDocument();
    expect(screen.getByText(/Verbinde neu/)).toBeInTheDocument();
  });

  test("shows the terminal screen when the session has ended", () => {
    stream = { state: INITIAL_STATE, status: "ended", spikeNonce: 0 };
    render(<MonitorView code="123456" />);
    expect(screen.getByText(/Sitzung nicht mehr aktiv/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zur Startseite/ })).toHaveAttribute("href", "/");
    expect(screen.queryByText("MONITOR")).not.toBeInTheDocument();
  });

  test("offers the Vollbild toggle when the device supports it", () => {
    stream = { state: INITIAL_STATE, status: "open", spikeNonce: 0 };
    fullscreen = { ...fullscreen, supported: true };
    render(<MonitorView code="123456" />);
    expect(screen.getByRole("button", { name: "Vollbild aktivieren" })).toBeInTheDocument();
  });

  test("hides the Vollbild toggle when the device supports neither capability", () => {
    stream = { state: INITIAL_STATE, status: "open", spikeNonce: 0 };
    render(<MonitorView code="123456" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("attaches the fullscreen target ref to its container", () => {
    stream = { state: INITIAL_STATE, status: "open", spikeNonce: 0 };
    fullscreen = { ...fullscreen, supported: true };
    render(<MonitorView code="123456" />);
    expect(fullscreen.ref.current).toBeInstanceOf(HTMLElement);
  });
});
