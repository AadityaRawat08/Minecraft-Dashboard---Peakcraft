"use client";

import { use, useEffect, useState } from "react";
import { apiFetch, deleteJson, postJson, ClientApiError } from "@/lib/client/api";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Skeleton } from "@/components/ui";
import { formatBytes } from "@/lib/utils";
import { Archive, Download, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Backup = { id: string; name: string; sizeBytes: string; status: string; mcVersion: string; createdAt: string };

export default function BackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);

  async function load() {
    try {
      const res = await apiFetch<Backup[]>(`/api/servers/${id}/backups`);
      setBackups(res);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createBackup() {
    setCreating(true);
    try {
      await postJson(`/api/servers/${id}/backups`, { name });
      toast.success("Backup created.");
      setName("");
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to create backup.");
    } finally {
      setCreating(false);
    }
  }

  async function restore() {
    if (!restoreTarget) return;
    try {
      await postJson(`/api/servers/${id}/backups?op=restore`, { backupId: restoreTarget.id });
      toast.success("Backup restored.");
      setRestoreTarget(null);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to restore backup.");
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      await deleteJson(`/api/servers/${id}/backups?id=${deleteTarget.id}`);
      toast.success("Backup deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to delete backup.");
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-slate-400">Backup name (optional)</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Before updating to 1.21" />
        </div>
        <Button onClick={createBackup} disabled={creating}><Archive className="h-4 w-4" /> {creating ? "Creating…" : "Create backup"}</Button>
      </Card>

      {backups.length === 0 ? (
        <EmptyState icon={<Archive className="h-8 w-8 text-slate-600" />} title="No backups yet" description="Create a backup before making risky changes like updating versions or installing mods." />
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-slate-100">{b.name}</p>
                <p className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()} · {formatBytes(Number(b.sizeBytes))} · MC {b.mcVersion}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={b.status === "COMPLETED" ? "success" : b.status === "FAILED" ? "danger" : "warning"}>{b.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => window.open(`/api/servers/${id}/backups/download?id=${b.id}`, "_blank")}><Download className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => setRestoreTarget(b)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(b)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={restore}
        title={`Restore "${restoreTarget?.name}"?`}
        description="This will replace all current files with the contents of this backup. The server must be stopped first. This cannot be undone."
        confirmLabel="Restore backup"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This backup archive will be permanently deleted."
        confirmLabel="Delete backup"
      />
    </div>
  );
}
