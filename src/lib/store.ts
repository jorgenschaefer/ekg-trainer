import type { Command } from "./commands";
import { INITIAL_STATE, type SessionState } from "./session-state";

// What a subscribed client (monitor or admin) receives over its stream.
export type SessionEvent =
  | { type: "state"; state: SessionState }
  | { type: "ended" };

export type Subscriber = (event: SessionEvent) => void;

export type ControlResult = "ok" | "forbidden" | "not-found";

export interface Session {
  code: string;
  adminToken: string;
  state: SessionState;
  lastActivity: number;
  subscribers: Set<Subscriber>;
}

export interface StoreDeps {
  now: () => number;
  randomCode: () => string;
  randomToken: () => string;
}

export interface SessionStore {
  createSession(): Session;
  getSession(code: string): Session | undefined;
  subscribe(code: string, subscriber: Subscriber): () => void;
  applyControl(code: string, token: string, command: Command): ControlResult;
  touch(code: string): void;
  sweep(): void;
}

// A session expires after an hour with no connected client and no control action.
export const MAX_IDLE_MS = 60 * 60 * 1000;

export function createStore(deps: StoreDeps): SessionStore {
  const sessions = new Map<string, Session>();

  function uniqueCode(): string {
    let code = deps.randomCode();
    while (sessions.has(code)) code = deps.randomCode();
    return code;
  }

  function broadcast(session: Session, event: SessionEvent): void {
    for (const subscriber of session.subscribers) subscriber(event);
  }

  return {
    createSession() {
      const session: Session = {
        code: uniqueCode(),
        adminToken: deps.randomToken(),
        state: structuredClone(INITIAL_STATE),
        lastActivity: deps.now(),
        subscribers: new Set(),
      };
      sessions.set(session.code, session);
      return session;
    },
    getSession(code) {
      return sessions.get(code);
    },
    touch(code) {
      const session = sessions.get(code);
      if (session) session.lastActivity = deps.now();
    },
    sweep() {
      const cutoff = deps.now() - MAX_IDLE_MS;
      for (const session of sessions.values()) {
        if (session.lastActivity < cutoff) {
          broadcast(session, { type: "ended" });
          sessions.delete(session.code);
        }
      }
    },
    subscribe(code, subscriber) {
      const session = sessions.get(code);
      if (!session) return () => {};
      session.subscribers.add(subscriber);
      return () => session.subscribers.delete(subscriber);
    },
    applyControl(code, token, command) {
      const session = sessions.get(code);
      if (!session) return "not-found";
      if (token !== session.adminToken) return "forbidden";

      switch (command.type) {
        case "setRhythm":
          session.state.rhythm = command.rhythm;
          break;
        case "setDrueckt":
          session.state.drueckt = command.drueckt;
          break;
        case "setModule":
          session.state.modules[command.module] = command.on;
          break;
      }

      session.lastActivity = deps.now();
      // Every command broadcasts a full state snapshot — the contract object is
      // tiny, so there are no deltas.
      broadcast(session, { type: "state", state: session.state });
      return "ok";
    },
  };
}
