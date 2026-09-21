import "server-only";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { db } from "@/db";
import { serverBackups, servers, consoleLines } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { serverDataDir, BACKUP_ROOT } from "@/lib/minecraft/mock-provider";

export function backupDir(serverId: string): string {
  return path.join(BACKUP_ROOT, serverId);
}

export async function createBackup(serverId: string, name: string) {
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server) throw new Error("Server not found");

  const dir = backupDir(serverId);
  fs.mkdirSync(dir, { recursive: true });
  const backupId = crypto.randomUUID();
  const filePath = path.join(dir, `${backupId}.zip`);

  const [row] = await db
    .insert(serverBackups)
    .values({ id: backupId, serverId, name, status: "PENDING", mcVersion: server.mcVersion, filePath, sizeBytes: "0" })
    .returning();

  try {
    const zip = new AdmZip();
    const dataDir = serverDataDir(serverId);
    if (fs.existsSync(dataDir)) zip.addLocalFolder(dataDir);
    zip.writeZip(filePath);
    const { size } = fs.statSync(filePath);
    await db.update(serverBackups).set({ status: "COMPLETED", sizeBytes: String(size) }).where(eq(serverBackups.id, backupId));
    await db.insert(consoleLines).values({ serverId, line: `Backup "${name}" completed (${(size / (1024 * 1024)).toFixed(1)} MB).`, stream: "SYSTEM" });
  } catch (err) {
    await db.update(serverBackups).set({ status: "FAILED" }).where(eq(serverBackups.id, backupId));
    throw err;
  }

  return row;
}

export async function restoreBackup(serverId: string, backupId: string) {
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server) throw new Error("Server not found");
  if (server.state !== "STOPPED" && server.state !== "ERROR") {
    throw new Error("Stop the server before restoring a backup.");
  }
  const [backup] = await db.select().from(serverBackups).where(eq(serverBackups.id, backupId)).limit(1);
  if (!backup || backup.serverId !== serverId) throw new Error("Backup not found");
  if (!fs.existsSync(backup.filePath)) throw new Error("Backup archive is missing on disk.");

  const dataDir = serverDataDir(serverId);
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const zip = new AdmZip(backup.filePath);
  zip.extractAllTo(dataDir, true);

  await db.insert(consoleLines).values({ serverId, line: `Restored backup "${backup.name}" from ${new Date(backup.createdAt).toLocaleString()}.`, stream: "SYSTEM" });
}

export async function pruneOldBackups(serverId: string, retention: number) {
  const rows = await db.select().from(serverBackups).where(eq(serverBackups.serverId, serverId)).orderBy(asc(serverBackups.createdAt));
  const excess = rows.length - retention;
  if (excess <= 0) return;
  const toRemove = rows.slice(0, excess);
  for (const backup of toRemove) {
    fs.rmSync(backup.filePath, { force: true });
    await db.delete(serverBackups).where(eq(serverBackups.id, backup.id));
  }
}
