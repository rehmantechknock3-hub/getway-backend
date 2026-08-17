"use client";

import { useMemo, useState } from "react";

import { useAuth } from "@clerk/nextjs";

import {
  useAdminMessageThreads,
  useAdminOpenProviderThread,
  useAdminSendMessage,
  useAdminThreadMessages,
  useAdminUsers,
  useMe,
} from "@repo/api-client";
import { showToast } from "@repo/ui/toast";
import { reportError } from "@repo/utils";

import { EmptyState, PageHeader, Panel } from "../../../components/admin/ui";
import { useAdminApiReady } from "../../../lib/use-admin-api-ready";
import { useDebouncedValue } from "../../../lib/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_CHARS = 2;

function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date instanceof Date ? date : new Date(date));
}

function timeAgo(date: Date | string | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function AdminMessagesPage() {
  const { ready } = useAdminApiReady();
  const { userId: clerkUserId } = useAuth();
  const { data: me } = useMe({ enabled: ready, clerkUserId: clerkUserId ?? undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const debouncedProviderSearch = useDebouncedValue(
    providerSearch.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const canQueryProviders = debouncedProviderSearch.length >= MIN_SEARCH_CHARS;

  const threadsQuery = useAdminMessageThreads(1, { enabled: ready });
  const threads = threadsQuery.data?.data ?? [];
  const conversationId = selectedId ?? threads[0]?.id ?? "";
  const selected = threads.find((t) => t.id === conversationId);

  const providersQuery = useAdminUsers(1, "PROVIDER", {
    enabled: ready && canQueryProviders,
    search: debouncedProviderSearch,
    limit: 20,
  });
  const openThread = useAdminOpenProviderThread();

  const messagesQuery = useAdminThreadMessages(conversationId, 1, {
    enabled: ready && Boolean(conversationId),
  });
  const sendMessage = useAdminSendMessage(conversationId, 1);
  const messages = messagesQuery.data?.data ?? [];
  const myId = me?.id;

  const selectedName = useMemo(() => {
    if (selected) {
      return `${selected.otherPartyFirstName} ${selected.otherPartyLastName}`.trim();
    }
    return pendingName ?? "";
  }, [selected, pendingName]);

  const search = providerSearch.trim().toLowerCase();
  const filteredThreads = useMemo(() => {
    if (!search) return threads;
    return threads.filter((thread) => {
      const name = `${thread.otherPartyFirstName} ${thread.otherPartyLastName}`.toLowerCase();
      const preview = (thread.lastMessageContent ?? "").toLowerCase();
      return name.includes(search) || preview.includes(search);
    });
  }, [threads, search]);

  const extraProviders = useMemo(() => {
    if (!canQueryProviders) return [];
    const threadNames = new Set(
      threads.map((t) => `${t.otherPartyFirstName} ${t.otherPartyLastName}`.trim().toLowerCase()),
    );
    const q = debouncedProviderSearch.toLowerCase();
    return (providersQuery.data?.data ?? []).filter((row) => {
      const name = `${row.firstName} ${row.lastName}`.trim().toLowerCase();
      const email = row.email.toLowerCase();
      if (threadNames.has(name)) return false;
      return name.includes(q) || email.includes(q);
    });
  }, [providersQuery.data?.data, threads, canQueryProviders, debouncedProviderSearch]);

  const searchPending =
    providerSearch.trim() !== debouncedProviderSearch &&
    providerSearch.trim().length >= MIN_SEARCH_CHARS;

  const onOpenProvider = async (providerUserId: string) => {
    const row = providersQuery.data?.data.find((u) => u.id === providerUserId);
    if (!row) return;
    const name = `${row.firstName} ${row.lastName}`.trim() || row.email;
    setPendingName(name);
    setProviderSearch("");
    try {
      const conv = await openThread.mutateAsync({ providerUserId: row.id });
      setSelectedId(conv.id);
    } catch (error: unknown) {
      setPendingName(null);
      reportError(error, { screen: "AdminMessages", action: "openProviderThread" });
      showToast("error", "Could not open that provider chat. Try again.");
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;
    setDraft("");
    setSending(true);
    try {
      await sendMessage.mutateAsync({ content: text, type: "TEXT" });
    } catch (error: unknown) {
      setDraft(text);
      reportError(error, { screen: "AdminMessages", action: "sendMessage" });
      showToast("error", "Could not send message. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Search the provider list and message anyone about payouts or support."
      />

      <Panel>
        {!ready || threadsQuery.isLoading ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">Loading messages…</div>
        ) : threadsQuery.isError ? (
          <EmptyState
            title="Could not load messages"
            description="Refresh and confirm the local API is running."
          />
        ) : (
          <div className="grid min-h-[70vh] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="flex min-h-[70vh] flex-col border-b border-slate-100 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-100 p-3">
                <input
                  value={providerSearch}
                  onChange={(event) => setProviderSearch(event.target.value)}
                  placeholder="Search providers…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-blue"
                  aria-label="Search providers"
                />
              </div>
              <div className="max-h-[70vh] flex-1 overflow-y-auto">
                {filteredThreads.length === 0 && extraProviders.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">
                    {search
                      ? searchPending || providersQuery.isFetching
                        ? "Searching…"
                        : search.length < MIN_SEARCH_CHARS
                          ? "Type at least 2 letters to search all providers."
                          : "No providers match that search."
                      : "No threads yet. Search a provider to start one."}
                  </p>
                ) : (
                  <ul>
                    {filteredThreads.map((thread) => {
                      const name = `${thread.otherPartyFirstName} ${thread.otherPartyLastName}`.trim();
                      const active = thread.id === conversationId;
                      return (
                        <li key={thread.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(thread.id);
                              setPendingName(name);
                            }}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                              active ? "bg-brand-blue/10" : "hover:bg-slate-50"
                            }`}
                          >
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-xs font-semibold text-brand-blue-dark">
                              {(thread.otherPartyFirstName[0] ?? "P").toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold text-slate-900">
                                  {name || "Provider"}
                                </span>
                                <span className="shrink-0 text-[11px] text-slate-400">
                                  {timeAgo(thread.lastMessageAt)}
                                </span>
                              </span>
                              <span className="mt-0.5 flex items-center justify-between gap-2">
                                <span className="truncate text-xs text-slate-500">
                                  {thread.lastMessageContent ?? "No messages yet"}
                                </span>
                                {thread.unreadCount > 0 ? (
                                  <span className="rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {extraProviders.map((row) => {
                      const name = `${row.firstName} ${row.lastName}`.trim() || row.email;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => void onOpenProvider(row.id)}
                            disabled={openThread.isPending}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-xs font-semibold text-brand-blue-dark">
                              {(row.firstName[0] ?? "P").toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {name}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {row.email} · Message
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <section className="flex min-h-[70vh] flex-col">
              {!conversationId ? (
                <div className="flex flex-1 items-center justify-center px-6">
                  <p className="text-center text-sm text-slate-500">
                    Select a thread or search a provider to send a message.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-100 px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedName || "Provider"}
                    </p>
                    <p className="text-xs text-slate-500">WayNow Admin thread</p>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
                    {messagesQuery.isLoading ? (
                      <p className="py-8 text-center text-sm text-slate-500">Loading thread…</p>
                    ) : messages.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">
                        No messages yet. Write below to reach this provider.
                      </p>
                    ) : (
                      messages.map((msg) => {
                        const mine = msg.senderId === myId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                                mine
                                  ? "bg-brand-blue text-white"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              <p className="whitespace-pre-wrap leading-5">{msg.content}</p>
                              <p
                                className={`mt-1 text-right text-[10px] ${
                                  mine ? "text-white/70" : "text-slate-400"
                                }`}
                              >
                                {formatTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    className="flex gap-2 border-t border-slate-100 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onSend();
                    }}
                  >
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={2000}
                      placeholder="Message provider…"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-blue"
                    />
                    <button
                      type="submit"
                      disabled={sending || draft.trim().length === 0}
                      className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </Panel>
    </div>
  );
}
