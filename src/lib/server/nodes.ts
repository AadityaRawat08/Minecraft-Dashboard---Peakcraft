import "server-only";
import { db } from "@/db";
import { serverNodes, servers } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import { toNumber } from "@/lib/server/admin-query";

// Node inventory / health service.
//
// The admin UI talks to this module instead of aggregating directly so that a
// future hosting backend (remote node agents, Docker control channel, Nomad…)
// can replace `listNodeSummaries()` without any UI changes — mirroring the
// provider/adapter approach used by the Minecraft server runtime.
//
//   NodeInventoryService (this module)
//   ├── DatabaseNodeInventory   (active — capacity + allocation from Postgres)
//   └── AgentNodeInventory      (future — live CPU/RAM/disk + heartbeats)

export type NodeStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE";
export type NodeHealth = "HEALTHY" | "DEGRADED" | "MAINTENANCE" | "DOWN";

export type NodeSummary = {
  id: string;
  name: string;
  region: string;
  status: NodeStatus;
  ramCapacityMb: number;
  cpuCapacityCores: number;
  diskCapacityMb: number;
  createdAt: Date;
  /** Allocated (sold) resources across every server on the node. */
  usedRamMb: number;
  usedCpuCores: number;
  usedDiskMb: number;
  serverCount: number;
  runningServerCount: number;
  ramPercent: number;
  cpuPercent: number;
  diskPercent: number;
  health: NodeHealth;
};

/**
 * Describes the low-level node agent (the process that would actually run
 * containers on a host). Remote node agents are NOT implemented in this
 * deployment, so rather than inventing hostnames, IP addresses or credentials
 * this reports an explicit "unavailable" descriptor. The admin UI renders that
 * as "Not configured" — never as fake infrastructure data.
 *
 * When the agent ships, implement this function against the agent's control
 * API and the Nodes page starts showing real values automatically.
 */
export type NodeAgentInfo =
  | { available: true; host: string; agentVersion: string; lastHeartbeatAt: Date }
  | { available: false; reason: string };

const AGENT_UNAVAILABLE_REASON =
  "Node agent control channel is not implemented in this deployment — host addresses and live host metrics are unavailable.";

export function getNodeAgentInfo(): NodeAgentInfo {
  return { available: false, reason: AGENT_UNAVAILABLE_REASON };
}

function percent(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 1000) / 10);
}

/**
 * Derives a coarse health signal from the node's declared status plus its
 * allocation. Resource pressure (>= 90% allocated) is surfaced as DEGRADED so
 * admins can act before a node is fully sold out.
 */
export function computeNodeHealth(status: NodeStatus, ramPercent: number, cpuPercent: number, diskPercent: number): NodeHealth {
  if (status === "OFFLINE") return "DOWN";
  if (status === "MAINTENANCE") return "MAINTENANCE";
  const peak = Math.max(ramPercent, cpuPercent, diskPercent);
  return peak >= 90 ? "DEGRADED" : "HEALTHY";
}

/** Lists every node with its live allocation and derived health. */
export async function listNodeSummaries(): Promise<NodeSummary[]> {
  const rows = await db
    .select({
      id: serverNodes.id,
      name: serverNodes.name,
      region: serverNodes.region,
      status: serverNodes.status,
      ramCapacityMb: serverNodes.ramCapacityMb,
      cpuCapacityCores: serverNodes.cpuCapacityCores,
      diskCapacityMb: serverNodes.diskCapacityMb,
      createdAt: serverNodes.createdAt,
      usedRamMb: sql<number>`coalesce((select sum(${servers.ramMb}) from ${servers} where ${servers.nodeId} = ${serverNodes.id}), 0)`,
      usedCpuCores: sql<number>`coalesce((select sum(${servers.cpuCores}) from ${servers} where ${servers.nodeId} = ${serverNodes.id}), 0)`,
      usedDiskMb: sql<number>`coalesce((select sum(${servers.storageMb}) from ${servers} where ${servers.nodeId} = ${serverNodes.id}), 0)`,
      serverCount: sql<number>`(select count(*) from ${servers} where ${servers.nodeId} = ${serverNodes.id})`,
      runningServerCount: sql<number>`(select count(*) from ${servers} where ${servers.nodeId} = ${serverNodes.id} and ${servers.state} = 'RUNNING')`,
    })
    .from(serverNodes)
    .orderBy(asc(serverNodes.name));

  return rows.map((row) => {
    const usedRamMb = toNumber(row.usedRamMb);
    const usedCpuCores = toNumber(row.usedCpuCores);
    const usedDiskMb = toNumber(row.usedDiskMb);
    const ramPercent = percent(usedRamMb, row.ramCapacityMb);
    const cpuPercent = percent(usedCpuCores, row.cpuCapacityCores);
    const diskPercent = percent(usedDiskMb, row.diskCapacityMb);

    return {
      ...row,
      status: row.status as NodeStatus,
      usedRamMb,
      usedCpuCores,
      usedDiskMb,
      serverCount: toNumber(row.serverCount),
      runningServerCount: toNumber(row.runningServerCount),
      ramPercent,
      cpuPercent,
      diskPercent,
      health: computeNodeHealth(row.status as NodeStatus, ramPercent, cpuPercent, diskPercent),
    };
  });
}