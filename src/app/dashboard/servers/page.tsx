import Link from "next/link";
import { db } from "@/db";
import { servers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { ServerCard } from "@/components/server-card";
import { EmptyState } from "@/components/ui";
import { PlusCircle, Server } from "lucide-react";

export default async function ServersListPage() {
  const user = await requireUser();
  const myServers = await db.select().from(servers).where(eq(servers.ownerId, user.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Servers</h1>
          <p className="mt-1 text-sm text-slate-400">{myServers.length} of {user.maxServers} servers used.</p>
        </div>
        <Link href="/dashboard/servers/new" className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">
          <PlusCircle className="h-4 w-4" /> Create Server
        </Link>
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
  );
}
