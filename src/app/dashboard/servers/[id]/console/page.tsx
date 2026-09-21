import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ConsoleTerminal } from "@/components/console-terminal";

export default async function ServerConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const server = await getServerForUser(user, id);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Send Minecraft commands without the leading slash, e.g. <code className="rounded bg-slate-800 px-1.5 py-0.5">say Hello world</code>.</p>
      <ConsoleTerminal serverId={server.id} running={server.state === "RUNNING"} />
    </div>
  );
}
