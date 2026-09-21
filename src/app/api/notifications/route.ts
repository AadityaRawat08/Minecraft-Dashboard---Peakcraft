import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { ok, fail, handleApi } from "@/lib/server/http";

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
    return ok(rows);
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { id, all } = body as { id?: string; all?: boolean };

    if (all) {
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
      return ok({ success: true });
    }
    if (!id) return fail(400, "Missing id.");
    await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
    return ok({ success: true });
  });
}
