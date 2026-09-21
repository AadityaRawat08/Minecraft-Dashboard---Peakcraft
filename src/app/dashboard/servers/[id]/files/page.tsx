import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { FileManager } from "@/components/file-manager";

export default async function ServerFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const server = await getServerForUser(user, id);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Browse and edit every file in <span className="font-mono">{server.name}</span>&apos;s sandboxed directory — including worlds,
        <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5">server.properties</code>, and player lists. Upload a <code className="rounded bg-slate-800 px-1.5 py-0.5">.zip</code> into the world folder to import a world; use the archive icon to extract it.
      </p>
      <FileManager serverId={server.id} />
    </div>
  );
}
