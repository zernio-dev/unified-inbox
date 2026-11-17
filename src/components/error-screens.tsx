'use client';

import { Inbox, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/lib/api-client';

/**
 * Map an API failure to the full-screen state it should render. The addon
 * screen is gated on the stable code, not bare 403 (a 403 can also mean a
 * permission/ownership problem that the generic error path should handle).
 */
export function classifyApiError(error: ApiError | null): 'setup' | 'addon' | null {
  if (!error) return null;
  if (error.code === 'INBOX_REQUIRED') return 'addon';
  if (error.status === 401 || error.code === 'missing_api_key') return 'setup';
  return null;
}

function FullScreenCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-[var(--chat-canvas)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[var(--chat-input)] px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  );
}

export function SetupScreen() {
  return (
    <FullScreenCard>
      <div className="mb-6 flex items-center gap-2.5">
        <KeyRound className="size-5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Caixa de Entrada</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Add your API key</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This app talks to the messaging API. It needs a key before it can load your inbox.
      </p>
      <ol className="mt-6 space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex size-5 flex-none items-center justify-center rounded-full bg-[var(--chat-input)] text-xs font-medium">
            1
          </span>
          <span>
            Get an API key from your settings dashboard
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-5 flex-none items-center justify-center rounded-full bg-[var(--chat-input)] text-xs font-medium">
            2
          </span>
          <span className="min-w-0">
            Run <Code>cp .env.example .env.local</Code> and set <Code>ZERNIO_API_KEY</Code>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-5 flex-none items-center justify-center rounded-full bg-[var(--chat-input)] text-xs font-medium">
            3
          </span>
          <span>Restart the dev server</span>
        </li>
      </ol>
    </FullScreenCard>
  );
}

export function InboxAddonScreen({ trialAvailable }: { trialAvailable?: boolean }) {
  return (
    <FullScreenCard>
      <div className="mb-6 flex items-center gap-2.5">
        <Inbox className="size-5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Caixa de Entrada</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        Your account needs the Inbox add-on
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reading and sending messages requires the Inbox add-on on your plan.
        {trialAvailable
          ? ' A free trial is available, enable it from your dashboard and reload this page.'
          : ' Enable it from your dashboard and reload this page.'}
      </p>
      <Button asChild className="mt-6 w-full">
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </Button>
    </FullScreenCard>
  );
}

export function RateLimitBanner() {
  // Apenas oculta a exibição da mensagem visual; a lógica interna de pause/backoff é mantida no cliente de API.
  return null;
}
