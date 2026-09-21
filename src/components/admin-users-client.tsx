"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, StatusPill } from "@/components/ui";
import { Pagination, TableSkeleton, UserActions } from "@/components/admin-panel";
import { useCollection, useDebouncedValue } from "@/lib/client/collection";
import { timeAgo } from "@/lib/utils";
import { RefreshCw, Search, Users } from "lucide-react";

const ROLE_OPTIONS = ["USER", "SUPPORT", "ADMIN", "SUPER_ADMIN"] as const;
const STATUS_OPTIONS = ["ACTIVE", "SUSPENDED"] as const;
const PAGE_SIZE = 20;

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  maxServers: number;
  createdAt: string;
  serverCount: number;
  lastActiveAt: string | null;
};

type UserDetail = {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    maxServers: number;
    createdAt: string;
    lastLoginAt: string | null;
    eventCount: number;
  };
  servers: Array<{
    id: string;
    name: string;
    state: string;
    software: string;
    mcVersion: string;
    ramMb: number;
    cpuCores: number;
    storageMb: number;
    nodeName: string;
    createdAt: string;
  }>;
};

const ROLE_TONE: Record<string, "info" | "warning" | "danger" | "default"> = {
  USER: "default",
  SUPPORT: "info",
  ADMIN: "warning",
  SUPER_ADMIN: "danger",
};

const SOFTWARE_LABEL: Record<string, string> = {
  VANILLA: "Vanilla", PAPER: "Paper", SPIGOT: "Spigot", PURPUR: "Purpur",
  FABRIC: "Fabric", FORGE: "Forge", NEOFORGE: "NeoForge", QUILT: "Quilt",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-slate-200">{value}</div>
    </div>
  );
}

/** Loads a single user's profile + owned servers for the details dialog. */
function UserDetailsDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    // Loaded inside an async task so state updates never run synchronously
    // from the effect body.
    async function load() {
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const result = await apiFetch<UserDetail>(`/api/admin/users/${userId}`);
        if (active) setDetail(result);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load user.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => { active = false; };
  }, [userId]);

  if (!userId) return null;

  return (
    <Modal open onClose={onClose} title="User details">
      {loading && <p className="text-sm text-slate-400">Loading user…</p>}

      {error && (
        <div className="space-y-3">
          <p className="text-sm text-red-400">{error}</p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      )}

      {detail && (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Username" value={detail.user.username} />
            <Field label="Email" value={detail.user.email} />
            <Field label="User ID" value={<span className="break-all font-mono text-xs">{detail.user.id}</span>} />
            <Field label="Role" value={<Badge tone={ROLE_TONE[detail.user.role] ?? "default"}>{detail.user.role}</Badge>} />
            <Field label="Status" value={<Badge tone={detail.user.status === "ACTIVE" ? "success" : "danger"}>{detail.user.status}</Badge>} />
            <Field label="Server limit" value={String(detail.user.maxServers)} />
            <Field label="Created" value={new Date(detail.user.createdAt).toLocaleString()} />
            <Field label="Last login" value={detail.user.lastLoginAt ? new Date(detail.user.lastLoginAt).toLocaleString() : "Never"} />
            <Field label="Audit events" value={String(detail.user.eventCount)} />
          </div>

          <div>
            <p className="mb-2 font-medium text-slate-200">Servers owned ({detail.servers.length})</p>
            {detail.servers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                This user doesn&apos;t own any servers.
              </p>
            ) : (
              <div className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
                {detail.servers.map((server) => (
                  <div key={server.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <Link href={`/dashboard/servers/${server.id}`} className="font-medium text-slate-200 hover:text-emerald-400">
                        {server.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {SOFTWARE_LABEL[server.software] ?? server.software} · {server.mcVersion} · {server.ramMb}MB · {server.nodeName}
                      </p>
                    </div>
                    <StatusPill state={server.state} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function AdminUsersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const search = useDebouncedValue(searchInput, 300);

  // Filter changes reset pagination directly in the handlers rather than via an
  // effect, so no cascading render is needed.
  function applySearch(value: string) { setSearchInput(value); setPage(1); }
  function applyRole(value: string) { setRole(value); setPage(1); }
  function applyStatus(value: string) { setStatus(value); setPage(1); }
  function clearFilters() { setSearchInput(""); setRole(""); setStatus(""); setPage(1); }

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set("q", search);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    return `/api/admin/users?${params.toString()}`;
  }, [search, role, status, page]);

  const { data, error, loading, reload } = useCollection<UserRow>(url);
  const users = data?.items ?? [];
  const hasFilters = Boolean(search || role || status);

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
                placeholder="Username or email"
                className="pl-9"
                aria-label="Search users"
              />
            </div>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-slate-400">Role</label>
            <Select value={role} onChange={(e) => applyRole(e.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-slate-400">Status</label>
            <Select value={status} onChange={(e) => applyStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </div>
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-red-400">Unable to load users. {error}</p>
          <Button variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      {!error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Servers</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && <TableSkeleton columns={8} />}

                {!loading && users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{user.username}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500" title={user.id}>{user.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3"><Badge tone={ROLE_TONE[user.role] ?? "default"}>{user.role}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-400">{user.serverCount} / {user.maxServers}</td>
                    <td className="px-4 py-3 text-slate-500">{user.lastActiveAt ? timeAgo(user.lastActiveAt) : "No sessions"}</td>
                    <td className="px-4 py-3 text-slate-500">{timeAgo(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <UserActions
                        userId={user.id}
                        status={user.status}
                        onDetails={() => setDetailsId(user.id)}
                        onDone={reload}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && users.length === 0 && (
            <div className="p-4">
              <EmptyState
                icon={<Users className="h-8 w-8 text-slate-600" />}
                title={hasFilters ? "No users match your filters." : "No users found."}
                description={hasFilters ? "Try a different search term, role or status." : "Registered accounts will appear here."}
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
              itemLabel="user"
            />
          )}
        </Card>
      )}

      <UserDetailsDialog userId={detailsId} onClose={() => setDetailsId(null)} />
    </div>
  );
}