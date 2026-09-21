import "server-only";
import { db } from "@/db";
import { servers, serverNodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ApiError, isAdminRole, type CurrentUser } from "@/lib/server/auth";

export async function getServerForUser(user: CurrentUser, serverId: string) {
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server) throw new ApiError(404, "Server not found.");
  if (server.ownerId !== user.id && !isAdminRole(user.role)) {
    throw new ApiError(403, "You don't have permission to access this server.");
  }
  return server;
}

/**
 * Selects a node with sufficient free RAM/CPU/disk capacity for a new
 * server. Prevents overselling a node's advertised resources (PRD #45/46).
 */
export async function pickNodeWithCapacity(regionId: string, ramMb: number, cpuCores: number, storageMb: number) {
  const nodes = await db.select().from(serverNodes).where(eq(serverNodes.region, regionId));
  const onlineNodes = nodes.filter((n) => n.status === "ONLINE");
  if (onlineNodes.length === 0) throw new ApiError(400, "No hosting nodes are currently available in that region.");

  for (const node of onlineNodes) {
    const [usage] = await db
      .select({
        ram: sql<number>`coalesce(sum(${servers.ramMb}), 0)`,
        cpu: sql<number>`coalesce(sum(${servers.cpuCores}), 0)`,
        disk: sql<number>`coalesce(sum(${servers.storageMb}), 0)`,
      })
      .from(servers)
      .where(eq(servers.nodeId, node.id));

    const freeRam = node.ramCapacityMb - Number(usage?.ram ?? 0);
    const freeCpu = node.cpuCapacityCores - Number(usage?.cpu ?? 0);
    const freeDisk = node.diskCapacityMb - Number(usage?.disk ?? 0);

    if (freeRam >= ramMb && freeCpu >= cpuCores && freeDisk >= storageMb) {
      return node;
    }
  }
  throw new ApiError(409, "Insufficient capacity available in that region right now. Try another region or lower resource allocation.");
}

export async function allocatePort(): Promise<number> {
  const rows = await db.select({ port: servers.port }).from(servers);
  const used = new Set(rows.map((r) => r.port));
  let port = 25565;
  while (used.has(port)) port += 1;
  return port;
}
