"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteJson, patchJson, postJson, ClientApiError } from "@/lib/client/api";
import { Button, ConfirmDialog, Input, Select } from "@/components/ui";
import { toast } from "sonner";
import { Eye, Play, RotateCw, Square, Trash2 } from "lucide-react";

export function UserActions({
  userId, status, onDetails, onDone,
}: {
  userId: string; status: string; onDetails?: () => void; onDone?: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleSuspend() {
    setBusy(true);
    try {
      await patchJson("/api/admin/users", { userId, status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
      toast.success(status === "ACTIVE" ? "User suspended." : "User reactivated.");
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/users?id=${userId}`);
      toast.success("User deleted.");
      setConfirmOpen(false);
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to delete user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onDetails && <Button size="sm" variant="secondary" onClick={onDetails} disabled={busy}>Details</Button>}
      <Button size="sm" variant="outline" onClick={toggleSuspend} disabled={busy}>{status === "ACTIVE" ? "Suspend" : "Reactivate"}</Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={busy} aria-label="Delete user"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} loading={busy} title="Delete user?" description="This permanently deletes the user and all of their servers." confirmLabel="Delete user" />
    </div>
  );
}

export function ServerActions({
  serverId, state, onInspect, onDone,
}: {
  serverId: string; state: string; onInspect?: () => void; onDone?: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: "START" | "STOP" | "RESTART") {
    setBusy(true);
    try {
      await postJson(`/api/servers/${serverId}/actions`, { action });
      toast.success(`${action.charAt(0)}${action.slice(1).toLowerCase()} requested.`);
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      // Server deletion already requires a typed confirmation server-side and
      // is authorised through getServerForUser(), which accepts admins — so the
      // existing owner-facing endpoint is reused rather than duplicated.
      await deleteJson(`/api/servers/${serverId}`, { confirmation: "DELETE MY SERVER" });
      toast.success("Server deleted.");
      setConfirmOpen(false);
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to delete server.");
    } finally {
      setBusy(false);
    }
  }

  const canStart = state === "STOPPED" || state === "ERROR";
  const canStop = state === "RUNNING";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canStart && <Button size="sm" onClick={() => act("START")} disabled={busy}><Play className="h-3.5 w-3.5" /> Start</Button>}
      {canStop && <Button size="sm" variant="outline" onClick={() => act("STOP")} disabled={busy}><Square className="h-3.5 w-3.5" /> Stop</Button>}
      {canStop && <Button size="sm" variant="outline" onClick={() => act("RESTART")} disabled={busy}><RotateCw className="h-3.5 w-3.5" /> Restart</Button>}
      <Link
        href={`/dashboard/servers/${serverId}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
      >
        <Eye className="h-3.5 w-3.5" /> View
      </Link>
      {onInspect && <Button size="sm" variant="secondary" onClick={onInspect} disabled={busy}>Inspect</Button>}
      <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={busy} aria-label="Delete server"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} loading={busy} title="Delete server?" description="This permanently deletes the server and all associated data." confirmLabel="Delete server" />
    </div>
  );
}

export function NodeActions({
  nodeId, status, serverCount = 0, onDone,
}: {
  nodeId: string; status: string; serverCount?: number; onDone?: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function update(newStatus: string) {
    setBusy(true);
    try {
      await patchJson("/api/admin/nodes", { nodeId, status: newStatus });
      toast.success("Node updated.");
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to update node.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/nodes?id=${nodeId}`);
      toast.success("Node removed.");
      setConfirmOpen(false);
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to remove node.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select value={status} onChange={(e) => update(e.target.value)} disabled={busy} className="w-36">
        <option value="ONLINE">Online</option>
        <option value="MAINTENANCE">Maintenance</option>
        <option value="OFFLINE">Offline</option>
      </Select>
      <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={busy} aria-label="Remove node"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        loading={busy}
        title="Remove node?"
        description={serverCount > 0
          ? `This node still hosts ${serverCount} server${serverCount === 1 ? "" : "s"}. Migrate or delete them first — removal is refused until the node is empty.`
          : "This permanently removes the node from the platform."}
        confirmLabel="Remove node"
      />
    </div>
  );
}

export function AddNodeForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", region: "india", ramCapacityMb: 32768, cpuCapacityCores: 16, diskCapacityMb: 512000 });

  async function submit() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await postJson("/api/admin/nodes", form);
      toast.success("Node added.");
      setForm({ ...form, name: "" });
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to add node.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><label className="mb-1 block text-xs text-slate-400">Node name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="peak-eu-02" /></div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Region</label>
        <Select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
          <option value="india">India</option><option value="singapore">Singapore</option><option value="europe">Europe</option><option value="north-america">North America</option>
        </Select>
      </div>
      <Button onClick={submit} disabled={busy}>{busy ? "Adding..." : "Add node"}</Button>
    </div>
  );
}

/**
 * Shared pagination footer used by every admin collection page. Renders
 * nothing when the dataset is empty so empty states stay clean.
 */
export function Pagination({
  page, totalPages, total, onPageChange, itemLabel,
}: {
  page: number; totalPages: number; total: number; onPageChange: (page: number) => void; itemLabel: string;
}) {
  if (total === 0) return null;
  const safeTotalPages = Math.max(1, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-sm">
      <span className="text-slate-500">
        {total} {itemLabel}{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
        <span className="text-xs text-slate-500">Page {page} of {safeTotalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= safeTotalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** Table body placeholder shown while an admin collection is loading. */
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
