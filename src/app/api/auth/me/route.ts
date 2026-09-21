import { db } from "@/db";
import { servers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, isValidUsername, ApiError, destroySession } from "@/lib/server/auth";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return ok(user);
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { username } = body as { username?: string };
    if (!username) return fail(400, "Nothing to update.");
    if (!isValidUsername(username)) return fail(400, "Username must be 3-20 characters (letters, numbers, underscore only).");

    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0 && existing[0].id !== user.id) return fail(409, "That username is already taken.");

    await db.update(users).set({ username, updatedAt: new Date() }).where(eq(users.id, user.id));
    await logAudit({ userId: user.id, action: "PROFILE_UPDATED" });
    return ok({ success: true });
  });
}

export async function DELETE(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { confirmation } = body as { confirmation?: string };
    if (confirmation !== "DELETE MY ACCOUNT") {
      throw new ApiError(400, 'Type "DELETE MY ACCOUNT" to confirm.');
    }
    const owned = await db.select({ id: servers.id }).from(servers).where(eq(servers.ownerId, user.id));
    if (owned.length > 0) {
      throw new ApiError(409, "Delete all of your servers before deleting your account.");
    }
    await db.delete(users).where(eq(users.id, user.id));
    await destroySession();
    await logAudit({ action: "ACCOUNT_DELETED", metadata: { userId: user.id } });
    return ok({ success: true });
  });
}
