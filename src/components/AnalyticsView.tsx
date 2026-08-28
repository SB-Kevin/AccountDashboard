"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Account = { id: string; username: string; displayName: string | null };
type Snapshot = {
  id: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followersCount: number;
  capturedAt: string;
};

export default function AnalyticsView({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSnapshots(id: string): Promise<Snapshot[]> {
    if (!id) return [];
    const res = await fetch(`/api/analytics/${id}`);
    const body = await res.json();
    return body.snapshots ?? [];
  }

  useEffect(() => {
    let ignore = false;
    fetchSnapshots(accountId).then((data) => {
      if (!ignore) setSnapshots(data);
    });
    return () => {
      ignore = true;
    };
  }, [accountId]);

  async function refresh() {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/${accountId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to refresh");
      } else {
        setSnapshots(await fetchSnapshots(accountId));
      }
    } finally {
      setLoading(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Link a Threads account first to see analytics.
      </p>
    );
  }

  const latest = snapshots.at(-1);
  const chartData = snapshots.map((s) => ({
    date: new Date(s.capturedAt).toLocaleDateString(),
    Views: s.views,
    Likes: s.likes,
    Replies: s.replies,
    Reposts: s.reposts,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="rounded border border-black/20 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.username} {a.displayName ? `(${a.displayName})` : ""}
            </option>
          ))}
        </select>
        <button
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh from Threads"}
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Followers", value: latest?.followersCount },
          { label: "Views", value: latest?.views },
          { label: "Likes", value: latest?.likes },
          { label: "Replies", value: latest?.replies },
          { label: "Reposts", value: latest?.reposts },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <div className="text-2xl font-semibold">{stat.value ?? "–"}</div>
            <div className="mt-1 text-xs text-black/60 dark:text-white/60">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">Engagement over time</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            No snapshots yet. Click &ldquo;Refresh from Threads&rdquo; to pull the latest insights.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Views" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="Likes" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="Replies" stroke="#d97706" strokeWidth={2} />
                <Line type="monotone" dataKey="Reposts" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
