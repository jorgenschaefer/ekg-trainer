import type { Command } from "./commands";

// Sends one control command. The admin token (bound to the session server-side)
// goes in the Authorization header — without it the server answers 403.
export async function sendControl(
  code: string,
  token: string,
  command: Command,
): Promise<void> {
  const res = await fetch(`/api/session/${code}/control`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  // The admin UI renders from the echoed state, not optimistically — so a dropped
  // command must surface, otherwise the operator sees no change and no reason why.
  if (!res.ok) throw new Error(`Steuerung fehlgeschlagen (${res.status})`);
}
