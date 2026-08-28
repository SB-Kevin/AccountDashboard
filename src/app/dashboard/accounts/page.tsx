import { prisma } from "@/lib/prisma";
import AccountsManager from "@/components/AccountsManager";

export default async function AccountsPage(props: PageProps<"/dashboard/accounts">) {
  const searchParams = await props.searchParams;
  const linked = typeof searchParams.linked === "string" ? searchParams.linked : null;
  const error = typeof searchParams.error === "string" ? searchParams.error : null;

  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      threadsUserId: true,
      username: true,
      displayName: true,
      notes: true,
      tokenExpiresAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Link and manage the Threads accounts this dashboard controls.
          </p>
        </div>
        <a
          href="/api/auth/threads/start"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Link Threads account
        </a>
      </div>

      {linked ? (
        <div className="rounded border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Linked @{linked} successfully.
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          Failed to link account: {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-black/10 dark:border-white/10">
        <AccountsManager
          accounts={accounts.map((a) => ({
            ...a,
            tokenExpiresAt: a.tokenExpiresAt ? a.tokenExpiresAt.toISOString() : null,
          }))}
        />
      </div>
    </div>
  );
}
