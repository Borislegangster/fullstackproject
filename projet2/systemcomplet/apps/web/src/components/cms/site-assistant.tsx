"use client";

import { CheckCircle2, ExternalLink, Eye, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, Send, Sparkles, Trash2, Wrench, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import type { Row } from "@/components/erp/resource";
import { dateTime, fileSize } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Travaux confiés à Claude en un clic : la consigne est préremplie, il ne reste qu'à la compléter et joindre les données. */
const TASKS: { label: string; prompt: string }[] = [
  {
    label: "Compléter toute la vitrine",
    prompt:
      "Analyse toute la vitrine page par page et complète-la : sections manquantes, textes trop courts, bannières et sections sans image (médiathèque d'abord, sinon images générées réalistes), appels à l'action, SEO. Commence par l'accueil puis les offres, services, expertises, réalisations, blog, FAQ et aide. Prépare des propositions complètes avec aperçu, sans rien inventer (dis-moi ce qu'il faut fournir : photos de chantiers réels, témoignages, chiffres).",
  },
  { label: "Illustrer les pages", prompt: "Repère les pages, sections, offres, services et articles sans image, et ajoute des visuels adaptés : images de la médiathèque si elles conviennent, sinon illustrations réalistes générées (jamais présentées comme nos réalisations)." },
  { label: "Audit SEO complet", prompt: "Fais un audit SEO complet du site et propose les corrections : titres, méta-descriptions, H1, images de partage, pages non indexées." },
  { label: "Textes alternatifs des images", prompt: "Rédige les textes alternatifs de toutes les images de la médiathèque qui n'en ont pas, en regardant chaque image. Avance par lots de 20." },
  { label: "Article de blog", prompt: "Rédige un article de blog sur le sujet suivant : … Public visé : … Crée-le en brouillon avec son SEO, à partir des informations jointes." },
  { label: "Nouvelle réalisation", prompt: "Ajoute au portfolio la réalisation décrite dans les fichiers joints (photos, descriptif) : texte, chiffres clés, galerie, SEO, en brouillon." },
  { label: "Page d'une offre", prompt: "Crée la page de présentation de l'offre suivante : … (sections, bénéfices, étapes, appel à l'action, SEO), en brouillon." },
  { label: "Questions fréquentes", prompt: "Propose 10 questions fréquentes sur … avec des réponses claires, et crée-les en brouillon dans la FAQ." },
  { label: "Rapport de fréquentation", prompt: "Analyse la fréquentation du site sur le mois dernier comparé au mois précédent, et propose 5 actions concrètes pour avoir plus de demandes de devis." },
  { label: "Relecture du site", prompt: "Relis toutes les pages et offres publiées : fautes, cohérence, ton, appels à l'action. Propose les corrections une par une." },
  { label: "Témoignages clients", prompt: "Mets en forme les témoignages clients joints (sans rien inventer) et crée-les en brouillon." },
];

const TOOL_LABEL: Record<string, string> = {
  create_content: "Brouillon créé",
  update_content: "Modification d'un contenu",
  save_page: "Page",
  set_seo: "SEO",
  update_media: "Média",
  create_redirect: "Redirection",
  request_publication: "Publication",
  request_unpublish: "Retrait du site",
  generate_image: "Image générée",
  update_navigation: "Menu",
  update_site_settings: "Réglages du site",
};
/** Actions dont le résultat se regarde sur le site (page, ou élément ayant sa propre page). */
const PREVIEW_TOOLS = new Set(["save_page", "update_content", "create_content", "request_publication"]);
const DETAIL_KINDS = new Set(["page", "universes", "offers", "expertises", "services", "projects", "blog_posts", "help_articles"]);
const STATUS: Record<string, { label: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  applied: { label: "Brouillon enregistré", tone: "info" },
  proposed: { label: "À valider", tone: "warning" },
  accepted: { label: "Appliqué", tone: "success" },
  rejected: { label: "Rejeté", tone: "neutral" },
  failed: { label: "Échec", tone: "danger" },
};
const ACCEPT = "image/*,.pdf,.docx,.xlsx,.txt,.md,.csv,.json,.html";

function editLink(a: Row): string | null {
  if (a.tool === "create_redirect") return "/erp/seo";
  if (a.target_type === "navigation") return "/erp/cms?onglet=navigation";
  if (a.target_type === "site_settings") return "/erp/cms?onglet=reglages";
  if (a.target_type === "media") return "/erp/media";
  if (a.target_type === "page" && a.target_id) return `/erp/cms/pages/${a.target_id}`;
  if (a.target_type) return `/erp/cms?onglet=collections&collection=${a.target_type}`;
  return null;
}

/** Ouvre le résultat sur le site : page en ligne, ou aperçu fidèle (brouillon, proposition appliquée à blanc). */
async function openPreview(actionId: string): Promise<void> {
  // Fenêtre ouverte tout de suite (clic de l'utilisateur) pour ne pas être bloquée, adresse posée ensuite.
  const win = window.open("about:blank", "_blank");
  try {
    const target = await api<{ path: string; token: string | null }>(`/site-assistant/actions/${actionId}/preview`);
    const url = target.token ? `/api/apercu?token=${encodeURIComponent(target.token)}&path=${encodeURIComponent(target.path)}` : target.path;
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else window.location.assign(url);
  } catch (err) {
    win?.close();
    throw err;
  }
}

function ActionCard({ action, onDecide }: { action: Row; onDecide: (id: string, verb: "apply" | "reject") => Promise<void> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const status = action.tool === "generate_image" && action.status === "applied" ? { label: "Ajoutée à la médiathèque", tone: "info" as const } : (STATUS[action.status] ?? STATUS.proposed);
  const link = editLink(action);
  const image = action.tool === "generate_image" && action.result?.url ? String(action.result.url).replace(/\/original$/, "/thumb") : null;
  const previewable = PREVIEW_TOOLS.has(action.tool) && DETAIL_KINDS.has(action.target_type) && action.status !== "rejected" && action.status !== "failed";
  const details =
    action.payload?.changes ??
    action.payload?.page ??
    action.payload?.data ??
    (action.tool === "update_navigation" ? action.payload?.items : null) ??
    (action.tool === "create_redirect" ? action.payload : null) ??
    (action.tool === "generate_image" ? { description: action.payload?.prompt, format: action.payload?.aspect, usage: action.payload?.purpose, modele: action.payload?.model } : null);
  const preview = async () => {
    setBusy("preview");
    try {
      await openPreview(action.id);
    } catch (err) {
      toast.error("Aperçu impossible", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const decide = async (verb: "apply" | "reject") => {
    setBusy(verb);
    try {
      await onDecide(action.id, verb);
    } finally {
      setBusy(null);
    }
  };
  return (
    <li className={`rounded-xl border border-line p-3 text-sm ${action.status === "rejected" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-xs font-semibold text-muted">{TOOL_LABEL[action.tool] ?? action.tool}</span>
      </div>
      <p className="mt-1 font-medium">{action.summary}</p>
      {action.target_label ? <p className="truncate text-xs text-muted" title={action.target_label}>{action.target_label}</p> : null}
      {image ? (
        <img src={image} alt={action.payload?.alt_text ?? ""} loading="lazy" className="mt-2 aspect-[3/2] w-full rounded-lg object-cover ring-1 ring-line" />
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {previewable ? (
          <Button size="sm" variant={action.status === "proposed" ? "secondary" : "ghost"} loading={busy === "preview"} disabled={!!busy && busy !== "preview"} onClick={() => void preview()}>
            <Eye className="h-4 w-4" /> {action.status === "proposed" ? "Aperçu sur le site" : "Voir sur le site"}
          </Button>
        ) : null}
        {action.status === "proposed" ? (
          <>
            <Button size="sm" loading={busy === "apply"} disabled={!!busy} onClick={() => void decide("apply")}>
              <CheckCircle2 className="h-4 w-4" /> Appliquer
            </Button>
            <Button size="sm" variant="ghost" loading={busy === "reject"} disabled={!!busy} onClick={() => void decide("reject")}>
              <XCircle className="h-4 w-4" /> Rejeter
            </Button>
          </>
        ) : null}
        {details ? (
          <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setOpen((v) => !v)}>
            {open ? "Masquer le détail" : "Voir le détail"}
          </button>
        ) : null}
        {link && action.status !== "rejected" ? (
          <Link href={link} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Voir dans le CMS
          </Link>
        ) : null}
      </div>
      {open && details ? <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-2 text-[11px] leading-relaxed text-slate-100">{JSON.stringify(details, null, 2)}</pre> : null}
    </li>
  );
}

function Thread({ session }: { session: Row }) {
  const end = useRef<HTMLDivElement>(null);
  const messages = (session.messages ?? []) as Row[];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, session.state]);
  return (
    <div className="space-y-3">
      {messages.map((m) =>
        m.role === "step" ? (
          <p key={m.id} className="flex items-center gap-1.5 pl-1 text-xs text-muted">
            <Wrench className="h-3.5 w-3.5" /> {m.text}
          </p>
        ) : (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-50 text-ink ring-1 ring-line"}`}>
              {m.text ? <p className="whitespace-pre-wrap break-words">{m.text}</p> : null}
              {(m.attachments ?? []).length ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {(m.attachments as Row[]).map((a, i) => (
                    <li key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${m.role === "user" ? "bg-white/15" : "bg-white ring-1 ring-line"}`}>
                      {a.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />} {a.name} · {fileSize(a.size)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className={`mt-1 text-[10px] ${m.role === "user" ? "text-white/70" : "text-muted"}`}>{dateTime(m.created_at)}</p>
            </div>
          </div>
        ),
      )}
      {session.state === "running" ? (
        <p className="flex items-center gap-2 pl-1 text-sm text-brand-700">
          <Loader2 className="h-4 w-4 animate-spin" /> Claude travaille… vous pouvez quitter cette page, le travail continue.
        </p>
      ) : null}
      <div ref={end} />
    </div>
  );
}

function Composer({ disabled, onSend, preset }: { disabled: boolean; onSend: (text: string, files: File[]) => Promise<boolean>; preset: string | null }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preset) setText(preset);
  }, [preset]);
  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  };
  const send = async () => {
    if (disabled || busy || (!text.trim() && !files.length)) return;
    setBusy(true);
    try {
      if (await onSend(text, files)) {
        setText("");
        setFiles([]);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        add(e.dataTransfer.files);
      }}
      className={`rounded-2xl border bg-white p-2 shadow-sm ${over ? "border-brand-400 ring-2 ring-brand-100" : "border-line"}`}
    >
      {files.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5 px-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
              {f.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />} {f.name} · {fileSize(f.size)}
              <button type="button" aria-label={`Retirer ${f.name}`} className="text-muted hover:text-red-600" onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
        }}
        rows={3}
        placeholder="Votre consigne… (joignez photos, PDF, Word, Excel ou textes : glissez-les ici)"
        aria-label="Consigne pour Claude"
        className="block w-full resize-y border-0 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-0"
        disabled={disabled}
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={disabled}>
            <Paperclip className="h-4 w-4" /> Joindre des fichiers
          </Button>
          <span className="hidden text-xs text-muted sm:inline">Ctrl + Entrée pour envoyer</span>
        </div>
        <Button size="sm" loading={busy} disabled={disabled || (!text.trim() && !files.length)} onClick={() => void send()}>
          <Send className="h-4 w-4" /> Envoyer
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function SiteAssistant() {
  const toast = useToast();
  const status = useApi<Row>("/site-assistant/status");
  const sessions = useApi<Row[]>("/site-assistant/sessions");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = useApi<Row>(currentId ? `/site-assistant/sessions/${currentId}` : null);
  const [preset, setPreset] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const running = current.data?.state === "running";
  const reloadCurrent = current.reload;
  const reloadSessions = sessions.reload;

  // Suivi du travail en cours : la conversation est relue toutes les 2,5 s tant que Claude travaille.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void reloadCurrent(), 2500);
    return () => clearInterval(timer);
  }, [running, reloadCurrent]);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) void reloadSessions();
    wasRunning.current = running;
  }, [running, reloadSessions]);

  const available = !!status.data?.available;
  const session = current.data;
  const actions = (session?.actions ?? []) as Row[];
  const pending = actions.filter((a) => a.status === "proposed");
  const done = actions.filter((a) => a.status !== "proposed");

  const send = async (text: string, files: File[]): Promise<boolean> => {
    try {
      let id = currentId;
      if (!id) {
        const created = await api<Row>("/site-assistant/sessions", { method: "POST", body: {} });
        id = created.id as string;
      }
      const fd = new FormData();
      fd.append("text", text);
      for (const f of files) fd.append("files", f);
      const res = await api<Row>(`/site-assistant/sessions/${id}/messages`, { method: "POST", form: fd });
      setPreset(null);
      if (id !== currentId) setCurrentId(id);
      else current.setData(res);
      void sessions.reload();
      return true;
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
      return false;
    }
  };
  const decide = async (id: string, verb: "apply" | "reject") => {
    try {
      await api(`/site-assistant/actions/${id}/${verb}`, { method: "POST" });
      toast.success(verb === "apply" ? "Proposition appliquée" : "Proposition rejetée");
    } catch (err) {
      toast.error(verb === "apply" ? "Application impossible" : "Rejet impossible", errorMessage(err));
    }
    await current.reload();
  };
  const applyAll = async () => {
    if (!currentId) return;
    setApplyingAll(true);
    try {
      const res = await api<{ done: string[]; errors: Row[] }>(`/site-assistant/sessions/${currentId}/apply-all`, { method: "POST" });
      if (res.errors.length) toast.error(`${res.done.length} appliquée(s), ${res.errors.length} refusée(s)`, res.errors.map((e) => `${e.summary} : ${e.message}`).join(" · "));
      else toast.success(`${res.done.length} proposition${res.done.length > 1 ? "s" : ""} appliquée${res.done.length > 1 ? "s" : ""}`);
    } catch (err) {
      toast.error("Application impossible", errorMessage(err));
    } finally {
      setApplyingAll(false);
      await current.reload();
    }
  };

  return (
    <div className="space-y-5">
      <PageTitle
        title="Assistant du site (Claude)"
        subtitle="Donnez une consigne et vos données : Claude analyse les pages, rédige, complète les sections, illustre (médiathèque ou images générées), règle le SEO et analyse la fréquentation. Il crée des brouillons ; ce que voient les visiteurs attend votre validation, après aperçu sur le site."
      />
      {status.data && !available ? <Alert tone="warning" title="Assistant indisponible">{status.data.reason}</Alert> : null}
      {status.data && available ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <ImageIcon className="h-3.5 w-3.5" />
          {status.data.images?.available ? (
            <>
              Images : médiathèque et génération d&apos;illustrations ({status.data.images.label}, {status.data.images.model}) — {status.data.images.daily_limit} par 24 h au plus.
            </>
          ) : (
            <>
              Images : médiathèque uniquement.{" "}
              {status.data.images?.reason ? (
                <Link href="/erp/parametres" className="font-semibold text-brand-700 hover:underline">
                  {status.data.images.reason}
                </Link>
              ) : null}
            </>
          )}
        </p>
      ) : null}
      <div className={`grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] ${session ? "xl:grid-cols-[16rem_minmax(0,1fr)_22rem]" : ""}`}>
        <Card className="h-fit space-y-2 p-3">
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              setCurrentId(null);
              setPreset(null);
            }}
          >
            <Plus className="h-4 w-4" /> Nouvelle demande
          </Button>
          {sessions.loading && !sessions.data ? <Skeleton className="h-24" /> : null}
          <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
            {(sessions.data ?? []).map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setCurrentId(s.id)} className={`w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-50 ${s.id === currentId ? "bg-brand-100 font-semibold text-brand-800" : ""}`}>
                  <span className="line-clamp-2">{s.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    {s.state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {dateTime(s.updated_at)}
                    {s.pending_actions ? <Badge tone="warning">{s.pending_actions} à valider</Badge> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sessions.data && !sessions.data.length ? <p className="px-1 text-xs text-muted">Aucune demande pour l&apos;instant.</p> : null}
        </Card>

        <div className="min-w-0 space-y-3">
          {session ? (
            <Card className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-semibold">{session.title}</p>
                <p className="text-xs text-muted">
                  {Math.round(((session.usage?.input_tokens ?? 0) + (session.usage?.output_tokens ?? 0)) / 1000)} k jetons · ≈ {Number(session.usage?.estimated_usd ?? 0).toFixed(2)} $ (estimation haute)
                </p>
              </div>
              <Button size="sm" variant="ghost" disabled={running} onClick={() => setArchiving(true)} aria-label="Archiver la conversation">
                <Trash2 className="h-4 w-4" /> Archiver
              </Button>
            </Card>
          ) : null}
          <Card className="min-h-[18rem] p-4">
            {currentId && !session ? (
              <Skeleton className="h-40" />
            ) : session && (session.messages ?? []).length ? (
              <Thread session={session} />
            ) : (
              <div className="space-y-4">
                <EmptyState title="Que voulez-vous faire sur le site ?" text="Choisissez un travail courant ou écrivez votre consigne. Joignez les données utiles : photos de chantier, descriptif, plaquette PDF, tableau Excel, témoignages…" icon={<Sparkles className="h-6 w-6" />} />
                <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {TASKS.map((t) => (
                    <button key={t.label} type="button" onClick={() => setPreset(`${t.prompt}`)} className="rounded-xl border border-line p-3 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                      <span className="font-semibold">{t.label}</span>
                      <span className="mt-1 line-clamp-2 block text-xs text-muted">{t.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {session?.state === "error" && session.error ? <Alert tone="danger">{session.error}</Alert> : null}
          </Card>
          <Composer disabled={!available || running} onSend={send} preset={preset} />
        </div>

        {session ? (
          <Card className="h-fit space-y-3 p-3 lg:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Propositions {pending.length ? `(${pending.length} à valider)` : ""}</p>
              {pending.length > 1 ? (
                <Button size="sm" loading={applyingAll} onClick={() => void applyAll()}>
                  Tout appliquer
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted">Regardez l&apos;aperçu sur le site, puis appliquez : la modification est exécutée avec vos droits (publication : droit de publier). Les brouillons créés sont aussi dans le CMS.</p>
            {!actions.length ? <p className="text-sm text-muted">Aucune action pour l&apos;instant.</p> : null}
            <ul className="space-y-2">
              {pending.map((a) => (
                <ActionCard key={a.id} action={a} onDecide={decide} />
              ))}
              {done
                .slice()
                .reverse()
                .map((a) => (
                  <ActionCard key={a.id} action={a} onDecide={decide} />
                ))}
            </ul>
          </Card>
        ) : null}
      </div>
      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Archiver la conversation"
        text="La conversation disparaît de la liste ; les brouillons créés et les modifications appliquées restent dans le CMS."
        confirmLabel="Archiver"
        onConfirm={async () => {
          if (!currentId) return;
          await api(`/site-assistant/sessions/${currentId}`, { method: "DELETE" });
          setCurrentId(null);
          await sessions.reload();
        }}
      />
    </div>
  );
}
