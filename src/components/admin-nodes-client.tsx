"use client";

import { useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, Progress } from "@/components/ui";
import { AddNodeForm, NodeActions, TableSkeleton } from "@/components/admin-panel";
import { useCollection } from "@/lib/client/collection";
import { RefreshCw, Server as ServerIcon } from "lucide-react";

type NodeSummary = {
  id: string;
  name: string;
  region: string;
  status: string;
  ramCapacityMb: number;
  cpuCapacityCores: number;
  diskCapacityMb: number;
  usedRamMb: number;
  usedCpuCores: number;
  usedDiskMb: number;
  serverCount: number;
  runningServerCount: number;
  ramPercent: number;
  cpuPercent: number;
  diskPercent: number;
  health: string;
  createdAt: string;
};

type NodesResponse = {
  items: NodeSummary[];
  agent: { available: true; host: string; agentVersion: string; lastHeartbeatAt: string } | { available: false; reason: string };
};

const HEALTH_TONE: Record<string, "success" | "warning" | "info" | "danger"> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  MAINTENANCE: "info",
  DOWN: "danger",
};

const STATUS_TONE: Record<string, "success" | "warning" | "info"> = {
  ONLINE: "success",
  MAINTENANCE: "warning",
  OFFLINE: "info",
};

function pressureTone(percent: number): "default" | "warning" | "danger" {
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "default";
}

function megabytes(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-slate-200">{value}</div>
    </div>
  );
}

/**
 * Node detail dialog. Everything shown here comes from the node inventory API
 * (or is explicitly reported as unavailable) — no invented host data.
 */
function NodeDetailsDialog({
  node, agent, onClose,
}: {
  node: NodeSummary | null;
  agent: NodesResponse["agent"] | undefined;
  onClose: () => void;
}) {
  if (!node) return null;

  return (
    <Modal open onClose={onClose} title={`Node: ${node.name}`}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Node ID" value={<span className="break-all font-mono text-xs">{node.id}</span>} />
          <Field label="Location" value={node.region} />
          <Field label="Status" value={<Badge tone={STATUS_TONE[node.status] ?? "info"}>{node.status}</Badge>} />
          <Field label="Health" value={<Badge tone={HEALTH_TONE[node.health] ?? "info"}>{node.health}</Badge>} />
          <Field
            label="Host / IP"
            value={agent?.available
              ? <span className="font-mono text-xs">{agent.host}</span>
              : <span className="text-slate-500">Not configured</span>}
          />
          <Field label="Server count" value={`${node.serverCount} total · ${node.runningServerCount} running`} />
          <Field label="CPU capacity" value={`${node.cpuCapacityCores} cores`} />
          <Field label="RAM capacity" value={megabytes(node.ramCapacityMb)} />
          <Field label="Disk capacity" value={megabytes(node.diskCapacityMb)} />
          <Field label="Registered" value={node.createdAt ? new Date(node.createdAt).toLocaleString() : "—"} />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-800 p-3">
          <p className="font-medium text-slate-200">Allocated resources</p>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400"><span>CPU</span><span>{node.usedCpuCores} / {node.cpuCapacityCores} cores ({node.cpuPercent}%)</span></div>
            <Progress value={node.cpuPercent} tone={pressureTone(node.cpuPercent)} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400"><span>RAM</span><span>{megabytes(node.usedRamMb)} / {megabytes(node.ramCapacityMb)} ({node.ramPercent}%)</span></div>
            <Progress value={node.ramPercent} tone={pressureTone(node.ramPercent)} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Disk</span><span>{megabytes(node.usedDiskMb)} / {megabytes(node.diskCapacityMb)} ({node.diskPercent}%)</span></div>
            <Progress value={node.diskPercent} tone={pressureTone(node.diskPercent)} />
          </div>
        </div>

        {agent && !agent.available && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">{agent.reason}</p>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

export function AdminNodesClient() {
  const { data, error, loading, reload } = useCollection<NodeSummary, NodesResponse>("/api/admin/nodes");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const nodes = data?.items ?? [];
  const agent = data?.agent;
  const selectedNode = nodes.find((node) => node.id === detailsId) ?? null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="mb-3 text-sm font-medium text-slate-300">Add a hosting node</p>
        <AddNodeForm onDone={reload} />
      </Card>

      {agent && !agent.available && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-300">
            <span className="font-medium">Node agent unavailable.</span> {agent.reason}
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            Node status and capacity below come from the platform database. Live host metrics (real CPU/RAM usage,
            host names and heartbeats) require the agent, so they are shown as unknown rather than guessed.
          </p>
        </Card>
      )}

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-red-400">Unable to load nodes. {error}</p>
          <Button variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      {!error && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium text-slate-300">Hosting nodes</p>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh health
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Node</th>
                  <th className="px-4 py-3">Node ID</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Host / IP</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">CPU allocated</th>
                  <th className="px-4 py-3">RAM allocated</th>
                  <th className="px-4 py-3">Disk allocated</th>
                  <th className="px-4 py-3">Servers</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && <TableSkeleton columns={11} />}

                {!loading && nodes.map((node) => (
                  <tr key={node.id}>
                    <td className="px-4 py-3 font-medium text-slate-200">{node.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500" title={node.id}>{node.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{node.region}</td>
                    <td className="px-4 py-3">
                      {agent?.available
                        ? <span className="font-mono text-xs text-slate-400">{agent.host}</span>
                        : <span className="text-xs text-slate-500" title={agent?.reason}>Unknown</span>}
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[node.status] ?? "info"}>{node.status}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={HEALTH_TONE[node.health] ?? "info"}>{node.health}</Badge></td>
                    <td className="w-40 px-4 py-3">
                      <p className="mb-1 text-xs text-slate-400">{node.usedCpuCores}/{node.cpuCapacityCores} cores · {node.cpuPercent}%</p>
                      <Progress value={node.cpuPercent} tone={pressureTone(node.cpuPercent)} />
                    </td>
                    <td className="w-40 px-4 py-3">
                      <p className="mb-1 text-xs text-slate-400">{megabytes(node.usedRamMb)}/{megabytes(node.ramCapacityMb)} · {node.ramPercent}%</p>
                      <Progress value={node.ramPercent} tone={pressureTone(node.ramPercent)} />
                    </td>
                    <td className="w-40 px-4 py-3">
                      <p className="mb-1 text-xs text-slate-400">{megabytes(node.usedDiskMb)}/{megabytes(node.diskCapacityMb)} · {node.diskPercent}%</p>
                      <Progress value={node.diskPercent} tone={pressureTone(node.diskPercent)} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {node.serverCount} total
                      <span className="block text-xs text-slate-500">{node.runningServerCount} running</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setDetailsId(node.id)}>View</Button>
                        <NodeActions nodeId={node.id} status={node.status} serverCount={node.serverCount} onDone={reload} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && nodes.length === 0 && (
            <div className="p-4">
              <EmptyState
                icon={<ServerIcon className="h-8 w-8 text-slate-600" />}
                title="No hosting nodes configured."
                description="Add a node above to start placing Minecraft servers on it."
              />
            </div>
          )}
        </Card>
      )}

      <NodeDetailsDialog node={selectedNode} agent={agent} onClose={() => setDetailsId(null)} />
    </div>
  );
}