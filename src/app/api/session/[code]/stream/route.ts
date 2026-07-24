import { store } from "@/lib/session-store";
import { formatSse, SSE_KEEPALIVE } from "@/lib/sse";
import { isValidCode } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

const KEEPALIVE_MS = 20_000;

// SSE stream for monitors and admins alike. First write is a full snapshot; every
// later change is another full snapshot, plus the terminal ended event. An active
// connection keeps the session alive (touch on connect and on each heartbeat).
export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { code } = await ctx.params;
  if (!isValidCode(code)) {
    return Response.json({ error: "Ungültiger Code." }, { status: 400 });
  }
  const session = store.getSession(code);
  if (!session) {
    return Response.json({ error: "Sitzung nicht gefunden." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepalive: ReturnType<typeof setInterval>;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      store.touch(code);
      send(formatSse({ type: "state", state: session.state }));

      unsubscribe = store.subscribe(code, (event) => {
        send(formatSse(event));
        if (event.type === "ended") close();
      });

      keepalive = setInterval(() => {
        store.touch(code);
        send(SSE_KEEPALIVE);
      }, KEEPALIVE_MS);

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      unsubscribe();
      clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
