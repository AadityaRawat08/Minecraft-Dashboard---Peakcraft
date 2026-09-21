import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ServerOverviewClient } from "@/components/server-overview-client";
import { Card } from "@/components/ui";

export default async function ServerOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const server = await getServerForUser(user, id);

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 p-5 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-slate-500">Minecraft version</p><p className="font-medium text-slate-200">{server.mcVersion}</p></div>
        <div><p className="text-xs text-slate-500">Software</p><p className="font-medium text-slate-200">{server.software}</p></div>
        <div><p className="text-xs text-slate-500">Allocated</p><p className="font-medium text-slate-200">{server.ramMb}MB / {server.cpuCores} cores</p></div>
        <div><p className="text-xs text-slate-500">Max players</p><p className="font-medium text-slate-200">{server.maxPlayers}</p></div>
      </Card>
      <ServerOverviewClient serverId={server.id} />
    </div>
  );
}
