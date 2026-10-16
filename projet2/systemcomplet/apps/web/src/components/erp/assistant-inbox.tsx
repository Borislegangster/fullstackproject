"use client";

import { Bot, CheckCircle2, Globe, Hand, MessageCircle, Send, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, relative } from "@/lib/format";
import { useApi, useInterval } from "@/lib/hooks";

interface ConversationRow {
  id: string;
  channel: "web" | "whatsapp";
  contact_name?: string | null;
  contact_phone?: string | null;
  user_id?: string | null;
  project_id?: string | null;
  lead_id?: string | null;
  mode: string;
  status: string;
  human_until?: string | null;
  last_message_at?: string | null;
  last_message: string;
  messages_count: number;
  page_path?: string | null;
}

interface ConversationDetail extends ConversationRow {
  messages: { role: "user" | "assistant" | "agent"; content: string; at: string; by?: string; failed?: boolean; ignored?: boolean }[];
}

const STATUS: Record<string, { label: string; tone: "info" | "accent" | "success" | "neutral" | "warning" }> = {
  open: { label: "En cours", tone: "info" },
  handoff: { label: "À reprendre", tone: "accent" },
  lead: { label: "Lead créé", tone: "success" },
  closed: { label: "Close", tone: "neutral" },
};

function Thread({ id, onChange }: { id: string; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const conv = useApi<ConversationDetail>(`/assistant/conversations/${id}`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useInterval(() => void conv.reload(), 15000);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [conv.data?.messages.length]);
  if (conv.loading && !conv.data) return <Skeleton className="h-[32rem] w-full" />;
  if (!conv.data) return <Alert tone="danger">{conv.error}</Alert>;
  const c = conv.data;
  const human = c.human_until && new Date(c.human_until) > new Date();
  const act = async (path: string, body?: unknown, ok?: string) => {
    setBusy(true);
    try {
      conv.setData(await api<ConversationDetail>(`/assistant/conversations/${id}/${path}`, { method: "POST", body }));
      if (ok) toast.success(ok);
      onChange();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex h-[36rem] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div>
          <p className="font-semibold text-ink">
            {c.contact_name ?? (c.channel === "web" ? "Visiteur du site" : "Contact WhatsApp")}{" "}
            <Badge tone={STATUS[c.status]?.tone ?? "neutral"}>{STATUS[c.status]?.label ?? c.status}</Badge>
          </p>
          <p className="text-xs text-muted">
            {c.channel === "whatsapp" ? `WhatsApp ${c.contact_phone ?? ""}` : `Site web ${c.page_path ?? ""}`}
            {c.user_id ? " · client reconnu" : ""}
            {c.lead_id ? (
              <>
                {" · "}
                <Link href={`/erp/crm/leads/${c.lead_id}`} className="font-semibold text-brand-600 hover:underline">
                  voir le lead
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {can("crm:write") && c.channel === "whatsapp" ? (
          <div className="flex gap-2">
            {human ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act("release", undefined, "L'assistant reprend la conversation")}>
                <Bot className="h-4 w-4" /> Rendre la main
              </Button>
            ) : null}
            {c.status !== "closed" ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act("close", undefined, "Conversation close")}>
                <CheckCircle2 className="h-4 w-4" /> Clore
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-5 py-4">
        {c.messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                m.role === "user" ? "bg-white text-ink ring-1 ring-line" : m.role === "agent" ? "bg-accent-500 text-white" : "bg-brand-600 text-white"
              } ${m.failed ? "opacity-60 ring-2 ring-red-400" : ""}`}
            >
              {m.content}
              <p className={`mt-1 text-[10px] ${m.role === "user" ? "text-muted" : "text-white/70"}`}>
                {m.role === "agent" ? `${m.by ?? "Conseiller"} · ` : m.role === "assistant" ? "Assistant · " : ""}
                {dateTime(m.at)}
                {m.failed ? " · non délivré" : ""}
                {m.ignored ? " · ignoré (anti-abus)" : ""}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {can("crm:write") && c.channel === "whatsapp" && c.status !== "closed" ? (
        <div className="border-t border-line p-3">
          {!human ? (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <Hand className="h-3.5 w-3.5" /> En répondant, vous reprenez la main : l&apos;assistant se tait pendant 12 h.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre réponse WhatsApp…" className="flex-1" />
            <Button
              disabled={busy || !text.trim()}
              onClick={async () => {
                await act("reply", { message: text.trim() });
                setText("");
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/** Boîte de réception de l'assistant (A1) : WhatsApp et widget du site, reprise par un conseiller. */
export function AssistantInbox() {
  const params = useSearchParams();
  const router = useRouter();
  const [channel, setChannel] = useState("whatsapp");
  const list = useApi<ConversationRow[]>("/assistant/conversations", { channel }, [channel]);
  const selected = params.get("conversation") ?? list.data?.[0]?.id ?? null;
  useInterval(() => void list.reload(), 20000);
  return (
    <div className="space-y-5">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-[#25D366]" /> Assistant et WhatsApp
          </span>
        }
        subtitle="Le guichet 24 h / 24 : l'assistant répond aux prospects et aux clients (avancement, paiement, reçu) ; vous reprenez la main à tout moment."
      />
      <Tabs
        value={channel}
        onChange={setChannel}
        tabs={[
          { key: "whatsapp", label: "WhatsApp" },
          { key: "web", label: "Site web" },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <Card className="max-h-[36rem] overflow-y-auto">
          {list.loading && !list.data ? (
            <Skeleton className="m-4 h-64" />
          ) : list.data?.length ? (
            <ul className="divide-y divide-line">
              {list.data.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => router.replace(`/erp/assistant?conversation=${c.id}`, { scroll: false })}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${selected === c.id ? "bg-brand-50" : ""}`}
                  >
                    <span className="mt-0.5 rounded-full bg-slate-100 p-2 text-brand-600">
                      {c.channel === "whatsapp" ? (c.user_id ? <UserRound className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />) : <Globe className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{c.contact_name ?? (c.channel === "web" ? "Visiteur" : c.contact_phone)}</span>
                        <span className="shrink-0 text-[11px] text-muted">{relative(c.last_message_at)}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">{c.last_message}</span>
                      <span className="mt-1 flex gap-1">
                        <Badge tone={STATUS[c.status]?.tone ?? "neutral"}>{STATUS[c.status]?.label ?? c.status}</Badge>
                        {c.human_until && new Date(c.human_until) > new Date() ? <Badge tone="warning">Conseiller</Badge> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState title="Aucune conversation" text="Les échanges apparaîtront ici dès le premier message." />
            </div>
          )}
        </Card>
        {selected ? <Thread key={selected} id={selected} onChange={() => void list.reload()} /> : <EmptyState title="Sélectionnez une conversation" />}
      </div>
    </div>
  );
}
