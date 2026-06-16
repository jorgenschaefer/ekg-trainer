import { store } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Creates a new session and hands the creator its code (for monitors to join) and
// admin token (the secret that unlocks control).
export async function POST(): Promise<Response> {
  const session = store.createSession();
  return Response.json({ code: session.code, adminToken: session.adminToken });
}
