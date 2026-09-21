import { requireAdmin } from "@/lib/server/auth";
import { AdminNodesClient } from "@/components/admin-nodes-client";

export default async function AdminNodesPage() {
  // Server-side guard — see AdminUsersPage for the rationale.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Nodes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Hosting nodes that Minecraft servers are placed on, with capacity allocation and health.
        </p>
      </div>
      <AdminNodesClient />
    </div>
  );
}