import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const [accountCount, scheduledCount, publishedCount] = await Promise.all([
    prisma.account.count(),
    prisma.post.count({ where: { status: "SCHEDULED" } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
  ]);

  const recentAccounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, username: true, displayName: true, createdAt: true },
  });

  const stats = [
    { label: "Linked accounts", value: accountCount },
    { label: "Scheduled posts", value: scheduledCount },
    { label: "Published posts", value: publishedCount },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Manage your Threads accounts, publish content, and track performance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-black/10 p-5 dark:border-white/10"
          >
            <div className="text-3xl font-semibold">{stat.value}</div>
            <div className="mt-1 text-sm text-black/60 dark:text-white/60">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-3 dark:border-white/10">
          <h2 className="font-medium">Recently linked accounts</h2>
          <Link href="/dashboard/accounts" className="text-sm text-blue-600 hover:underline">
            Manage accounts
          </Link>
        </div>
        {recentAccounts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-black/60 dark:text-white/60">
            No Threads accounts linked yet.{" "}
            <Link href="/dashboard/accounts" className="text-blue-600 hover:underline">
              Link your first account
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {recentAccounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between px-5 py-3">
                <span className="font-medium">@{account.username}</span>
                <span className="text-sm text-black/60 dark:text-white/60">
                  {account.displayName ?? "No label"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
