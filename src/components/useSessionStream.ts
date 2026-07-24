"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@/lib/session-state";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "ended";

export interface SessionStream {
  state: SessionState | null;
  status: ConnStatus;
}

// Native EventSource auto-reconnects, so a brief blip only flashes the pill after a
// short debounce — the curve keeps running on the last synced state meanwhile.
const RECONNECT_DEBOUNCE_MS = 1000;

// Subscribes to a session's SSE stream and exposes the synced state plus a connection
// status the UI turns into the reconnect pill / terminal screen.
export function useSessionStream(code: string): SessionStream {
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");

  useEffect(() => {
    const es = new EventSource(`/api/session/${code}/stream`);
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ended = false;

    const clearReconnect = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    es.onopen = () => {
      clearReconnect();
      if (!ended) setStatus("open");
    };
    es.addEventListener("state", (e) =>
      setState(JSON.parse((e as MessageEvent).data) as SessionState),
    );
    es.addEventListener("ended", () => {
      ended = true;
      clearReconnect();
      setStatus("ended");
      es.close();
    });
    es.onerror = () => {
      if (ended || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        setStatus("reconnecting");
      }, RECONNECT_DEBOUNCE_MS);
    };

    return () => {
      clearReconnect();
      es.close();
    };
  }, [code]);

  return { state, status };
}
