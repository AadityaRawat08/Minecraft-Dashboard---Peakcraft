import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, verifyPassword, hashPassword, passwordStrengthError } from "@/lib/server/auth";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword, confirmPassword } = body as Record<string, string>;
    if (!currentPassword || !newPassword || !confirmPassword) return fail(400, "All fields are required.");
    if (newPassword !== confirmPassword) return fail(400, "New passwords do not match.");
    const strengthError = passwordStrengthError(newPassword);
    if (strengthError) return fail(400, strengthError);

    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const valid = await verifyPassword(currentPassword, row.passwordHash);
    if (!valid) return fail(401, "Current password is incorrect.");

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await logAudit({ userId: user.id, action: "PASSWORD_CHANGED" });
    return ok({ success: true });
  });
}
