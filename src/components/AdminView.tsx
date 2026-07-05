"use client";

import { useState } from "react";
import type { Command } from "@/lib/commands";
import { sendControl } from "@/lib/control-client";
import { RHYTHMS, type RhythmId } from "@/lib/rhythms";
import type { SessionState } from "@/lib/session-state";
import styles from "./AdminView.module.css";
import DeviceScreen from "./DeviceScreen";
import EndedScreen from "./EndedScreen";
import { useSessionStream } from "./useSessionStream";

const FAMILIES: { title: string; ids: RhythmId[]; columns?: number }[] = [
  {
    title: "Sinus",
    ids: ["sinus-normo", "sinus-brady", "sinus-tachy"],
    columns: 3,
  },
  { title: "Kammerflimmern", ids: ["vf-fein", "vf-grob"], columns: 2 },
  { title: "Weitere", ids: ["pvt", "pea", "asystolie"], columns: 1 },
];

// The instructor's device. It never renders optimistically: actions POST to the
// server, the server echoes the new state, and the mirror (and the active-rhythm
// highlight) render from that echo — the same path the monitors take, so the
// mirror can never show something no monitor received.
export default function AdminView({
  code,
  token,
}: {
  code: string;
  token: string;
}) {
  const { state, status, spikeNonce } = useSessionStream(code);
  const [error, setError] = useState("");

  const send = (command: Command) => {
    setError("");
    sendControl(code, token, command).catch(() =>
      setError(
        "Steuerung fehlgeschlagen – nicht alle Monitore sind aktualisiert.",
      ),
    );
  };

  if (status === "ended") return <EndedScreen />;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.title}>EKG-Rhythmus-Trainer</span>
        <span className={styles.adminBadge}>Admin</span>
        <span className={styles.codeChip}>
          <span className={styles.srOnly}>Sitzungscode: </span>
          {code}
        </span>
      </header>

      <div className={styles.layout}>
        <section className={styles.mirror}>
          {state ? (
            <DeviceScreen
              state={state}
              mode="ADMIN"
              reconnecting={status === "reconnecting"}
              spikeNonce={spikeNonce}
            />
          ) : (
            <p className={styles.connecting}>Verbinde…</p>
          )}
        </section>

        {state && (
          <section className={styles.controls}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Controls state={state} send={send} />
          </section>
        )}
      </div>
    </main>
  );
}

function Controls({
  state,
  send,
}: {
  state: SessionState;
  send: (c: Command) => void;
}) {
  return (
    <>
      <fieldset className={styles.block}>
        <legend className={styles.blockTitle}>Rhythmus</legend>
        {FAMILIES.map((family) => (
          <div key={family.title} className={styles.family}>
            <span className={styles.familyTitle}>{family.title}</span>
            <div
              className={styles.rhythmGrid}
              style={{
                gridTemplateColumns: `repeat(${family.columns ?? 1}, 1fr)`,
              }}
            >
              {family.ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.rhythmButton}
                  aria-pressed={state.rhythm === id}
                  onClick={() => send({ type: "setRhythm", rhythm: id })}
                >
                  {RHYTHMS[id].label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className={styles.block}>
        <legend className={styles.blockTitle}>Reanimation</legend>
        <button
          type="button"
          role="switch"
          aria-checked={state.drueckt}
          className={`${styles.drueckt} ${state.drueckt ? styles.druecktOn : ""}`}
          onClick={() => send({ type: "setDrueckt", drueckt: !state.drueckt })}
        >
          {state.drueckt && (
            <span className={styles.runningDot} aria-hidden="true" />
          )}
          Drückt{state.drueckt ? " · läuft" : ""}
        </button>

        <button
          type="button"
          className={styles.spike}
          onClick={() => send({ type: "spike" })}
        >
          Schock-Spike
          <span className={styles.spikeHint}>
            einmaliger Defi-Ausschlag · ändert den Rhythmus nicht
          </span>
        </button>
      </fieldset>

      <fieldset className={styles.block}>
        <legend className={styles.blockTitle}>Module</legend>
        <ModuleSwitch
          label="Patches/EKG angeschlossen"
          swatch="ekg"
          on={state.modules.ekg}
          onToggle={() =>
            send({ type: "setModule", module: "ekg", on: !state.modules.ekg })
          }
        />
        <ModuleSwitch
          label="Pulsoxi angeschlossen"
          swatch="pulsoxi"
          on={state.modules.pulsoxi}
          onToggle={() =>
            send({
              type: "setModule",
              module: "pulsoxi",
              on: !state.modules.pulsoxi,
            })
          }
        />
      </fieldset>
    </>
  );
}

function ModuleSwitch({
  label,
  swatch,
  on,
  onToggle,
}: {
  label: string;
  swatch: "ekg" | "pulsoxi";
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={styles.module}
      onClick={onToggle}
    >
      <span
        className={`${styles.swatch} ${styles[swatch]}`}
        aria-hidden="true"
      />
      <span className={styles.moduleLabel}>{label}</span>
      <span
        className={`${styles.track} ${on ? styles.trackOn : ""}`}
        aria-hidden="true"
      >
        <span className={styles.knob} />
      </span>
    </button>
  );
}
