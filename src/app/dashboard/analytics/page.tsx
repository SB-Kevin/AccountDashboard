import { prisma } from "@/lib/prisma";
import AnalyticsView from "@/components/AnalyticsView";

export default async function AnalyticsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, displayName: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Pull the latest Threads insights and track engagement trends per account.
        </p>
      </div>
      <AnalyticsView accounts={accounts} />
    </div>
  );
}
