import { db } from "@/db";
import { auditLogs, servers, users } from "@/db/schema";
import { and, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/server/auth";
import { ok, handleApi } from "@/lib/server/http";
import { parsePagination, parseSearch, parseDate, isUuid, totalPages } from "@/lib/server/admin-query";

/**
 * GET /api/admin/audit-logs
 *
 * Platform-wide audit trail. Supports free-text search, action/user/server
 * filters and an inclusive date range. `metadata` is returned as-is because it
 * is written by `logAudit()` and never contains credentials — secrets such as
 * session tokens and password hashes are not part of the audit model.
 */
export async function GET(req: Request) {
  return handleApi(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const search = parseSearch(searchParams);
    const action = parseSearch(searchParams, "action", 60);
    const userSearch = parseSearch(searchParams, "user", 60);
    const serverSearch = parseSearch(searchParams, "server", 60);
    const userId = searchParams.get("userId");
    const serverId = searchParams.get("serverId");
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));

    const conditions: SQL[] = [];
    if (search) {
      conditions.push(ilike(auditLogs.action, `%${search}%`));
    }
    if (action) conditions.push(eq(auditLogs.action, action));
    if (userSearch) conditions.push(ilike(users.username, `%${userSearch}%`));
    if (serverSearch) conditions.push(ilike(servers.name, `%${serverSearch}%`));
    if (isUuid(userId)) conditions.push(eq(auditLogs.userId, userId));
    if (isUuid(serverId)) conditions.push(eq(auditLogs.serverId, serverId));
    if (from) conditions.push(gte(auditLogs.createdAt, from));
    if (to) conditions.push(lte(auditLogs.createdAt, to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // The count query mirrors the same joins as the page query so text filters
    // on joined tables (username / server name) stay consistent.
    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(servers, eq(auditLogs.serverId, servers.id))
      .where(where);
    const total = Number(countRow?.total ?? 0) || 0;

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        username: users.username,
        serverId: auditLogs.serverId,
        serverName: servers.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(servers, eq(auditLogs.serverId, servers.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Distinct action names power the "Filter by action" dropdown without
    // requiring a second round-trip or a hard-coded list.
    const actionRows = await db.selectDistinct({ action: auditLogs.action }).from(auditLogs);
    const actions = actionRows.map((row) => row.action).sort((a, b) => a.localeCompare(b));

    const items = rows.map((row) => ({
      id: String(row.id),
      action: row.action,
      metadata: row.metadata,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      username: row.username,
      serverId: row.serverId,
      serverName: row.serverName,
    }));

    return ok({ items, actions, page, pageSize, total, totalPages: totalPages(total, pageSize) });
  });
}