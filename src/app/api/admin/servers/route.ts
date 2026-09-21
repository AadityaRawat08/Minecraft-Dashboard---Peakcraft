import { db } from "@/db";
import { metricSamples, serverNodes, servers, users } from "@/db/schema";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/server/auth";
import { ok, handleApi } from "@/lib/server/http";
import { parsePagination, parseSearch, parseEnum, totalPages, toNumber } from "@/lib/server/admin-query";

const SERVER_STATES = [
  "CREATING", "STARTING", "RUNNING", "STOPPING", "STOPPED", "RESTARTING", "ERROR", "DELETING",
] as const;

/**
 * GET /api/admin/servers
 *
 * Platform-wide server inventory across every owner, with the owning account
 * and hosting node resolved. Admin only (enforced by `requireAdmin`).
 */
export async function GET(req: Request) {
  return handleApi(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const search = parseSearch(searchParams);
    const state = parseEnum(searchParams.get("state"), SERVER_STATES);
    const ownerId = searchParams.get("ownerId");

    const conditions: SQL[] = [];
    if (search) {
      conditions.push(or(ilike(servers.name, `%${search}%`), ilike(users.username, `%${search}%`)) as SQL);
    }
    if (state) conditions.push(eq(servers.state, state));
    if (ownerId) conditions.push(eq(servers.ownerId, ownerId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(servers)
      .innerJoin(users, eq(servers.ownerId, users.id))
      .where(where);
    const total = toNumber(countRow?.total);

    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        state: servers.state,
        mcVersion: servers.mcVersion,
        software: servers.software,
        ramMb: servers.ramMb,
        cpuCores: servers.cpuCores,
        storageMb: servers.storageMb,
        maxPlayers: servers.maxPlayers,
        port: servers.port,
        createdAt: servers.createdAt,
        ownerId: servers.ownerId,
        ownerUsername: users.username,
        ownerEmail: users.email,
        nodeId: servers.nodeId,
        nodeName: serverNodes.name,
        nodeRegion: serverNodes.region,
        playersOnline: sql<number>`coalesce((select ${metricSamples.playersOnline} from ${metricSamples} where ${metricSamples.serverId} = ${servers.id} order by ${metricSamples.createdAt} desc limit 1), 0)`,
      })
      .from(servers)
      .innerJoin(users, eq(servers.ownerId, users.id))
      .innerJoin(serverNodes, eq(servers.nodeId, serverNodes.id))
      .where(where)
      .orderBy(desc(servers.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      playersOnline: toNumber(row.playersOnline),
    }));

    return ok({ items, page, pageSize, total, totalPages: totalPages(total, pageSize) });
  });
}