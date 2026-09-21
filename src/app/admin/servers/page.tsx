import { requireAdmin } from "@/lib/server/auth";
import { AdminServersClient } from "@/components/admin-servers-client";

export default async function AdminServersPage() {
  // Server-side guard — see AdminUsersPage for the rationale.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Servers</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every Minecraft server on the platform, with owner, node and lifecycle controls.
        </p>
      </div>
      <AdminServersClient />
    </div>
  );
}