"use client";

import { useEffect, useState } from "react";

type Account = { id: string; username: string; displayName: string | null };
type Post = {
  id: string;
  text: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED";
  scheduledFor: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export default function ComposeForm({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [text, setText] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  async function fetchPosts(id: string): Promise<Post[]> {
    if (!id) return [];
    const res = await fetch(`/api/posts?accountId=${id}`);
    const body = await res.json();
    return body.posts ?? [];
  }

  useEffect(() => {
    let ignore = false;
    fetchPosts(accountId).then((data) => {
      if (!ignore) setPosts(data);
    });
    return () => {
      ignore = true;
    };
  }, [accountId]);

  async function submit() {
    if (!accountId || !text.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          text,
          scheduledFor: schedule && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(`Failed: ${body.error ?? "unknown error"}`);
      } else {
        setMessage(
          body.post.status === "SCHEDULED" ? "Post scheduled." : "Post published to Threads."
        );
        setText("");
        setSchedule(false);
        setScheduledFor("");
      }
      setPosts(await fetchPosts(accountId));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelPost(id: string) {
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts(await fetchPosts(accountId));
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Link a Threads account first before composing posts.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-5 dark:border-white/10">
        <label className="text-sm">
          Account
          <select
            className="mt-1 w-full rounded border border-black/20 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.username} {a.displayName ? `(${a.displayName})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Text
          <textarea
            className="mt-1 w-full rounded border border-black/20 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent"
            rows={4}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
          />
          <span className="mt-1 block text-xs text-black/40 dark:text-white/40">
            {text.length}/500
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
          Schedule for later
        </label>
        {schedule ? (
          <input
            type="datetime-local"
            className="rounded border border-black/20 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        ) : null}

        <button
          className="mt-2 self-start rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
          disabled={submitting || !text.trim()}
          onClick={submit}
        >
          {schedule ? "Schedule post" : "Publish now"}
        </button>
        {message ? <p className="text-sm">{message}</p> : null}
      </div>

      <div>
        <h2 className="mb-3 font-medium">Recent posts for this account</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No posts yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge status={post.status} />
                  {post.status === "SCHEDULED" || post.status === "FAILED" ? (
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => cancelPost(post.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{post.text}</p>
                <p className="mt-2 text-xs text-black/40 dark:text-white/40">
                  {post.status === "SCHEDULED" && post.scheduledFor
                    ? `Scheduled for ${new Date(post.scheduledFor).toLocaleString()}`
                    : post.publishedAt
                      ? `Published ${new Date(post.publishedAt).toLocaleString()}`
                      : `Created ${new Date(post.createdAt).toLocaleString()}`}
                  {post.errorMessage ? ` · ${post.errorMessage}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Post["status"] }) {
  const colors: Record<Post["status"], string> = {
    DRAFT: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    SCHEDULED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    PUBLISHED: "bg-green-500/10 text-green-600 dark:text-green-400",
    FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{status}</span>
  );
}
