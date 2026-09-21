import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, serverNodes, servers, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/server/auth";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "servers", label: "Servers", href: "/admin/servers" },
  { id: "nodes", label: "Nodes", href: "/admin/nodes" },
  { id: "audit", label: "Audit Logs", href: "/admin/audit-logs" },
];

/**
 * Legacy query-parameter tabs (`/admin?tab=users`) predate the dedicated admin
 * routes. They are forwarded rather than removed so existing links and
 * bookmarks keep resolving to a real page.
 */
const LEGACY_TAB_TARGETS: Record<string, string> = {
  users: "/admin/users",
  servers: "/admin/servers",
  nodes: "/admin/nodes",
  audit: "/admin/audit-logs",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab = "overview" } = await searchParams;

  const legacyTarget = LEGACY_TAB_TARGETS[tab];
  if (legacyTarget) redirect(legacyTarget);

  const [userRows, serverRows, nodeRows, recentLogs] = await Promise.all([
    db.select({ id: users.id }).from(users),
    db.select({ server: servers, ownerUsername: users.username })
      .from(servers)
      .innerJoin(users, eq(servers.ownerId, users.id)),
    db.select().from(serverNodes),
    db.select({ log: auditLogs, username: users.username })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(6),
  ]);

  const totalRam = serverRows.reduce((sum, row) => sum + row.server.ramMb, 0);
  const running = serverRows.filter((row) => row.server.state === "RUNNING").length;

  const nodeUsage = await Promise.all(nodeRows.map(async (node) => {
    const [usage] = await db
      .select({ ram: sql<number>`coalesce(sum(${servers.ramMb}), 0)`, count: sql<number>`count(*)` })
      .from(servers)
      .where(eq(servers.nodeId, node.id));
    return { ...node, usedRam: Number(usage?.ram ?? 0), serverCount: Number(usage?.count ?? 0) };
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Administration</h1>
        <p className="mt-1 text-sm text-slate-400">Platform overview. Use the tabs to manage each area.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-800">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium",
              tab === item.id ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><p className="text-xs text-slate-500">Total users</p><p className="mt-1 text-2xl font-semibold text-white">{userRows.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Total servers</p><p className="mt-1 text-2xl font-semibold text-white">{serverRows.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Running now</p><p className="mt-1 text-2xl font-semibold text-emerald-400">{running}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Allocated RAM</p><p className="mt-1 text-2xl font-semibold text-white">{(totalRam / 1024).toFixed(1)} GB</p></Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Node health</p>
          <Link href="/admin/nodes" className="text-xs text-emerald-400 hover:underline">Manage nodes</Link>
        </div>
        {nodeUsage.length === 0 ? (
          <p className="text-sm text-slate-500">No hosting nodes configured.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {nodeUsage.map((node) => (
              <div key={node.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{node.name}</span>
                  <Badge tone={node.status === "ONLINE" ? "success" : "warning"}>{node.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{node.region} · {node.serverCount} servers</p>
                <p className="text-xs text-slate-500">{node.usedRam}/{node.ramCapacityMb} MB RAM allocated</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Latest platform activity</p>
          <Link href="/admin/audit-logs" className="text-xs text-emerald-400 hover:underline">View all</Link>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No audit events found.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentLogs.map(({ log, username }) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <Badge>{log.action}</Badge>
                  <span className="text-slate-400">{username ?? "system"}</span>
                </div>
                <span className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}