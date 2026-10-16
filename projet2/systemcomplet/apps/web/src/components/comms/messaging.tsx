"use client";

import clsx from "clsx";
import { ArrowLeft, Check, CheckCheck, Paperclip, Pencil, Phone, Plus, Reply, Search, Send, Trash2, Users, Video, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCalls } from "@/components/calls/call-provider";
import { RefSelect } from "@/components/forms/ref-select";
import { PersonTradeSelect } from "@/components/forms/trade-select";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Avatar, Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, fileSize, relative } from "@/lib/format";
import { REFS } from "@/lib/refs";
import { useRealtime, useRealtimeEvent, useRoom } from "@/lib/realtime";

interface Member {
  user_id: string;
  name: string;
  role?: string;
  online?: boolean;
  last_read_at?: string | null;
}

interface Conversation {
  id: string;
  kind: string;
  title: string;
  project_id?: string | null;
  members: Member[];
  unread: number;
  last_message?: { body: string; at: string; sender_id: string; kind: string } | null;
  last_message_at?: string | null;
}

interface Attachment {
  id: string;
  name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  file_id?: string | null;
  document_version_id?: string | null;
  bim_viewpoint_id?: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender: { id: string; name: string } | null;
  body: string | null;
  kind: string;
  reply_to_id?: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  client_message_id?: string | null;
  attachments: Attachment[];
}

interface Contact {
  id: string;
  name: string;
  job_title?: string | null;
  organization?: string | null;
  online?: boolean;
}

const CHANNEL_KINDS = [
  { value: "project", label: "Équipe du projet" },
  { value: "trade", label: "Corps de métier" },
  { value: "client", label: "Échanges avec le client" },
];

function NewConversation({ open, onClose, onCreated, projectId }: { open: boolean; onClose: () => void; onCreated: (c: Conversation) => void; projectId?: string }) {
  const { user } = useAuth();
  // Canaux de projet : réservés à l'équipe interne (contrôle identique côté serveur).
  const internal = user?.organization?.kind === "internal";
  const [mode, setMode] = useState("people");
  const [channel, setChannel] = useState<{ project: string | null; kind: string; trade: string }>({ project: projectId ?? null, kind: "project", trade: "" });
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api<Contact[]>("/contacts", { query: { q: q || undefined } })
        .then(setContacts)
        .catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);
  useEffect(() => {
    if (open) {
      setSelected([]);
      setTitle("");
      setError(null);
      setMode("people");
      setChannel({ project: projectId ?? null, kind: "project", trade: "" });
    }
  }, [open, projectId]);
  const openChannel = async () => {
    setBusy(true);
    setError(null);
    try {
      const conv = await api<Conversation>("/conversations/project-channel", {
        method: "POST",
        body: { project_id: channel.project, trade: channel.kind === "trade" ? channel.trade : null, client_channel: channel.kind === "client" },
      });
      onCreated(conv);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const conv =
        selected.length === 1 && !title.trim()
          ? await api<Conversation>("/conversations/direct", { method: "POST", body: { user_id: selected[0] } })
          : await api<Conversation>("/conversations", { method: "POST", body: { title: title.trim() || "Groupe", member_ids: selected, project_id: projectId ?? null } });
      onCreated(conv);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle conversation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          {mode === "channel" ? (
            <Button onClick={openChannel} loading={busy} disabled={!channel.project || (channel.kind === "trade" && !channel.trade)}>
              Ouvrir le canal
            </Button>
          ) : (
            <Button onClick={create} loading={busy} disabled={!selected.length || (selected.length > 1 && title.trim().length < 2)}>
              {selected.length > 1 ? "Créer le groupe" : "Démarrer"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {internal ? (
          <Tabs
            value={mode}
            onChange={setMode}
            tabs={[
              { key: "people", label: "Personnes" },
              { key: "channel", label: "Canal de projet" },
            ]}
          />
        ) : null}
        {mode === "channel" ? (
          <>
            <Field label="Projet" required>
              <RefSelect source={REFS.projects} value={channel.project} onChange={(v) => setChannel({ ...channel, project: v ?? null })} />
            </Field>
            <Field label="Canal" required>
              <Select value={channel.kind} onChange={(e) => setChannel({ ...channel, kind: e.target.value })} options={CHANNEL_KINDS} />
            </Field>
            {channel.kind === "trade" ? (
              <Field label="Corps de métier" required>
                <PersonTradeSelect value={channel.trade} onChange={(trade) => setChannel({ ...channel, trade })} placeholder="Choisir…" />
              </Field>
            ) : null}
            <p className="text-xs text-muted">Les membres du projet concernés sont ajoutés automatiquement ; un canal déjà ouvert est simplement rouvert.</p>
          </>
        ) : null}
        {mode === "people" ? (
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne…" autoFocus />
            {selected.length > 1 ? (
              <Field label="Nom du groupe" required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </Field>
            ) : null}
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {contacts.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                      className={clsx("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50", on && "bg-brand-50")}
                    >
                      <span className="relative">
                        <Avatar name={c.name} size={34} />
                        {c.online ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted">{[c.job_title, c.organization].filter(Boolean).join(" · ")}</span>
                      </span>
                      {on ? <Check className="h-4 w-4 text-brand-600" /> : null}
                    </button>
                  </li>
                );
              })}
              {!contacts.length ? <li className="px-3 py-6 text-center text-sm text-muted">Aucun contact joignable</li> : null}
            </ul>
          </>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Modal>
  );
}

/** Messagerie sécurisée temps réel (§13) : conversations directes, de groupe et de projet, pièces jointes, appels. */
export function Messaging({ projectId, canCall = true }: { projectId?: string; canCall?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const calls = useCalls();
  const { send, online } = useRealtime();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [pending, setPending] = useState<{ file_id: string; name: string; mime_type: string; size_bytes: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(() => {
    api<Conversation[]>("/conversations", { query: { project_id: projectId } })
      .then(setConversations)
      .catch((err) => {
        setConversations([]);
        toast.error("Messagerie indisponible", errorMessage(err));
      });
  }, [projectId, toast]);

  useEffect(() => loadConversations(), [loadConversations]);

  const active = useMemo(() => conversations?.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
  useRoom(activeId ? `conversation:${activeId}` : null);

  const markRead = useCallback(
    (conversationId: string, last?: Message) => {
      if (!send("read", { conversation_id: conversationId, message_id: last?.id ?? null })) {
        void api(`/conversations/${conversationId}/read`, { method: "POST", body: { message_id: last?.id ?? null } }).catch(() => undefined);
      }
      setConversations((list) => list?.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) ?? list);
    },
    [send],
  );

  useEffect(() => {
    if (!activeId) return;
    setLoadingMessages(true);
    setMessages([]);
    setReplyTo(null);
    setEditing(null);
    api<{ items: Message[]; has_more: boolean }>(`/conversations/${activeId}/messages`, { query: { limit: 50 } })
      .then((res) => {
        setMessages(res.items);
        setHasMore(res.has_more);
        markRead(activeId, res.items[res.items.length - 1]);
        setTimeout(() => bottom.current?.scrollIntoView(), 50);
      })
      .catch((err) => toast.error("Chargement impossible", errorMessage(err)))
      .finally(() => setLoadingMessages(false));
  }, [activeId, markRead, toast]);

  const loadOlder = async () => {
    if (!activeId || !messages.length) return;
    const res = await api<{ items: Message[]; has_more: boolean }>(`/conversations/${activeId}/messages`, { query: { limit: 50, before: messages[0].created_at } });
    setMessages((m) => [...res.items, ...m]);
    setHasMore(res.has_more);
  };

  useRealtimeEvent("message.new", (m: Message) => {
    if (m.conversation_id === activeId) {
      setMessages((list) => (list.some((x) => x.id === m.id || (m.client_message_id && x.client_message_id === m.client_message_id)) ? list.map((x) => (x.client_message_id && x.client_message_id === m.client_message_id ? m : x)) : [...list, m]));
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 30);
      if (m.sender?.id !== user?.id && document.visibilityState === "visible") markRead(m.conversation_id, m);
    }
    setConversations((list) =>
      list
        ? [...list]
            .map((c) => (c.id === m.conversation_id ? { ...c, last_message: { body: m.body ?? "📎", at: m.created_at, sender_id: m.sender?.id ?? "", kind: m.kind }, last_message_at: m.created_at, unread: c.id === activeId || m.sender?.id === user?.id ? c.unread : c.unread + 1 } : c))
            .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""))
        : list,
    );
  });
  useRealtimeEvent("message.updated", (m: Message) => setMessages((list) => list.map((x) => (x.id === m.id ? m : x))));
  useRealtimeEvent("message.deleted", (d: { id: string }) => setMessages((list) => list.map((x) => (x.id === d.id ? { ...x, body: null, deleted_at: new Date().toISOString(), attachments: [] } : x))));
  useRealtimeEvent("conversation.updated", (d: { conversation_id: string }) => {
    if (!conversations?.some((c) => c.id === d.conversation_id)) loadConversations();
  });
  useRealtimeEvent("typing", (d: { conversation_id: string; user_id: string; name: string; typing: boolean }) => {
    if (d.conversation_id !== activeId) return;
    setTyping((t) => {
      const next = { ...t };
      if (d.typing) next[d.user_id] = d.name;
      else delete next[d.user_id];
      return next;
    });
  });
  useRealtimeEvent("read", (d: { conversation_id: string; user_id: string; at: string }) => {
    setConversations((list) => list?.map((c) => (c.id === d.conversation_id ? { ...c, members: c.members.map((m) => (m.user_id === d.user_id ? { ...m, last_read_at: d.at } : m)) } : c)) ?? list);
  });

  const notifyTyping = () => {
    if (!activeId) return;
    send("typing", { conversation_id: activeId, typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => send("typing", { conversation_id: activeId, typing: false }), 2500);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10 - pending.length)) {
        const form = new FormData();
        form.append("file", file);
        const res = await api<{ file_id: string; name: string; mime_type: string; size_bytes: number }>("/chat/files", { method: "POST", form });
        setPending((p) => [...p, res]);
      }
    } catch (err) {
      toast.error("Envoi du fichier impossible", errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!activeId || (!text.trim() && !pending.length)) return;
    if (editing) {
      try {
        const updated = await api<Message>(`/messages/${editing.id}`, { method: "PATCH", body: { body: text.trim() } });
        setMessages((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        setEditing(null);
        setText("");
      } catch (err) {
        toast.error("Modification impossible", errorMessage(err));
      }
      return;
    }
    const clientId = newKey();
    const optimistic: Message = {
      id: clientId,
      conversation_id: activeId,
      sender: user ? { id: user.id, name: user.full_name } : null,
      body: text.trim() || null,
      kind: pending.length ? (pending.every((p) => p.mime_type.startsWith("image/")) ? "image" : "file") : "text",
      reply_to_id: replyTo?.id ?? null,
      created_at: new Date().toISOString(),
      client_message_id: clientId,
      attachments: [],
    };
    setMessages((list) => [...list, optimistic]);
    const body = { body: optimistic.body, kind: optimistic.kind, reply_to_id: optimistic.reply_to_id, attachments: pending.map((p) => ({ file_id: p.file_id })), client_message_id: clientId };
    setText("");
    setPending([]);
    setReplyTo(null);
    send("typing", { conversation_id: activeId, typing: false });
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 30);
    try {
      const saved = await api<Message>(`/conversations/${activeId}/messages`, { method: "POST", body });
      setMessages((list) => list.map((x) => (x.client_message_id === clientId ? saved : x)));
    } catch (err) {
      setMessages((list) => list.filter((x) => x.client_message_id !== clientId));
      setText(body.body ?? "");
      toast.error("Message non envoyé", errorMessage(err));
    }
  };

  const remove = async (m: Message) => {
    try {
      await api(`/messages/${m.id}`, { method: "DELETE" });
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, body: null, deleted_at: new Date().toISOString(), attachments: [] } : x)));
    } catch (err) {
      toast.error("Suppression impossible", errorMessage(err));
    }
  };

  const runSearch = async () => {
    if (searchQ.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      setSearchResults(await api<Message[]>("/chat/search", { query: { q: searchQ.trim() } }));
    } catch (err) {
      toast.error("Recherche impossible", errorMessage(err));
    }
  };

  const visible = (conversations ?? []).filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()));
  const others = active?.members.filter((m) => m.user_id !== user?.id) ?? [];
  const readers = (m: Message) => others.filter((o) => o.last_read_at && o.last_read_at >= m.created_at).length;

  return (
    <div className="card flex h-[calc(100vh-10rem)] min-h-[32rem] overflow-hidden">
      <aside className={clsx("flex w-full flex-col border-r border-line md:w-80", activeId && "hidden md:flex")}>
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex items-center gap-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer les conversations" />
            <Button size="sm" onClick={() => setNewOpen(true)} aria-label="Nouvelle conversation" title="Nouvelle conversation">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
          >
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Rechercher dans les messages" />
            <Button size="sm" variant="secondary" type="submit" aria-label="Rechercher">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
        {searchResults ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-muted">
              {searchResults.length} résultat(s)
              <button type="button" onClick={() => setSearchResults(null)} className="text-brand-600">
                Fermer
              </button>
            </div>
            <ul className="divide-y divide-line">
              {searchResults.map((m) => (
                <li key={m.id}>
                  <button type="button" className="w-full px-3 py-2.5 text-left hover:bg-slate-50" onClick={() => setActiveId(m.conversation_id)}>
                    <p className="text-xs text-muted">
                      {m.sender?.name} · {dateTime(m.created_at)}
                    </p>
                    <p className="line-clamp-2 text-sm">{m.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {conversations === null ? (
              <li className="space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </li>
            ) : null}
            {conversations && !visible.length ? <li className="px-4 py-8 text-center text-sm text-muted">Aucune conversation</li> : null}
            {visible.map((c) => {
              const peer = c.kind === "direct" ? c.members.find((m) => m.user_id !== user?.id) : null;
              const isOnline = peer ? online.has(String(peer.user_id)) || peer.online : false;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setActiveId(c.id)} className={clsx("flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50", c.id === activeId && "bg-brand-50")}>
                    <span className="relative">
                      {c.kind === "direct" ? (
                        <Avatar name={c.title} size={40} />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                          <Users className="h-5 w-5" />
                        </span>
                      )}
                      {isOnline ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{c.title}</span>
                        {c.last_message ? <span className="shrink-0 text-[11px] text-muted">{relative(c.last_message.at)}</span> : null}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted">{c.last_message?.body || "Aucun message"}</span>
                        {c.unread ? <span className="rounded-full bg-accent-500 px-1.5 text-[11px] font-bold text-white">{c.unread}</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <section className={clsx("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden md:flex")}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState title="Sélectionnez une conversation" text="Échangez en toute sécurité avec votre équipe et vos interlocuteurs." action={<Button onClick={() => setNewOpen(true)}>Nouvelle conversation</Button>} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <button type="button" className="rounded-lg p-1 hover:bg-slate-100 md:hidden" onClick={() => setActiveId(null)} aria-label="Retour">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{active.title}</p>
                  <p className="truncate text-xs text-muted">
                    {Object.values(typing).length ? `${Object.values(typing).join(", ")} écrit…` : others.map((o) => `${o.name}${online.has(String(o.user_id)) ? " ●" : ""}`).join(", ")}
                  </p>
                </div>
              </div>
              {canCall && others.length ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => void calls.start({ participantIds: others.map((o) => o.user_id), kind: "audio", conversationId: active.id })} aria-label="Appel audio" title="Appel audio">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void calls.start({ participantIds: others.map((o) => o.user_id), kind: "video", conversationId: active.id })} aria-label="Appel vidéo" title="Appel vidéo">
                    <Video className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface/60 px-4 py-4">
              {hasMore ? (
                <div className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => void loadOlder()}>
                    Messages précédents
                  </Button>
                </div>
              ) : null}
              {loadingMessages ? <Skeleton className="h-20 w-2/3" /> : null}
              {messages.map((m) => {
                const mine = m.sender?.id === user?.id;
                const parent = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                const pendingSend = mine && !!m.client_message_id && m.id === m.client_message_id;
                return (
                  <div key={m.id} className={clsx("group flex", mine ? "justify-end" : "justify-start")}>
                    <div className={clsx("max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm", mine ? "rounded-br-sm bg-brand-500 text-white" : "rounded-bl-sm bg-white text-ink ring-1 ring-line")}>
                      {!mine && active.kind !== "direct" ? <p className="mb-0.5 text-xs font-semibold text-accent-600">{m.sender?.name}</p> : null}
                      {parent ? <p className={clsx("mb-1 border-l-2 pl-2 text-xs", mine ? "border-white/50 text-brand-100" : "border-brand-200 text-muted")}>{parent.body?.slice(0, 120) ?? "Pièce jointe"}</p> : null}
                      {m.deleted_at ? <p className="text-sm italic opacity-70">Message supprimé</p> : m.body ? <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p> : null}
                      {m.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={apiUrl(`/chat/attachments/${a.id}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={clsx("mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs", mine ? "bg-white/15 hover:bg-white/25" : "bg-slate-50 hover:bg-slate-100")}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="truncate">{a.name ?? "Pièce jointe"}</span>
                          {a.size_bytes ? <span className="opacity-70">{fileSize(a.size_bytes)}</span> : null}
                        </a>
                      ))}
                      <div className={clsx("mt-1 flex items-center justify-end gap-1 text-[10px]", mine ? "text-brand-100" : "text-muted")}>
                        {m.edited_at ? <span>modifié ·</span> : null}
                        <span>{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {pendingSend ? <span>envoi…</span> : mine ? readers(m) ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" /> : null}
                      </div>
                    </div>
                    {!m.deleted_at ? (
                      <div className={clsx("flex items-start gap-0.5 px-1 opacity-0 transition group-hover:opacity-100", mine ? "order-first" : "")}>
                        <button type="button" className="rounded p-1 text-muted hover:bg-white" onClick={() => setReplyTo(m)} aria-label="Répondre">
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                        {mine && Date.now() - new Date(m.created_at).getTime() < 15 * 60_000 ? (
                          <button
                            type="button"
                            className="rounded p-1 text-muted hover:bg-white"
                            onClick={() => {
                              setEditing(m);
                              setText(m.body ?? "");
                            }}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {mine ? (
                          <button type="button" className="rounded p-1 text-muted hover:bg-white hover:text-red-600" onClick={() => void remove(m)} aria-label="Supprimer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
            <div className="border-t border-line bg-white p-3">
              {replyTo || editing ? (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-700">
                  <span className="truncate">{editing ? "Modification du message" : `Réponse à ${replyTo?.sender?.name} : ${replyTo?.body?.slice(0, 80) ?? ""}`}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setEditing(null);
                      setText("");
                    }}
                    aria-label="Annuler"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              {pending.length ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {pending.map((p) => (
                    <span key={p.file_id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                      <Paperclip className="h-3 w-3" /> {p.name}
                      <button type="button" onClick={() => setPending((list) => list.filter((x) => x.file_id !== p.file_id))} aria-label="Retirer">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
                <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()} loading={uploading} aria-label="Joindre un fichier" title="Joindre un fichier">
                  {!uploading ? <Paperclip className="h-4 w-4" /> : null}
                </Button>
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    notifyTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  rows={1}
                  className="max-h-40 min-h-[2.5rem] resize-none"
                  placeholder="Votre message… (Entrée pour envoyer)"
                  maxLength={8000}
                />
                <Button onClick={() => void submit()} disabled={!text.trim() && !pending.length} aria-label="Envoyer">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      <NewConversation
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projectId={projectId}
        onCreated={(c) => {
          setConversations((list) => [c, ...(list ?? []).filter((x) => x.id !== c.id)]);
          setActiveId(c.id);
        }}
      />
    </div>
  );
}
