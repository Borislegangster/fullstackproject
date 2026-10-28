"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Download, MapPin, Video } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useCalls } from "@/components/calls/call-provider";
import { MultiRefSelect, RefSelect } from "@/components/forms/ref-select";
import { Checkbox, Field, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

type Row = Record<string, any>;
const KINDS = ["meeting", "appointment", "site_visit", "bim_meeting", "call", "milestone", "reminder"];
const KIND_COLORS: Record<string, string> = { meeting: "#385AA6", appointment: "#FB8C43", site_visit: "#16a34a", bim_meeting: "#9333ea", call: "#0891b2", milestone: "#d97706", reminder: "#64748b" };
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const hour = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function EventForm({ projectId, initialStart, onDone, onCancel }: { projectId?: string | null; initialStart: Date; onDone: (e: Row) => void; onCancel: () => void }) {
  const { can } = useAuth();
  const start = new Date(initialStart.getFullYear(), initialStart.getMonth(), initialStart.getDate(), 9, 0);
  const [v, setV] = useState({ title: "", kind: "meeting", description: "", starts_at: toLocalInput(start), ends_at: toLocalInput(new Date(start.getTime() + 3600000)), all_day: false, location: "", project_id: projectId ?? null, rrule: "", client_visible: false, with_video_call: false });
  const [attendees, setAttendees] = useState<string[]>([]);
  const [external, setExternal] = useState<string[]>([]);
  const [reminders, setReminders] = useState<string[]>(["30"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre" required className="sm:col-span-2">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={KINDS.map((k) => ({ value: k, label: optionLabel(k) }))} />
        </Field>
        <Field label="Projet">
          <RefSelect source={REFS.projects} value={v.project_id} onChange={(id) => setV({ ...v, project_id: id })} placeholder="Aucun" />
        </Field>
        <Field label="Début" required>
          <Input type="datetime-local" value={v.starts_at} onChange={(e) => setV({ ...v, starts_at: e.target.value })} />
        </Field>
        <Field label="Fin" required>
          <Input type="datetime-local" value={v.ends_at} onChange={(e) => setV({ ...v, ends_at: e.target.value })} />
        </Field>
        <Field label="Lieu">
          <Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Base vie, bureau, visio…" />
        </Field>
        <Field label="Récurrence">
          <Select value={v.rrule} onChange={(e) => setV({ ...v, rrule: e.target.value })} options={[{ value: "", label: "Aucune" }, { value: "FREQ=DAILY", label: "Tous les jours" }, { value: "FREQ=WEEKLY", label: "Toutes les semaines" }, { value: "FREQ=MONTHLY", label: "Tous les mois" }]} />
        </Field>
        <Field label="Participants" className="sm:col-span-2">
          <MultiRefSelect source={REFS.users} value={attendees} onChange={setAttendees} />
        </Field>
        <Field label="Invités externes (e-mails)" className="sm:col-span-2">
          <TagInput value={external} onChange={setExternal} placeholder="prenom.nom@exemple.com puis Entrée" />
        </Field>
        <Field label="Rappels (minutes avant)">
          <TagInput value={reminders} onChange={(r) => setReminders(r.filter((x) => /^\d+$/.test(x)).slice(0, 5))} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Checkbox label="Journée entière" checked={v.all_day} onChange={(c) => setV({ ...v, all_day: c })} />
        <Checkbox label="Créer la visioconférence" checked={v.with_video_call} onChange={(c) => setV({ ...v, with_video_call: c })} />
        {v.project_id && can("projects:publish_client") ? <Checkbox label="Visible par le client" checked={v.client_visible} onChange={(c) => setV({ ...v, client_visible: c })} /> : null}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={v.title.trim().length < 2 || !v.starts_at || !v.ends_at}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const event = await api<Row>("/agenda/events", {
                method: "POST",
                body: {
                  ...v,
                  title: v.title.trim(),
                  description: v.description || null,
                  location: v.location || null,
                  rrule: v.rrule || null,
                  starts_at: new Date(v.starts_at).toISOString(),
                  ends_at: new Date(v.ends_at).toISOString(),
                  reminders: reminders.map(Number),
                  attendee_ids: attendees,
                  external: external.map((email) => ({ email })),
                },
              });
              onDone(event);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer l'événement
        </Button>
      </div>
    </div>
  );
}

const REQUEST_KINDS = [
  { value: "appointment", label: "Rendez-vous (bureau GLOBUS)" },
  { value: "site_visit", label: "Visite de chantier" },
  { value: "call", label: "Appel ou visio" },
];

/** Demande de rendez-vous du client : créneau souhaité, confirmé (ou déplacé) par l'équipe du projet. */
function AppointmentRequestForm({ projectId, onDone, onCancel }: { projectId: string; onDone: (e: Row) => void; onCancel: () => void }) {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const [v, setV] = useState({ subject: "", kind: "appointment", starts_at: toLocalInput(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0)), duration_minutes: "60", location: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Proposez un créneau : votre chef de projet le confirme ou vous en propose un autre. Vous êtes prévenu par e-mail et dans l&apos;application.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Objet" required className="sm:col-span-2">
          <Input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} placeholder="Ex. Point sur l'avancement, choix des finitions" maxLength={200} />
        </Field>
        <Field label="Type">
          <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={REQUEST_KINDS} />
        </Field>
        <Field label="Durée">
          <Select
            value={v.duration_minutes}
            onChange={(e) => setV({ ...v, duration_minutes: e.target.value })}
            options={[
              { value: "30", label: "30 minutes" },
              { value: "60", label: "1 heure" },
              { value: "90", label: "1 h 30" },
              { value: "120", label: "2 heures" },
            ]}
          />
        </Field>
        <Field label="Date et heure souhaitées" required>
          <Input type="datetime-local" value={v.starts_at} min={toLocalInput(new Date())} onChange={(e) => setV({ ...v, starts_at: e.target.value })} />
        </Field>
        <Field label="Lieu">
          <Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Chantier, bureau, visio…" maxLength={300} />
        </Field>
        <Field label="Message" className="sm:col-span-2">
          <Textarea value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} rows={3} maxLength={2000} placeholder="Ce que vous souhaitez voir ou aborder" />
        </Field>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={v.subject.trim().length < 2 || !v.starts_at}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const event = await api<Row>("/agenda/requests", {
                method: "POST",
                body: {
                  project_id: projectId,
                  kind: v.kind,
                  subject: v.subject.trim(),
                  starts_at: new Date(v.starts_at).toISOString(),
                  duration_minutes: Number(v.duration_minutes),
                  location: v.location.trim() || null,
                  message: v.message.trim() || null,
                },
              });
              onDone(event);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Envoyer la demande
        </Button>
      </div>
    </div>
  );
}

function EventPanel({ eventId, onChanged, onClose }: { eventId: string; onChanged: () => void; onClose: () => void }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const calls = useCalls();
  const event = useApi<Row>(`/agenda/events/${eventId}`);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<{ starts_at: string; ends_at: string; location: string }>({ starts_at: "", ends_at: "", location: "" });
  if (event.loading && !event.data) return <Skeleton className="h-40" />;
  if (!event.data) return <Alert tone="danger">{event.error}</Alert>;
  const e = event.data;
  const mine = ((e.attendees ?? []) as Row[]).find((a) => a.user_id === user?.id);
  const organizer = e.organizer_id === user?.id || can("agenda:write");
  const respond = async (response: string) => {
    try {
      event.setData(await api(`/agenda/events/${eventId}/respond`, { method: "POST", body: { response } }));
      onChanged();
    } catch (err) {
      toast.error("Réponse impossible", errorMessage(err));
    }
  };
  const patch = async (body: Row, message: string) => {
    try {
      event.setData(await api(`/agenda/events/${eventId}`, { method: "PATCH", body }));
      onChanged();
      toast.success(message);
    } catch (err) {
      toast.error("Modification impossible", errorMessage(err));
    }
  };
  const confirm = async () => {
    try {
      event.setData(await api(`/agenda/events/${eventId}/confirm`, { method: "POST" }));
      onChanged();
      toast.success("Rendez-vous confirmé : le demandeur est prévenu");
    } catch (err) {
      toast.error("Confirmation impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: KIND_COLORS[e.kind] ?? "#385AA6" }} />
          {optionLabel(e.kind)}
        </Badge>
        <StatusBadge status={e.status} />
        {e.rrule ? <Badge>Récurrent</Badge> : null}
        {e.client_visible ? <Badge tone="info">Visible client</Badge> : null}
      </div>
      <p className="text-sm">
        {e.all_day ? `Journée du ${new Date(e.starts_at).toLocaleDateString("fr-FR")}` : `${dateTime(e.starts_at)} → ${hour(e.ends_at)}`}
        {e.location ? (
          <span className="block text-muted">
            <MapPin className="mr-1 inline h-3.5 w-3.5" />
            {e.location}
          </span>
        ) : null}
      </p>
      {e.description ? <p className="whitespace-pre-line text-sm">{e.description}</p> : null}
      {e.status === "tentative" ? (
        can("agenda:write") ? (
          <Alert tone="warning" title="Demande de rendez-vous en attente">
            Confirmez le créneau, ou déplacez-le pour en proposer un autre (le demandeur est prévenu).
            <div className="mt-2">
              <Button size="sm" onClick={() => void confirm()}>
                Confirmer le rendez-vous
              </Button>
            </div>
          </Alert>
        ) : (
          <Alert tone="info">En attente de confirmation par l&apos;équipe du projet : vous serez prévenu.</Alert>
        )
      ) : null}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-muted">Participants</p>
        <ul className="space-y-1 text-sm">
          {((e.attendees ?? []) as Row[]).map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span>{a.name ?? a.external_email}</span>
              <StatusBadge status={a.response} label={optionLabel(a.response)} />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        {mine && e.status !== "cancelled"
          ? (["accepted", "tentative", "declined"] as const).map((r) => (
              <Button key={r} size="sm" variant={mine.response === r ? "primary" : "secondary"} onClick={() => void respond(r)}>
                {r === "accepted" ? "J'accepte" : r === "tentative" ? "Peut-être" : "Je décline"}
              </Button>
            ))
          : null}
        {e.call_id && e.status !== "cancelled" ? (
          <Button size="sm" variant="accent" onClick={() => void calls.join(e.call_id, true).then(onClose)}>
            <Video className="h-4 w-4" /> Rejoindre la visio
          </Button>
        ) : null}
        <a href={apiUrl(`/agenda/events/${eventId}/ics`)} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
          <Download className="h-3.5 w-3.5" /> Ajouter à mon calendrier (.ics)
        </a>
      </div>
      {organizer && e.status !== "cancelled" ? (
        <div className="space-y-2 border-t border-line pt-3">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Input type="datetime-local" value={edit.starts_at} onChange={(ev) => setEdit({ ...edit, starts_at: ev.target.value })} aria-label="Début" />
              <Input type="datetime-local" value={edit.ends_at} onChange={(ev) => setEdit({ ...edit, ends_at: ev.target.value })} aria-label="Fin" />
              <Input value={edit.location} onChange={(ev) => setEdit({ ...edit, location: ev.target.value })} placeholder="Lieu" />
              <Button
                size="sm"
                onClick={async () => {
                  await patch({ starts_at: new Date(edit.starts_at).toISOString(), ends_at: new Date(edit.ends_at).toISOString(), location: edit.location || null }, "Événement déplacé : les participants sont prévenus");
                  setEditing(false);
                }}
              >
                Enregistrer
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEdit({ starts_at: toLocalInput(new Date(e.starts_at)), ends_at: toLocalInput(new Date(e.ends_at)), location: e.location ?? "" });
                  setEditing(true);
                }}
              >
                Déplacer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void patch({ status: "cancelled" }, "Événement annulé")}>
                Annuler l'événement
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Agenda partagé : vue mois / semaine / liste, invitations, réponses, visio, export iCalendar. */
export function AgendaView({ projectId, canCreate = true, canRequest = false, title = "Agenda" }: { projectId?: string | null; canCreate?: boolean; canRequest?: boolean; title?: string }) {
  const { can } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [creating, setCreating] = useState<Date | null>(null);
  const [requesting, setRequesting] = useState(false);
  const selected = params.get("event");
  const range = useMemo(() => {
    if (view === "week") {
      const s = mondayOf(cursor);
      return { start: s, end: addDays(s, 7) };
    }
    if (view === "list") return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 60) };
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = mondayOf(first);
    return { start: s, end: addDays(s, 42) };
  }, [view, cursor]);
  const events = useApi<Row[]>("/agenda/events", { start: range.start.toISOString(), end: range.end.toISOString(), project_id: projectId ?? undefined });
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = range.start; d < range.end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [range]);
  const byDay = (d: Date) => (events.data ?? []).filter((e) => e.status !== "cancelled" && new Date(e.starts_at) < addDays(d, 1) && new Date(e.ends_at) > d);
  const open = (id: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (id) q.set("event", id);
    else q.delete("event");
    router.replace(`?${q.toString()}`, { scroll: false });
  };
  const shift = (n: number) => setCursor((c) => (view === "week" ? addDays(c, 7 * n) : view === "list" ? addDays(c, 30 * n) : new Date(c.getFullYear(), c.getMonth() + n, 1)));
  const label = view === "week" ? `Semaine du ${range.start.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : view === "list" ? `À partir du ${cursor.toLocaleDateString("fr-FR")}` : cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const today = new Date();
  const EventChip = ({ e }: { e: Row }) => (
    <button type="button" onClick={() => open(e.id)} className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-white" style={{ backgroundColor: KIND_COLORS[e.kind] ?? "#385AA6" }} title={e.title}>
      {e.all_day ? "" : `${hour(e.starts_at)} `}
      {e.title}
    </button>
  );
  return (
    <div className="space-y-4">
      <PageTitle
        title={title}
        subtitle="Rendez-vous, visites de chantier, réunions BIM, jalons et rappels — invitations et réponses en temps réel."
        actions={
          canCreate && can("agenda:write") ? (
            <Button onClick={() => setCreating(today)}>
              <CalendarPlus className="h-4 w-4" /> Nouvel événement
            </Button>
          ) : canRequest && projectId ? (
            <Button onClick={() => setRequesting(true)}>
              <CalendarPlus className="h-4 w-4" /> Demander un rendez-vous
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => shift(-1)} aria-label="Précédent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setCursor(startOfDay(new Date()))}>
            Aujourd'hui
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shift(1)} aria-label="Suivant">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 font-display text-lg font-semibold capitalize text-brand-800">{label}</span>
        </div>
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-line">
          {(["month", "week", "list"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded-lg px-3 py-1 text-xs font-semibold ${view === v ? "bg-brand-500 text-white" : "text-muted"}`}>
              {v === "month" ? "Mois" : v === "week" ? "Semaine" : "Liste"}
            </button>
          ))}
        </div>
      </div>
      {events.error ? <Alert tone="danger">{events.error}</Alert> : null}
      {view === "list" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {(events.data ?? []).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => open(e.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <span className="h-8 w-1 rounded-full" style={{ backgroundColor: KIND_COLORS[e.kind] ?? "#385AA6" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{e.title}</span>
                    <span className="text-xs text-muted">
                      {dateTime(e.starts_at)} · {optionLabel(e.kind)}
                      {e.location ? ` · ${e.location}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={e.status} />
                </button>
              </li>
            ))}
            {!events.loading && !events.data?.length ? <li className="px-5 py-6 text-center text-muted">Aucun événement sur la période.</li> : null}
          </ul>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-slate-50 text-center text-xs font-semibold uppercase text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const list = byDay(d);
              const outside = view === "month" && d.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={d.toISOString()}
                  className={`group border-b border-r border-line p-1.5 ${view === "week" ? "min-h-[16rem]" : "min-h-[6.5rem]"} ${outside ? "bg-slate-50/70 text-muted" : ""}`}
                  onDoubleClick={() => canCreate && can("agenda:write") && setCreating(d)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${sameDay(d, today) ? "bg-accent-500 font-bold text-white" : ""}`}>{d.getDate()}</span>
                    {canCreate && can("agenda:write") ? (
                      <button type="button" onClick={() => setCreating(d)} className="hidden rounded px-1 text-xs text-brand-600 group-hover:block" aria-label="Ajouter un événement ce jour">
                        +
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, view === "week" ? 12 : 3).map((e) => (
                      <EventChip key={e.id} e={e} />
                    ))}
                    {list.length > (view === "week" ? 12 : 3) ? <p className="text-[11px] text-muted">+{list.length - (view === "week" ? 12 : 3)} autre(s)</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Modal open={!!selected} onClose={() => open(null)} title={(events.data ?? []).find((e) => e.id === selected)?.title ?? "Événement"}>
        {selected ? <EventPanel eventId={selected} onChanged={() => void events.reload()} onClose={() => open(null)} /> : null}
      </Modal>
      <Modal open={requesting} onClose={() => setRequesting(false)} title="Demander un rendez-vous" size="lg">
        {requesting && projectId ? (
          <AppointmentRequestForm
            projectId={projectId}
            onCancel={() => setRequesting(false)}
            onDone={(e) => {
              setRequesting(false);
              setCursor(startOfDay(new Date(e.starts_at)));
              void events.reload();
              open(e.id);
            }}
          />
        ) : null}
      </Modal>
      <Modal open={!!creating} onClose={() => setCreating(null)} title="Nouvel événement" size="lg">
        {creating ? (
          <EventForm
            projectId={projectId}
            initialStart={creating}
            onCancel={() => setCreating(null)}
            onDone={(e) => {
              setCreating(null);
              void events.reload();
              open(e.id);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
