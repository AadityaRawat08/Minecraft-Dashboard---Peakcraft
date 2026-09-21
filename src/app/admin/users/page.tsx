import { requireAdmin } from "@/lib/server/auth";
import { AdminUsersClient } from "@/components/admin-users-client";

export default async function AdminUsersPage() {
  // Server-side guard: non-admins are redirected by the admin layout and a
  // direct hit on this route is rejected here as well — the sidebar simply
  // hiding the link is never treated as authorisation.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">Every account on the platform, their role, status and servers.</p>
      </div>
      <AdminUsersClient />
    </div>
  );
}