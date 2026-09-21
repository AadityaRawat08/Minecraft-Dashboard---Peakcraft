import { db } from "@/db";
import { auditLogs, serverNodes, servers, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin, ApiError } from "@/lib/server/auth";
import { ok, handleApi } from "@/lib/server/http";
import { isUuid, toNumber } from "@/lib/server/admin-query";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/users/:id
 *
 * Full admin view of a single account: safe profile fields, recent activity
 * counters and the servers the user owns. Sensitive columns (password hash,
 * session tokens) are never selected.
 */
export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "User not found.");

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        status: users.status,
        maxServers: users.maxServers,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: sql<string | null>`(select max(${auditLogs.createdAt}) from ${auditLogs} where ${auditLogs.userId} = ${users.id} and ${auditLogs.action} = 'LOGIN')`,
        eventCount: sql<number>`(select count(*) from ${auditLogs} where ${auditLogs.userId} = ${users.id})`,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) throw new ApiError(404, "User not found.");

    const ownedServers = await db
      .select({
        id: servers.id,
        name: servers.name,
        state: servers.state,
        software: servers.software,
        mcVersion: servers.mcVersion,
        ramMb: servers.ramMb,
        cpuCores: servers.cpuCores,
        storageMb: servers.storageMb,
        port: servers.port,
        createdAt: servers.createdAt,
        nodeName: serverNodes.name,
        nodeRegion: serverNodes.region,
      })
      .from(servers)
      .innerJoin(serverNodes, eq(servers.nodeId, serverNodes.id))
      .where(eq(servers.ownerId, id))
      .orderBy(desc(servers.createdAt));

    return ok({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
        eventCount: toNumber(user.eventCount),
      },
      servers: ownedServers.map((server) => ({ ...server, createdAt: server.createdAt.toISOString() })),
    });
  });
}