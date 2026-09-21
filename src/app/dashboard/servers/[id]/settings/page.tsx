"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, deleteJson, patchJson, ClientApiError } from "@/lib/client/api";
import { Button, Card, ConfirmDialog, Input, Skeleton, Textarea } from "@/components/ui";
import { toast } from "sonner";
import { MINECRAFT_VERSIONS, SERVER_SOFTWARE } from "@/lib/minecraft/catalog";

type ServerDetail = {
  id: string; name: string; description: string; motd: string; maxPlayers: number;
  ramMb: number; cpuCores: number; storageMb: number; mcVersion: string; software: string; port: number; state: string;
};

export default function ServerSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versionWarningOpen, setVersionWarningOpen] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<ServerDetail>(`/api/servers/${id}`);
      setServer(res);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveGeneral() {
    if (!server) return;
    try {
      await patchJson(`/api/servers/${id}`, { name: server.name, description: server.description, motd: server.motd, maxPlayers: server.maxPlayers });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to save.");
    }
  }

  async function saveResources() {
    if (!server) return;
    try {
      await patchJson(`/api/servers/${id}`, { ramMb: server.ramMb, cpuCores: server.cpuCores, storageMb: server.storageMb });
      toast.success("Resources updated. Restart the server for changes to fully apply.");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to update resources.");
    }
  }

  async function deleteServer() {
    try {
      await deleteJson(`/api/servers/${id}`, { confirmation: "DELETE MY SERVER" });
      toast.success("Server deleted.");
      router.push("/dashboard/servers");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to delete server.");
    }
  }

  if (loading || !server) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-300">General</h3>
        <div><label className="mb-1 block text-xs text-slate-400">Server name</label><Input value={server.name} onChange={(e) => setServer({ ...server, name: e.target.value })} /></div>
        <div><label className="mb-1 block text-xs text-slate-400">Description</label><Textarea value={server.description} onChange={(e) => setServer({ ...server, description: e.target.value })} rows={2} /></div>
        <div><label className="mb-1 block text-xs text-slate-400">MOTD</label><Input value={server.motd} onChange={(e) => setServer({ ...server, motd: e.target.value })} /></div>
        <div><label className="mb-1 block text-xs text-slate-400">Max players</label><Input type="number" value={server.maxPlayers} onChange={(e) => setServer({ ...server, maxPlayers: Number(e.target.value) })} /></div>
        <Button onClick={saveGeneral}>Save general settings</Button>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-300">Resources</h3>
        <div>
          <label className="flex justify-between text-xs text-slate-400"><span>RAM</span><span>{server.ramMb} MB</span></label>
          <input type="range" min={1024} max={16384} step={512} value={server.ramMb} onChange={(e) => setServer({ ...server, ramMb: Number(e.target.value) })} className="w-full accent-emerald-500" />
        </div>
        <div>
          <label className="flex justify-between text-xs text-slate-400"><span>CPU cores</span><span>{server.cpuCores}</span></label>
          <input type="range" min={1} max={8} step={1} value={server.cpuCores} onChange={(e) => setServer({ ...server, cpuCores: Number(e.target.value) })} className="w-full accent-emerald-500" />
        </div>
        <div>
          <label className="flex justify-between text-xs text-slate-400"><span>Storage</span><span>{(server.storageMb / 1024).toFixed(1)} GB</span></label>
          <input type="range" min={2048} max={51200} step={1024} value={server.storageMb} onChange={(e) => setServer({ ...server, storageMb: Number(e.target.value) })} className="w-full accent-emerald-500" />
        </div>
        <Button onClick={saveResources}>Save resources</Button>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-slate-300">Network</h3>
        <p className="text-sm text-slate-400">Address: <span className="font-mono text-slate-200">{server.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.peakcraft.local:{server.port}</span></p>
        <p className="text-xs text-slate-500">Custom domains and SRV record linking are supported by the architecture and can be enabled per-node in a future release.</p>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-slate-300">Version & software</h3>
        <p className="text-sm text-slate-400">Currently running <span className="font-medium text-slate-200">{SERVER_SOFTWARE.find((s) => s.id === server.software)?.label}</span> on <span className="font-medium text-slate-200">{server.mcVersion}</span>.</p>
        <p className="text-xs text-amber-400">Changing versions can break worlds, plugins, and mods. Create a backup before continuing.</p>
        <Button variant="outline" onClick={() => setVersionWarningOpen(true)}>Change version or software</Button>
      </Card>

      <Card className="space-y-3 border-red-900/50 p-5">
        <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
        <p className="text-sm text-slate-400">Deleting this server permanently removes all files, worlds, backups, and player data.</p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete this server</Button>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteServer}
        title={`Delete "${server.name}"?`}
        description="This will permanently delete the server, all of its files, worlds, and backups. This cannot be undone."
        requireText="DELETE MY SERVER"
        confirmLabel="Delete server"
      />
      <ConfirmDialog
        open={versionWarningOpen}
        onClose={() => setVersionWarningOpen(false)}
        onConfirm={() => { setVersionWarningOpen(false); router.push(`/dashboard/servers/${id}/backups`); }}
        title="Create a backup before changing versions"
        description={`Version/software migration is a high-risk operation. We recommend creating a backup first from the Backups tab, then updating server.properties and reinstalling addons from the Plugins & Mods tab to match ${MINECRAFT_VERSIONS[0]} compatibility.`}
        confirmLabel="Create Backup & Continue"
        danger={false}
      />
    </div>
  );
}
