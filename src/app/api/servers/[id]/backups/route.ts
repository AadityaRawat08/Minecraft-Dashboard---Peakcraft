import fs from "fs";
import { db } from "@/db";
import { serverBackups } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUser, ApiError } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { createBackup, restoreBackup } from "@/lib/minecraft/backup";
import { logAudit, notify } from "@/lib/server/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const rows = await db.select().from(serverBackups).where(eq(serverBackups.serverId, id)).orderBy(desc(serverBackups.createdAt));
    return ok(rows);
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const op = searchParams.get("op");
    const body = await req.json().catch(() => ({}));

    if (op === "restore") {
      const { backupId } = body as { backupId?: string };
      if (!backupId) return fail(400, "Missing backupId.");
      try {
        await restoreBackup(id, backupId);
      } catch (err) {
        throw new ApiError(409, err instanceof Error ? err.message : "Restore failed.");
      }
      await logAudit({ userId: user.id, serverId: id, action: "BACKUP_RESTORED", metadata: { backupId } });
      await notify(user.id, "backup.restored", "Backup restored", `A backup was restored on "${server.name}".`);
      return ok({ success: true });
    }

    const { name } = body as { name?: string };
    const backupName = (name && name.trim()) || `Manual backup ${new Date().toLocaleString()}`;
    const backup = await createBackup(id, backupName);
    await logAudit({ userId: user.id, serverId: id, action: "BACKUP_CREATED", metadata: { name: backupName } });
    await notify(user.id, "backup.completed", "Backup completed", `Backup "${backupName}" for "${server.name}" completed.`);
    return ok(backup, 201);
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const backupId = searchParams.get("id");
    const download = searchParams.get("download");
    void download;
    if (!backupId) return fail(400, "Missing backup id.");

    const [backup] = await db.select().from(serverBackups).where(and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, id))).limit(1);
    if (!backup) throw new ApiError(404, "Backup not found.");

    fs.rmSync(backup.filePath, { force: true });
    await db.delete(serverBackups).where(eq(serverBackups.id, backupId));
    await logAudit({ userId: user.id, serverId: id, action: "BACKUP_DELETED", metadata: { name: backup.name } });
    return ok({ success: true });
  });
}
