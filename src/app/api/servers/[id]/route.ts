import { db } from "@/db";
import { servers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, ApiError } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { getProvider } from "@/lib/minecraft/provider";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    return ok(server);
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { name, description, motd, maxPlayers, ramMb, cpuCores, storageMb } = body as Record<string, unknown>;

    const updates: Partial<typeof servers.$inferInsert> = {};
    if (typeof name === "string" && name.trim().length >= 3) updates.name = name.trim();
    if (typeof description === "string") updates.description = description.slice(0, 300);
    if (typeof motd === "string") updates.motd = motd.slice(0, 100);
    if (typeof maxPlayers === "number" && maxPlayers > 0 && maxPlayers <= 200) updates.maxPlayers = maxPlayers;
    if (typeof ramMb === "number" && ramMb >= 1024 && ramMb <= 16384) updates.ramMb = ramMb;
    if (typeof cpuCores === "number" && cpuCores >= 1 && cpuCores <= 8) updates.cpuCores = cpuCores;
    if (typeof storageMb === "number" && storageMb >= 2048 && storageMb <= 51200) updates.storageMb = storageMb;

    if (Object.keys(updates).length === 0) return fail(400, "No valid fields to update.");
    updates.updatedAt = new Date();

    await db.update(servers).set(updates).where(eq(servers.id, server.id));
    await logAudit({ userId: user.id, serverId: server.id, action: "SERVER_SETTINGS_UPDATED", metadata: updates });
    return ok({ success: true });
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { confirmation } = body as { confirmation?: string };
    if (confirmation !== "DELETE MY SERVER") {
      throw new ApiError(400, 'Type "DELETE MY SERVER" to confirm deletion.');
    }

    await db.update(servers).set({ state: "DELETING" }).where(eq(servers.id, server.id));
    await getProvider().destroy(server.id);
    await db.delete(servers).where(eq(servers.id, server.id));
    await logAudit({ userId: user.id, action: "SERVER_DELETED", metadata: { serverId: server.id, name: server.name } });
    return ok({ success: true });
  });
}
