import { prisma } from "@/lib/prisma";
import ComposeForm from "@/components/ComposeForm";

export default async function ComposePage() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, displayName: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Compose</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Publish immediately or schedule a post for one of your linked accounts.
        </p>
      </div>
      <ComposeForm accounts={accounts} />
    </div>
  );
}
