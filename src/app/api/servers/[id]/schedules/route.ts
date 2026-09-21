import "server-only";
import { db } from "@/db";
import { scheduledTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { computeNextRun } from "@/lib/server/scheduler";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const tasks = await db.select().from(scheduledTasks).where(eq(scheduledTasks.serverId, id));
    return ok(tasks);
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { action, recurrence, commandText, retention } = body as any;
    if (!action || !recurrence) return fail(400, "Missing action or recurrence.");
    const nextRunAt = computeNextRun(recurrence);
    await db.insert(scheduledTasks).values({ serverId: id, action, recurrence, commandText, retention, nextRunAt });
    await logAudit({ userId: user.id, serverId: id, action: "SCHEDULE_CREATED", metadata: { action } });
    return ok({ success: true });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { taskId, enabled } = body as { taskId?: string; enabled?: boolean };
    if (!taskId) return fail(400, "Missing taskId.");
    await db.update(scheduledTasks).set({ enabled: !!enabled }).where(eq(scheduledTasks.id, taskId));
    return ok({ success: true });
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("id");
    if (!taskId) return fail(400, "Missing id.");
    await db.delete(scheduledTasks).where(eq(scheduledTasks.id, taskId));
    return ok({ success: true });
  });
}
