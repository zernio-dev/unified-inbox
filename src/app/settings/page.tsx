'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  classifyApiError,
  InboxAddonScreen,
  SetupScreen,
} from '@/components/error-screens';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts, useSaveSettings } from '@/hooks/useAccounts';
import { cn } from '@/lib/utils';
import type { Account, Profile } from '@/lib/types';

interface ProfileGroup {
  id: string;
  name: string;
  accounts: Account[];
}

function groupByProfile({
  accounts,
  profiles,
}: {
  accounts: Account[];
  profiles: Profile[];
}): ProfileGroup[] {
  const namesById = new Map(profiles.map((p) => [p._id, p.name]));
  const groups = new Map<string, ProfileGroup>();
  for (const account of accounts) {
    const ref = account.profileId;
    const id = typeof ref === 'string' ? ref : (ref?._id ?? 'default');
    const name =
      (typeof ref === 'object' && ref !== null ? ref.name : namesById.get(id)) || 'Default';
    const group = groups.get(id) ?? { id, name, accounts: [] };
    group.accounts.push(account);
    groups.set(id, group);
  }
  return [...groups.values()];
}

function AccountRow({
  account,
  checked,
  onToggle,
}: {
  account: Account;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--chat-hover)]',
        !checked && 'opacity-60',
      )}
    >
      <PlatformIcon platform={account.platform} className="flex-none" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {account.displayName || account.username || account._id}
        </span>
        {account.username && account.displayName && (
          <span className="block truncate text-xs text-muted-foreground">@{account.username}</span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 flex-none accent-primary"
      />
    </label>
  );
}

export default function SettingsPage() {
  const { accounts, profiles, selectedAccountIds, isLoading, isFetching, error, refetch } =
    useAccounts();
  const saveSettings = useSaveSettings();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync local selection from server data, but never clobber in-progress edits
  // (background refetches land while the user is toggling checkboxes).
  useEffect(() => {
    if (isLoading || error || dirty) return;
    setSelectedIds(selectedAccountIds);
  }, [isLoading, error, dirty, selectedAccountIds]);

  const groups = useMemo(() => groupByProfile({ accounts, profiles }), [accounts, profiles]);

  const errorScreen = classifyApiError(error);
  if (errorScreen === 'setup') return <SetupScreen />;
  if (errorScreen === 'addon') return <InboxAddonScreen trialAvailable={error?.trialAvailable} />;

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
    setDirty(true);
  };

  const save = () => {
    saveSettings.mutate(selectedIds, {
      onSuccess: () => {
        setDirty(false);
        toast.success('Settings saved');
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to save settings');
      },
    });
  };

  return (
    <div className="h-dvh overflow-y-auto bg-[var(--chat-canvas)]">
      <div className="mx-auto max-w-2xl px-4 pb-12">
        <header className="flex h-14 items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label="Back to inbox">
            <Link href="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="flex-1 text-base font-semibold tracking-tight">Settings</h1>
          <ThemeToggle />
        </header>

        <section className="mt-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold">Tracked accounts</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Conversations are loaded for checked accounts only.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch({ refresh: true })}
              disabled={isFetching}
              aria-label="Refresh accounts"
            >
              <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)]">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No messaging accounts connected. Connect accounts in your{' '}
                <a
                  href="https://zernio.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Zernio dashboard
                </a>{' '}
                first.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.id}>
                  <div className="border-b border-[var(--chat-border)] bg-[var(--chat-input)] px-4 py-1.5 text-xs font-medium text-muted-foreground">
                    {group.name}
                  </div>
                  <div className="divide-y divide-[var(--chat-border)]">
                    {group.accounts.map((account) => (
                      <AccountRow
                        key={account._id}
                        account={account}
                        checked={selectedIds.includes(account._id)}
                        onToggle={() => toggle(account._id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button onClick={save} disabled={!dirty || saveSettings.isPending}>
              {saveSettings.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Theme</h2>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Light, dark, or follow your system preference.
            </p>
            <ThemeToggle />
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          unified-inbox is open source —{' '}
          <a
            href="https://github.com/zernio-dev/unified-inbox"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
          >
            github.com/zernio-dev/unified-inbox
          </a>
        </p>
      </div>
    </div>
  );
}
