import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell user={{ username: user.username, role: user.role }} variant="user">
      {children}
    </DashboardShell>
  );
}
