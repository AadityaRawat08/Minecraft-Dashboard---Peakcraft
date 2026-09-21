"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, StatusPill } from "@/components/ui";
import { Pagination, ServerActions, TableSkeleton } from "@/components/admin-panel";
import { useCollection, useDebouncedValue } from "@/lib/client/collection";
import { timeAgo } from "@/lib/utils";
import { RefreshCw, Search, Server as ServerIcon } from "lucide-react";

const STATE_OPTIONS = ["CREATING", "STARTING", "RUNNING", "STOPPING", "STOPPED", "RESTARTING", "ERROR", "DELETING"] as const;
const PAGE_SIZE = 20;

const SOFTWARE_LABEL: Record<string, string> = {
  VANILLA: "Vanilla", PAPER: "Paper", SPIGOT: "Spigot", PURPUR: "Purpur",
  FABRIC: "Fabric", FORGE: "Forge", NEOFORGE: "NeoForge", QUILT: "Quilt",
};

type ServerRow = {
  id: string;
  name: string;
  description: string;
  state: string;
  mcVersion: string;
  software: string;
  ramMb: number;
  cpuCores: number;
  storageMb: number;
  maxPlayers: number;
  port: number;
  createdAt: string;
  ownerId: string;
  ownerUsername: string;
  ownerEmail: string;
  nodeId: string;
  nodeName: string;
  nodeRegion: string;
  playersOnline: number;
};

type ServerDetail = {
  server: {
    id: string;
    name: string;
    description: string;
    state: string;
    mcVersion: string;
    software: string;
    ramMb: number;
    cpuCores: number;
    storageMb: number;
    maxPlayers: number;
    port: number;
    motd: string;
    activeWorld: string;
    errorMessage: string | null;
    lastStartedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  owner: { id: string; username: string; email: string; role: string };
  node: { id: string; name: string; region: string; status: string };
  live: { playersOnline: number; playerCount: number; cpuPercent: number; ramUsedMb: number };
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-slate-200">{value}</div>
    </div>
  );
}

function gigabytes(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Admin inspection dialog backed by GET /api/admin/servers/:id. */
function ServerInspectDialog({ serverId, onClose }: { serverId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<ServerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    let active = true;

    // Loaded inside an async task so state updates never run synchronously
    // from the effect body.
    async function load() {
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const result = await apiFetch<ServerDetail>(`/api/admin/servers/${serverId}`);
        if (active) setDetail(result);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load server.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => { active = false; };
  }, [serverId]);

  if (!serverId) return null;

  return (
    <Modal open onClose={onClose} title="Server inspection">
      {loading && <p className="text-sm text-slate-400">Loading server…</p>}
      {error && (
        <div className="space-y-3">
          <p className="text-sm text-red-400">{error}</p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      )}

      {detail && (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Server ID" value={<span className="break-all font-mono text-xs">{detail.server.id}</span>} />
            <Field label="Status" value={<StatusPill state={detail.server.state} />} />
            <Field label="Owner" value={`${detail.owner.username} (${detail.owner.email})`} />
            <Field label="Owner role" value={<Badge tone="info">{detail.owner.role}</Badge>} />
            <Field label="Node" value={`${detail.node.name} · ${detail.node.region}`} />
            <Field label="Node status" value={<Badge tone={detail.node.status === "ONLINE" ? "success" : "warning"}>{detail.node.status}</Badge>} />
            <Field label="Minecraft / software" value={`${detail.server.mcVersion} · ${SOFTWARE_LABEL[detail.server.software] ?? detail.server.software}`} />
            <Field label="Address" value={<span className="font-mono text-xs">localhost:{detail.server.port}</span>} />
            <Field label="Allocated" value={`${detail.server.ramMb} MB RAM · ${detail.server.cpuCores} cores · ${gigabytes(detail.server.storageMb)} disk`} />
            <Field label="Live CPU" value={`${detail.live.cpuPercent.toFixed(1)}%`} />
            <Field label="Live RAM" value={`${detail.live.ramUsedMb} / ${detail.server.ramMb} MB`} />
            <Field label="Players" value={`${detail.live.playersOnline} online / ${detail.server.maxPlayers} max · ${detail.live.playerCount} known`} />
            <Field label="MOTD" value={detail.server.motd} />
            <Field label="Active world" value={detail.server.activeWorld} />
            <Field label="Created" value={new Date(detail.server.createdAt).toLocaleString()} />
            <Field label="Last started" value={detail.server.lastStartedAt ? new Date(detail.server.lastStartedAt).toLocaleString() : "Never"} />
          </div>

          {detail.server.errorMessage && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              Last error: {detail.server.errorMessage}
            </p>
          )}
          {detail.server.description && (
            <p className="rounded-lg border border-slate-800 p-3 text-sm text-slate-400">{detail.server.description}</p>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function AdminServersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const search = useDebouncedValue(searchInput, 300);

  // Filter changes reset pagination directly in the handlers rather than via an
  // effect, so no cascading render is needed.
  function applySearch(value: string) { setSearchInput(value); setPage(1); }
  function applyState(value: string) { setState(value); setPage(1); }
  function clearFilters() { setSearchInput(""); setState(""); setPage(1); }

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set("q", search);
    if (state) params.set("state", state);
    return `/api/admin/servers?${params.toString()}`;
  }, [search, state, page]);

  const { data, error, loading, reload } = useCollection<ServerRow>(url);
  const servers = data?.items ?? [];
  const hasFilters = Boolean(search || state);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs text-slate-400">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchInput}
                onChange={(e) => applySearch(e.target.value)}
                placeholder="Server name or owner"
                className="pl-9"
                aria-label="Search servers"
              />
            </div>
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-slate-400">Status</label>
            <Select value={state} onChange={(e) => applyState(e.target.value)} aria-label="Filter by status">
              <option value="">All states</option>
              {STATE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </div>
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-red-400">Unable to load servers. {error}</p>
          <Button variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      {!error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Server ID</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Software</th>
                  <th className="px-4 py-3">Node</th>
                  <th className="px-4 py-3">RAM</th>
                  <th className="px-4 py-3">CPU</th>
                  <th className="px-4 py-3">Storage</th>
                  <th className="px-4 py-3">Players</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && <TableSkeleton columns={13} />}

                {!loading && servers.map((server) => (
                  <tr key={server.id}>
                    <td className="px-4 py-3 font-medium text-slate-200">{server.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500" title={server.id}>{server.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">{server.ownerUsername}</p>
                      <p className="text-xs text-slate-500">{server.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3"><StatusPill state={server.state} /></td>
                    <td className="px-4 py-3 text-slate-400">{server.mcVersion}</td>
                    <td className="px-4 py-3 text-slate-400">{SOFTWARE_LABEL[server.software] ?? server.software}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">{server.nodeName}</p>
                      <p className="text-xs text-slate-500">{server.nodeRegion}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{server.ramMb} MB</td>
                    <td className="px-4 py-3 text-slate-400">{server.cpuCores} cores</td>
                    <td className="px-4 py-3 text-slate-400">{gigabytes(server.storageMb)}</td>
                    <td className="px-4 py-3 text-slate-400">{server.playersOnline} / {server.maxPlayers}</td>
                    <td className="px-4 py-3 text-slate-500">{timeAgo(server.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ServerActions
                        serverId={server.id}
                        state={server.state}
                        onInspect={() => setInspectId(server.id)}
                        onDone={reload}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && servers.length === 0 && (
            <div className="p-4">
              <EmptyState
                icon={<ServerIcon className="h-8 w-8 text-slate-600" />}
                title={hasFilters ? "No servers match your filters." : "No servers found."}
                description={hasFilters ? "Try a different search term or status." : "Servers created by any user will appear here."}
                action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
              />
            </div>
          )}

          {!loading && (
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0}
              onPageChange={setPage}
              itemLabel="server"
            />
          )}
        </Card>
      )}

      <ServerInspectDialog serverId={inspectId} onClose={() => setInspectId(null)} />
    </div>
  );
}