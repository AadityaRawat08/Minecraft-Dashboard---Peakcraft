import Link from "next/link";
import { db } from "@/db";
import { auditLogs, servers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { Card, EmptyState, Badge } from "@/components/ui";
import { ServerCard } from "@/components/server-card";
import { Server, PlusCircle, Activity } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const myServers = await db.select().from(servers).where(eq(servers.ownerId, user.id));
  const recentLogs = await db.select().from(auditLogs).where(eq(auditLogs.userId, user.id)).orderBy(desc(auditLogs.createdAt)).limit(8);

  const running = myServers.filter((s) => s.state === "RUNNING").length;
  const offline = myServers.filter((s) => s.state === "STOPPED").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Welcome back, {user.username}.</h1>
        <p className="mt-1 text-sm text-slate-400">Here&apos;s what&apos;s happening across your Minecraft servers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><p className="text-xs text-slate-500">Total servers</p><p className="mt-1 text-2xl font-semibold text-white">{myServers.length} / {user.maxServers}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Running</p><p className="mt-1 text-2xl font-semibold text-emerald-400">{running}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Offline</p><p className="mt-1 text-2xl font-semibold text-slate-400">{offline}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Allocated RAM</p><p className="mt-1 text-2xl font-semibold text-white">{(myServers.reduce((s, x) => s + x.ramMb, 0) / 1024).toFixed(1)} GB</p></Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-medium text-white"><Server className="h-4 w-4" /> Your servers</h2>
          <Link href="/dashboard/servers/new" className="flex items-center gap-1 text-sm text-emerald-400 hover:underline"><PlusCircle className="h-4 w-4" /> Create server</Link>
        </div>
        {myServers.length === 0 ? (
          <EmptyState
            icon={<Server className="h-8 w-8 text-slate-600" />}
            title="You don't have any servers yet."
            description="Create your first Minecraft server to get started."
            action={<Link href="/dashboard/servers/new" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">Create your first server</Link>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myServers.map((s) => <ServerCard key={s.id} server={s} />)}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-medium text-white"><Activity className="h-4 w-4" /> Recent activity</h2>
        <Card className="divide-y divide-slate-800">
          {recentLogs.length === 0 && <p className="p-4 text-sm text-slate-500">No activity yet.</p>}
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3 text-sm">
              <Badge>{log.action}</Badge>
              <span className="text-xs text-slate-500">{timeAgo(log.createdAt)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
