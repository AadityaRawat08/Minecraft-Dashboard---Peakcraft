import { requireAdmin } from "@/lib/server/auth";
import { AdminAuditLogsClient } from "@/components/admin-audit-logs-client";

export default async function AdminAuditLogsPage() {
  // Server-side guard — see AdminUsersPage for the rationale.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Recorded platform activity: logins, server lifecycle, files, backups and admin actions.
        </p>
      </div>
      <AdminAuditLogsClient />
    </div>
  );
}