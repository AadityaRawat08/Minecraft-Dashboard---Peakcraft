import { db } from "@/db";
import { servers, sessions, users } from "@/db/schema";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requireAdmin, ApiError } from "@/lib/server/auth";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { getProvider } from "@/lib/minecraft/provider";
import { parsePagination, parseSearch, parseEnum, totalPages, toNumber } from "@/lib/server/admin-query";

const USER_ROLES = ["USER", "SUPPORT", "ADMIN", "SUPER_ADMIN"] as const;
const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

/**
 * GET /api/admin/users
 *
 * Admin-only, paginated user directory. Never returns `password_hash` — the
 * select list below is an explicit allow-list of safe columns.
 */
export async function GET(req: Request) {
  return handleApi(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const search = parseSearch(searchParams);
    const role = parseEnum(searchParams.get("role"), USER_ROLES);
    const status = parseEnum(searchParams.get("status"), USER_STATUSES);

    const conditions: SQL[] = [];
    if (search) {
      conditions.push(or(ilike(users.username, `%${search}%`), ilike(users.email, `%${search}%`)) as SQL);
    }
    if (role) conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.status, status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await db.select({ total: sql<number>`count(*)` }).from(users).where(where);
    const total = toNumber(countRow?.total);

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        status: users.status,
        maxServers: users.maxServers,
        createdAt: users.createdAt,
        serverCount: sql<number>`(select count(*) from ${servers} where ${servers.ownerId} = ${users.id})`,
        lastActiveAt: sql<string | null>`(select max(${sessions.lastUsedAt}) from ${sessions} where ${sessions.userId} = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((row) => ({
      ...row,
      serverCount: toNumber(row.serverCount),
      lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
    }));

    return ok({ items, page, pageSize, total, totalPages: totalPages(total, pageSize) });
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const { userId, status, role } = body as { userId?: string; status?: string; role?: string };
    if (!userId) return fail(400, "Missing userId.");
    if (userId === admin.id) return fail(400, "You cannot modify your own account here.");

    const updates: Partial<typeof users.$inferInsert> = {};
    if (status && ["ACTIVE", "SUSPENDED"].includes(status)) updates.status = status as "ACTIVE" | "SUSPENDED";
    if (role && ["USER", "SUPPORT", "ADMIN", "SUPER_ADMIN"].includes(role)) {
      if (admin.role !== "SUPER_ADMIN") throw new ApiError(403, "Only a super admin can change roles.");
      updates.role = role as "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
    }
    if (Object.keys(updates).length === 0) return fail(400, "No valid fields to update.");

    await db.update(users).set(updates).where(eq(users.id, userId));
    await logAudit({ userId: admin.id, action: "ADMIN_USER_UPDATED", metadata: { targetUserId: userId, updates } });
    return ok({ success: true });
  });
}

export async function DELETE(req: Request) {
  return handleApi(async () => {
    const admin = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");
    if (!userId) return fail(400, "Missing id.");
    if (userId === admin.id) return fail(400, "You cannot delete your own account here.");

    const ownedServers = await db.select().from(servers).where(eq(servers.ownerId, userId));
    for (const server of ownedServers) {
      await getProvider().destroy(server.id);
    }
    await db.delete(users).where(eq(users.id, userId));
    await logAudit({ userId: admin.id, action: "ADMIN_USER_DELETED", metadata: { targetUserId: userId } });
    return ok({ success: true });
  });
}
