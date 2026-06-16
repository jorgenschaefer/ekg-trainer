import { store } from "@/lib/session-store";
import { isValidCode } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

// Existence check used by monitors before opening the EventSource — lets the UI
// tell "unknown/expired code" (404) apart from a transient disconnect.
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { code } = await ctx.params;

  if (!isValidCode(code)) {
    return Response.json({ error: "Ungültiger Code." }, { status: 400 });
  }
  if (!store.getSession(code)) {
    return Response.json(
      { error: "Code unbekannt oder Sitzung abgelaufen." },
      { status: 404 },
    );
  }
  return Response.json({ ok: true });
}
