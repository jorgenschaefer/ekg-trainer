import { parseCommand } from "@/lib/commands";
import { store } from "@/lib/session-store";
import { isValidCode } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

// The single control route. The admin token (Authorization: Bearer <token>) bound to
// the session is mandatory — this is what enforces "code alone never controls".
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { code } = await ctx.params;
  if (!isValidCode(code)) {
    return Response.json({ error: "Ungültiger Code." }, { status: 400 });
  }

  const command = parseCommand(await readJson(req));
  if (!command) {
    return Response.json({ error: "Ungültiges Kommando." }, { status: 400 });
  }

  const token = bearerToken(req);
  const result = store.applyControl(code, token, command);
  switch (result) {
    case "not-found":
      return Response.json({ error: "Sitzung nicht gefunden." }, { status: 404 });
    case "forbidden":
      return Response.json({ error: "Keine Steuerungsberechtigung." }, { status: 403 });
    case "ok":
      return Response.json({ ok: true });
  }
}

function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "");
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
