import { monitorReadout } from "@/lib/readout";
import type { SessionState } from "@/lib/session-state";
import Clock from "./Clock";
import styles from "./DeviceScreen.module.css";
import type { Vollbildmodus } from "./useVollbildmodus";
import Waveforms from "./Waveforms";

// The slice of the Vollbildmodus the topbar toggle needs — the ref stays with the hook.
type FullscreenControl = Pick<Vollbildmodus, "supported" | "active" | "toggle">;

// The shared device screen — what monitors show and what the admin mirror reflects.
// Both render from the same synced state via the same path, so the mirror can never
// show more than the monitors.
export default function DeviceScreen({
  state,
  mode,
  reconnecting,
  spikeNonce,
  fullscreen,
}: {
  state: SessionState;
  mode: "MONITOR" | "ADMIN";
  reconnecting?: boolean;
  spikeNonce?: number;
  fullscreen?: FullscreenControl;
}) {
  const readout = monitorReadout(state);

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <span className={styles.mode}>{mode}</span>
        <span className={styles.lead}>II</span>
        <Clock />
        {fullscreen?.supported && <FullscreenToggle fullscreen={fullscreen} />}
      </div>

      <div className={styles.body}>
        <div className={styles.waves}>
          <Waveforms state={state} spikeNonce={spikeNonce} />
        </div>

        <div className={styles.numbers}>
          <Readout
            label="HF"
            unit="/min"
            className={styles.hf}
            value={readout.hf}
          />
          <Readout
            label="SpO2"
            unit="%"
            className={styles.spo2}
            value={readout.spo2}
          />
          <Readout
            label="Puls"
            unit="/min"
            className={styles.pulse}
            value={readout.pulse}
          />
        </div>
      </div>

      {reconnecting && (
        <div className={styles.pill} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          Verbinde neu…
        </div>
      )}
    </div>
  );
}

// The monitor's way in and out of Vollbildmodus. Loud dark CTA when inactive (echoes
// the MONITOR badge — "tap me"), quiet when active (just a calm way back). Icon flips
// from outward corner arrows (expand) to inward ones (collapse). aria-pressed and the
// label both track the real active state.
function FullscreenToggle({ fullscreen }: { fullscreen: FullscreenControl }) {
  const { active, toggle } = fullscreen;
  return (
    <button
      type="button"
      className={`${styles.fullscreen} ${active ? styles.fullscreenActive : ""}`}
      aria-pressed={active}
      aria-label={active ? "Vollbild verlassen" : "Vollbild aktivieren"}
      onClick={toggle}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        {active ? (
          <path d="M9 3v6H3M21 9h-6V3M3 15h6v6M15 21v-6h6" />
        ) : (
          <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
        )}
      </svg>
    </button>
  );
}

// Always rendered — a switched-off module shows "– –" rather than disappearing, so
// the readouts keep their fixed positions and the layout never jumps.
function Readout({
  label,
  unit,
  value,
  className,
}: {
  label: string;
  unit: string;
  value: string;
  className: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a readout is a labeled group, not a form fieldset
    <div
      className={`${styles.readout} ${className}`}
      role="group"
      aria-label={label}
    >
      <span className={styles.readoutLabel}>
        {label === "SpO2" ? "SpO₂" : label}
      </span>
      <span className={styles.readoutValue}>{value}</span>
      <span className={styles.readoutUnit}>{unit}</span>
    </div>
  );
}
