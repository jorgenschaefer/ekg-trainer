"use client";

import DeviceScreen from "./DeviceScreen";
import EndedScreen from "./EndedScreen";
import styles from "./MonitorView.module.css";
import { useDeviceControls } from "./useDeviceControls";
import { useSessionStream } from "./useSessionStream";
import { useVollbildmodus } from "./useVollbildmodus";

// A monitor: joins by code, shows the device screen, and rides out brief
// disconnects on the last synced state. Only a definitive end shows the terminal
// screen — a transient drop never does (that would read as asystole).
export default function MonitorView({ code }: { code: string }) {
  const { state, status } = useSessionStream(code);
  const fullscreen = useVollbildmodus();
  const controls = useDeviceControls();

  if (status === "ended") return <EndedScreen />;

  return (
    <main ref={fullscreen.ref} className={styles.frame}>
      <div className={styles.device}>
        {state ? (
          <DeviceScreen
            state={state}
            mode="MONITOR"
            reconnecting={status === "reconnecting"}
            fullscreen={fullscreen}
            controls={controls}
          />
        ) : (
          <p className={styles.connecting}>Verbinde…</p>
        )}
      </div>
    </main>
  );
}
