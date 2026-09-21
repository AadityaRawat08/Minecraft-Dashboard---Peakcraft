"use client";

import { use, useEffect, useState } from "react";
import { apiFetch, postJson, ClientApiError } from "@/lib/client/api";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Skeleton } from "@/components/ui";
import { Ban, Shield, ShieldOff, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

type Player = { id: string; username: string; uuid: string; online: boolean; whitelisted: boolean; opped: boolean; banned: boolean; lastSeenAt: string };

export default function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [banTarget, setBanTarget] = useState<Player | null>(null);

  async function load() {
    try {
      const res = await apiFetch<Player[]>(`/api/servers/${id}/players`);
      setPlayers(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(username: string, action: string) {
    try {
      await postJson(`/api/servers/${id}/players`, { action, username });
      toast.success(`${action.replace("_", " ").toLowerCase()} applied to ${username}.`);
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Action failed.");
    }
  }

  async function addPlayer() {
    if (!newUsername.trim()) return;
    await act(newUsername.trim(), "ADD");
    setNewUsername("");
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-slate-400">Add a player by username</label>
          <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Notch" />
        </div>
        <Button onClick={addPlayer}><UserPlus className="h-4 w-4" /> Add player</Button>
      </Card>

      {players.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8 text-slate-600" />} title="No players tracked yet" description="Players who join, or are added manually, will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">Player</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Last seen</th><th className="px-4 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-200">{p.username}</p>
                    <p className="font-mono text-xs text-slate-500">{p.uuid}</p>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.online && <Badge tone="success">Online</Badge>}
                      {p.whitelisted && <Badge tone="info">Whitelisted</Badge>}
                      {p.opped && <Badge tone="warning">OP</Badge>}
                      {p.banned && <Badge tone="danger">Banned</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(p.lastSeenAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {p.online && <Button size="sm" variant="ghost" onClick={() => act(p.username, "KICK")}><UserMinus className="h-3.5 w-3.5" /> Kick</Button>}
                      {p.whitelisted ? (
                        <Button size="sm" variant="ghost" onClick={() => act(p.username, "UNWHITELIST")}>Un-whitelist</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => act(p.username, "WHITELIST")}>Whitelist</Button>
                      )}
                      {p.opped ? (
                        <Button size="sm" variant="ghost" onClick={() => act(p.username, "DEOP")}><ShieldOff className="h-3.5 w-3.5" /> De-op</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => act(p.username, "OP")}><Shield className="h-3.5 w-3.5" /> OP</Button>
                      )}
                      {p.banned ? (
                        <Button size="sm" variant="ghost" onClick={() => act(p.username, "UNBAN")}>Unban</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setBanTarget(p)}><Ban className="h-3.5 w-3.5 text-red-400" /> Ban</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        onConfirm={() => { if (banTarget) act(banTarget.username, "BAN"); setBanTarget(null); }}
        title={`Ban ${banTarget?.username}?`}
        description="This player will be removed and prevented from rejoining until unbanned."
        confirmLabel="Ban player"
      />
    </div>
  );
}
