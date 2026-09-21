import fs from "fs";
import { db } from "@/db";
import { serverBackups } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser, ApiError } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { handleApi } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const backupId = searchParams.get("id");
    if (!backupId) throw new ApiError(400, "Missing backup id.");

    const [backup] = await db.select().from(serverBackups).where(and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, id))).limit(1);
    if (!backup || !fs.existsSync(backup.filePath)) throw new ApiError(404, "Backup not found.");

    const buffer = fs.readFileSync(backup.filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${backup.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}.zip"`,
      },
    });
  });
}
