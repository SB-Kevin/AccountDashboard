"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Account = {
  id: string;
  threadsUserId: string;
  username: string;
  displayName: string | null;
  notes: string | null;
  tokenExpiresAt: string | null;
};

export default function AccountsManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function saveAccount(id: string, displayName: string, notes: string) {
    setPending(true);
    try {
      await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName || null, notes: notes || null }),
      });
      setEditingId(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function removeAccount(id: string) {
    if (!confirm("Remove this Threads account from the dashboard?")) return;
    setPending(true);
    try {
      await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-black/60 dark:text-white/60">
        No accounts linked yet. Click &ldquo;Link Threads account&rdquo; above to connect one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/10 dark:divide-white/10">
      {accounts.map((account) => (
        <li key={account.id} className="px-5 py-4">
          {editingId === account.id ? (
            <EditForm
              account={account}
              pending={pending}
              onCancel={() => setEditingId(null)}
              onSave={(displayName, notes) => saveAccount(account.id, displayName, notes)}
            />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">
                  @{account.username}
                  {account.displayName ? (
                    <span className="ml-2 text-sm text-black/60 dark:text-white/60">
                      {account.displayName}
                    </span>
                  ) : null}
                </div>
                {account.notes ? (
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60">{account.notes}</p>
                ) : null}
                <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                  Threads user id: {account.threadsUserId}
                  {account.tokenExpiresAt
                    ? ` · token expires ${new Date(account.tokenExpiresAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => setEditingId(account.id)}
                >
                  Edit
                </button>
                <button
                  className="text-red-600 hover:underline"
                  disabled={pending}
                  onClick={() => removeAccount(account.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function EditForm({
  account,
  pending,
  onCancel,
  onSave,
}: {
  account: Account;
  pending: boolean;
  onCancel: () => void;
  onSave: (displayName: string, notes: string) => void;
}) {
  const [displayName, setDisplayName] = useState(account.displayName ?? "");
  const [notes, setNotes] = useState(account.notes ?? "");

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm">
        Label
        <input
          className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Brand account"
        />
      </label>
      <label className="text-sm">
        Notes
        <textarea
          className="mt-1 w-full rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>
      <div className="flex gap-3 text-sm">
        <button
          className="text-blue-600 hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={() => onSave(displayName, notes)}
        >
          Save
        </button>
        <button className="text-black/60 hover:underline dark:text-white/60" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
