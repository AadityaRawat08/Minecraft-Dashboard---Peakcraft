import "server-only";
import { db } from "@/db";
import { consoleLines } from "@/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { getProvider } from "@/lib/minecraft/provider";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const afterId = Number(searchParams.get("afterId") || 0);
    const download = searchParams.get("download");
    const lines = await db.select().from(consoleLines)
      .where(and(eq(consoleLines.serverId, id), gt(consoleLines.id, afterId)))
      .orderBy(asc(consoleLines.id)).limit(200);
    if (download) {
      const content = lines.map((l) => `[${l.createdAt.toISOString()}] [${l.stream}] ${l.line}`).join("\n");
      return new Response(content, { headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="server-${id}.log"` } });
    }
    return ok({ lines, cursor: lines.length > 0 ? lines[lines.length - 1].id : afterId });
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    if (server.state !== "RUNNING") return fail(400, "Server is not running.");
    const body = await req.json().catch(() => ({}));
    const { command } = body as { command?: string };
    if (!command) return fail(400, "Missing command.");
    const provider = getProvider();
    await provider.sendCommand(id, command);
    return ok({ success: true });
  });
}
