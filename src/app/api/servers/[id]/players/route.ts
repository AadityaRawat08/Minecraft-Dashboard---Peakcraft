import "server-only";
import { db } from "@/db";
import { serverPlayers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { ensurePlayer } from "@/lib/minecraft/commands";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const players = await db.select().from(serverPlayers).where(eq(serverPlayers.serverId, id));
    return ok(players);
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { action, username } = body as { action?: string; username?: string };
    if (!action || !username) return fail(400, "Missing action or username.");
    const player = await ensurePlayer(id, username);
    if (action === "WHITELIST") await db.update(serverPlayers).set({ whitelisted: true }).where(eq(serverPlayers.id, player.id));
    else if (action === "UNWHITELIST") await db.update(serverPlayers).set({ whitelisted: false }).where(eq(serverPlayers.id, player.id));
    else if (action === "OP") await db.update(serverPlayers).set({ opped: true }).where(eq(serverPlayers.id, player.id));
    else if (action === "DEOP") await db.update(serverPlayers).set({ opped: false }).where(eq(serverPlayers.id, player.id));
    else if (action === "KICK") await db.update(serverPlayers).set({ online: false }).where(eq(serverPlayers.id, player.id));
    else if (action === "BAN") await db.update(serverPlayers).set({ banned: true, online: false }).where(eq(serverPlayers.id, player.id));
    else if (action === "UNBAN") await db.update(serverPlayers).set({ banned: false }).where(eq(serverPlayers.id, player.id));
    else return fail(400, "Unknown action.");
    await logAudit({ userId: user.id, serverId: id, action: "PLAYER_" + action, metadata: { username } });
    return ok({ success: true });
  });
}
