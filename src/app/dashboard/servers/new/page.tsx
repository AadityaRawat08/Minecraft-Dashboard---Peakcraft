import { db } from "@/db";
import { servers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { MINECRAFT_VERSIONS, SERVER_SOFTWARE, REGIONS } from "@/lib/minecraft/provider";
import { CreateServerWizard } from "@/components/create-server-wizard";

export default async function NewServerPage() {
  const user = await requireUser();
  const existingCount = (await db.select().from(servers).where(eq(servers.ownerId, user.id))).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Create a new server</h1>
        <p className="mt-1 text-sm text-slate-400">Follow the steps below to provision a new Minecraft server.</p>
      </div>
      <CreateServerWizard
        versions={MINECRAFT_VERSIONS}
        software={SERVER_SOFTWARE}
        regions={REGIONS}
        maxServers={user.maxServers}
        existingCount={existingCount}
      />
    </div>
  );
}
