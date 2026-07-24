// Pure defibrillator state machine for the trainee monitor's local defi controls.
// idle → (charge) → charging → (chargeComplete) → armed → (shock|cancel) → idle.
// Invariants: charging always runs through to armed (no abort mid-charge); shock and
// cancel act only from armed; charging starts only from idle.
export type DefiStatus = "idle" | "charging" | "armed";
export type DefiAction = "charge" | "chargeComplete" | "shock" | "cancel";

export interface DefiResult {
  status: DefiStatus;
  // Whether this transition delivers a shock (drives the local spike artifact).
  fireSpike: boolean;
}

export function defiTransition(
  status: DefiStatus,
  action: DefiAction,
): DefiResult {
  if (status === "idle" && action === "charge") {
    return { status: "charging", fireSpike: false };
  }
  if (status === "charging" && action === "chargeComplete") {
    return { status: "armed", fireSpike: false };
  }
  if (status === "armed" && action === "shock") {
    return { status: "idle", fireSpike: true };
  }
  if (status === "armed" && action === "cancel") {
    return { status: "idle", fireSpike: false };
  }
  // Every other combination is a no-op: the status is unchanged and no spike fires.
  return { status, fireSpike: false };
}
