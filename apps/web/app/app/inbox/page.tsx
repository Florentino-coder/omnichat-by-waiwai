import { Suspense } from "react";
import InboxClient, { type InboxConversation } from "./inbox-client";
import { readAccessTokenFromCookies } from "../../lib/auth-cookies.server";
import { readApiBaseUrl } from "../../lib/api-proxy.server";

const CONVERSATION_PAGE_SIZE = 10;

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error?: {
        message?: string;
      };
    };

function InboxShellSkeleton() {
  return (
    <section className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6 py-4">
        <div className="h-6 w-36 rounded-md bg-secondary" />
        <div className="h-8 w-28 rounded-md bg-secondary" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,21rem)]">
        <div className="hidden border-r border-border bg-white p-4 md:block">
          <div className="mb-4 h-9 rounded-md bg-secondary" />
          <div className="grid gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-20 rounded-md bg-secondary" />
            ))}
          </div>
        </div>
        <div className="bg-secondary/50 p-5">
          <div className="mb-5 h-12 rounded-md bg-white" />
          <div className="space-y-3">
            <div className="h-16 w-2/3 rounded-md bg-white" />
            <div className="ml-auto h-16 w-2/3 rounded-md bg-primary/20" />
            <div className="h-12 w-1/2 rounded-md bg-white" />
          </div>
        </div>
        <div className="hidden border-l border-border bg-white p-4 lg:block">
          <div className="mb-4 h-16 rounded-md bg-secondary" />
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded-md bg-secondary" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function InboxPage() {
  const initialConversations = await loadInitialConversations();
  return (
    <Suspense fallback={<InboxShellSkeleton />}>
      <InboxClient initialConversations={initialConversations} />
    </Suspense>
  );
}

async function loadInitialConversations(): Promise<InboxConversation[]> {
  const token = await readAccessTokenFromCookies();
  if (!token) {
    return [];
  }

  const apiBaseUrl = readApiBaseUrl();
  if (!apiBaseUrl) {
    return [];
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/inbox/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=0`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const body = (await response.json().catch(() => null)) as ApiEnvelope<InboxConversation[]> | null;
    if (!response.ok || !body?.success || !Array.isArray(body.data)) {
      return [];
    }
    return body.data;
  } catch {
    return [];
  }
}
