import { redirect } from "next/navigation";
import { getCurrentUser, isAdminRole } from "@/lib/server/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/dashboard");

  return (
    <DashboardShell user={{ username: user.username, role: user.role }} variant="admin">
      {children}
    </DashboardShell>
  );
}
