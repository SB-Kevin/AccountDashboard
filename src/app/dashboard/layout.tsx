import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/accounts", label: "Accounts" },
  { href: "/dashboard/compose", label: "Compose" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold">Threads Dashboard</span>
          <nav className="flex gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
