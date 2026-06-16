import type { SessionEvent } from "./store";

// SSE keep-alive comment, sent periodically so proxies/browsers don't time the
// idle connection out.
export const SSE_KEEPALIVE = ": ping\n\n";

// Serializes a session event to the SSE wire format. EventSource only dispatches an
// event when its data buffer is non-empty, so payload-less events still send "{}".
export function formatSse(event: SessionEvent): string {
  const data = event.type === "state" ? JSON.stringify(event.state) : "{}";
  return `event: ${event.type}\ndata: ${data}\n\n`;
}
