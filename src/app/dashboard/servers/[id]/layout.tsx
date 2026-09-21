import { notFound, redirect } from "next/navigation";
import { requireUser, ApiError } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ServerDetailChrome } from "@/components/server-detail-chrome";

export default async function ServerDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  const { id } = await params;

  try {
    const server = await getServerForUser(user, id);
    return (
      <div>
        <ServerDetailChrome serverId={server.id} name={server.name} initialState={server.state} />
        {children}
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 403) redirect("/dashboard/servers");
    throw err;
  }
}
