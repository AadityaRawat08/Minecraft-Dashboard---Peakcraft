import { db } from "@/db";
import { metricSamples, serverNodes, servers, serverPlayers, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin, ApiError } from "@/lib/server/auth";
import { ok, handleApi } from "@/lib/server/http";
import { isUuid, toNumber } from "@/lib/server/admin-query";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/servers/:id
 *
 * Admin inspection payload for a single server: configuration, owning account,
 * hosting node, latest resource sample and player tallies. Used by the
 * "Inspect" action on the admin servers page.
 */
export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Server not found.");

    const [row] = await db
      .select({
        server: servers,
        ownerUsername: users.username,
        ownerEmail: users.email,
        ownerRole: users.role,
        nodeName: serverNodes.name,
        nodeRegion: serverNodes.region,
        nodeStatus: serverNodes.status,
        playersOnline: sql<number>`coalesce((select ${metricSamples.playersOnline} from ${metricSamples} where ${metricSamples.serverId} = ${servers.id} order by ${metricSamples.createdAt} desc limit 1), 0)`,
        cpuPercent: sql<number>`coalesce((select ${metricSamples.cpuPercent} from ${metricSamples} where ${metricSamples.serverId} = ${servers.id} order by ${metricSamples.createdAt} desc limit 1), 0)`,
        ramUsedMb: sql<number>`coalesce((select ${metricSamples.ramMb} from ${metricSamples} where ${metricSamples.serverId} = ${servers.id} order by ${metricSamples.createdAt} desc limit 1), 0)`,
        playerCount: sql<number>`(select count(*) from ${serverPlayers} where ${serverPlayers.serverId} = ${servers.id})`,
        backupRecommended: sql<boolean>`false`,
      })
      .from(servers)
      .innerJoin(users, eq(servers.ownerId, users.id))
      .innerJoin(serverNodes, eq(servers.nodeId, serverNodes.id))
      .where(eq(servers.id, id))
      .limit(1);

    if (!row) throw new ApiError(404, "Server not found.");

    const { server } = row;
    return ok({
      server: {
        id: server.id,
        name: server.name,
        description: server.description,
        state: server.state,
        mcVersion: server.mcVersion,
        software: server.software,
        ramMb: server.ramMb,
        cpuCores: server.cpuCores,
        storageMb: server.storageMb,
        maxPlayers: server.maxPlayers,
        port: server.port,
        motd: server.motd,
        activeWorld: server.activeWorld,
        errorMessage: server.errorMessage,
        lastStartedAt: server.lastStartedAt ? server.lastStartedAt.toISOString() : null,
        createdAt: server.createdAt.toISOString(),
        updatedAt: server.updatedAt.toISOString(),
      },
      owner: { id: server.ownerId, username: row.ownerUsername, email: row.ownerEmail, role: row.ownerRole },
      node: { id: server.nodeId, name: row.nodeName, region: row.nodeRegion, status: row.nodeStatus },
      live: {
        playersOnline: toNumber(row.playersOnline),
        playerCount: toNumber(row.playerCount),
        cpuPercent: toNumber(row.cpuPercent),
        ramUsedMb: toNumber(row.ramUsedMb),
      },
    });
  });
}