"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select } from "@/components/ui";
import { Pagination, TableSkeleton } from "@/components/admin-panel";
import { useCollection, useDebouncedValue } from "@/lib/client/collection";
import { RefreshCw, ScrollText, Search } from "lucide-react";

const PAGE_SIZE = 25;

type AuditLogRow = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
  userId: string | null;
  username: string | null;
  serverId: string | null;
  serverName: string | null;
};

type AuditLogsResponse = {
  items: AuditLogRow[];
  actions: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Tone = "default" | "success" | "warning" | "danger" | "info";

function actionTone(action: string): Tone {
  if (action.includes("DELETE") || action.includes("KILL") || action.includes("SUSPENDED")) return "danger";
  if (action.startsWith("ADMIN_")) return "warning";
  if (action.includes("CREATED") || action.includes("START") || action.includes("RESTORE") || action.includes("LOGIN")) return "success";
  if (action.includes("STOP")) return "info";
  return "default";
}

/**
 * Classifies the actor/target a log line refers to. The audit model stores an
 * action string plus optional user/server ids rather than a separate resource
 * table, so the resource label is derived deterministically from those fields.
 */
function resourceFor(action: string, serverId: string | null): string {
  if (action.startsWith("ADMIN_USER")) return "User";
  if (action.startsWith("ADMIN_NODE")) return "Node";
  if (serverId) return "Server";
  if (action.startsWith("LOGIN") || action.startsWith("LOGOUT") || action.includes("SESSION")) return "Session";
  return "Platform";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) return "No additional metadata recorded.";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "Metadata could not be displayed.";
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-slate-200">{value}</div>
    </div>
  );
}

function AuditEventDialog({ event, onClose }: { event: AuditLogRow | null; onClose: () => void }) {
  if (!event) return null;

  return (
    <Modal open onClose={onClose} title="Audit event details">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event ID" value={<span className="font-mono text-xs">{event.id}</span>} />
          <Field label="Timestamp" value={formatTimestamp(event.createdAt)} />
          <Field label="Action" value={<Badge tone={actionTone(event.action)}>{event.action}</Badge>} />
          <Field label="Resource" value={resourceFor(event.action, event.serverId)} />
          <Field label="User" value={event.username ?? <span className="text-slate-500">System</span>} />
          <Field label="User ID" value={event.userId ? <span className="break-all font-mono text-xs">{event.userId}</span> : <span className="text-slate-500">—</span>} />
          <Field label="Server" value={event.serverName ?? <span className="text-slate-500">—</span>} />
          <Field label="Server ID" value={event.serverId ? <span className="break-all font-mono text-xs">{event.serverId}</span> : <span className="text-slate-500">—</span>} />
          <Field label="Source IP" value={event.ip ?? <span className="text-slate-500">—</span>} />
          <Field label="Result" value={<Badge tone="success">Recorded</Badge>} />
        </div>

        <div>
          <p className="mb-1 text-xs text-slate-500">Metadata</p>
          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
            {formatMetadata(event.metadata)}
          </pre>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

export function AdminAuditLogsClient() {
  const [searchInput, setSearchInput] = useState("");
  const [action, setAction] = useState("");
  const [userInput, setUserInput] = useState("");
  const [serverInput, setServerInput] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const search = useDebouncedValue(searchInput, 300);
  const user = useDebouncedValue(userInput, 300);
  const server = useDebouncedValue(serverInput, 300);

  // Filter changes reset pagination directly in the handlers rather than via an
  // effect, so no cascading render is needed.
  function applySearch(value: string) { setSearchInput(value); setPage(1); }
  function applyAction(value: string) { setAction(value); setPage(1); }
  function applyUser(value: string) { setUserInput(value); setPage(1); }
  function applyServer(value: string) { setServerInput(value); setPage(1); }
  function applyFromDate(value: string) { setFromDate(value); setPage(1); }
  function applyToDate(value: string) { setToDate(value); setPage(1); }

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set("q", search);
    if (action) params.set("action", action);
    if (user) params.set("user", user);
    if (server) params.set("server", server);
    if (fromDate) params.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
    if (toDate) params.set("to", new Date(`${toDate}T23:59:59.999`).toISOString());
    return `/api/admin/audit-logs?${params.toString()}`;
  }, [search, action, user, server, fromDate, toDate, page]);

  const { data, error, loading, reload } = useCollection<AuditLogRow, AuditLogsResponse>(url);
  const events = data?.items ?? [];
  const hasFilters = Boolean(search || action || user || server || fromDate || toDate);

  function clearFilters() {
    setSearchInput("");
    setAction("");
    setUserInput("");
    setServerInput("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs text-slate-400">Search actions</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchInput}
                onChange={(e) => applySearch(e.target.value)}
                placeholder="e.g. SERVER_STARTED"
                className="pl-9"
                aria-label="Search audit actions"
              />
            </div>
          </div>
          <div className="w-52">
            <label className="mb-1 block text-xs text-slate-400">Action</label>
            <Select value={action} onChange={(e) => applyAction(e.target.value)} aria-label="Filter by action">
              <option value="">All actions</option>
              {(data?.actions ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-slate-400">User</label>
            <Input value={userInput} onChange={(e) => applyUser(e.target.value)} placeholder="Username" aria-label="Filter by user" />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-slate-400">Server</label>
            <Input value={serverInput} onChange={(e) => applyServer(e.target.value)} placeholder="Server name" aria-label="Filter by server" />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-slate-400">From</label>
            <Input type="date" value={fromDate} onChange={(e) => applyFromDate(e.target.value)} aria-label="Filter from date" />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-slate-400">To</label>
            <Input type="date" value={toDate} onChange={(e) => applyToDate(e.target.value)} aria-label="Filter to date" />
          </div>
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {hasFilters && <Button variant="ghost" onClick={clearFilters}>Clear</Button>}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          The audit model stores completed actions. Failed attempts are reported to the operator console and are not persisted here.
        </p>
      </Card>

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-red-400">Unable to load audit logs. {error}</p>
          <Button variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      {!error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && <TableSkeleton columns={8} />}

                {!loading && events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-400">
                      {formatTimestamp(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{event.username ?? "system"}</td>
                    <td className="px-4 py-3"><Badge tone={actionTone(event.action)}>{event.action}</Badge></td>
                    <td className="px-4 py-3 text-slate-400">{resourceFor(event.action, event.serverId)}</td>
                    <td className="px-4 py-3 text-slate-400">{event.serverName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">{event.ip ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3"><Badge tone="success">Recorded</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(event)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && events.length === 0 && (
            <div className="p-4">
              <EmptyState
                icon={<ScrollText className="h-8 w-8 text-slate-600" />}
                title="No audit events found."
                description={hasFilters ? "Try widening the date range or clearing your filters." : "Platform activity will be recorded here."}
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
              itemLabel="event"
            />
          )}
        </Card>
      )}

      <AuditEventDialog event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}