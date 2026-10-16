"use client";

import { BookOpen, CalendarCheck, CheckCircle2, Download, FileText, Home, ShieldCheck, Wrench } from "lucide-react";
import { useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { date } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

interface Equipment {
  id: string;
  category: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  location?: string | null;
  installed_on?: string | null;
  warranty_until?: string | null;
  manual_url?: string | null;
  next_task?: { id: string; title: string; due_on: string } | null;
}

interface MaintenanceTask {
  id: string;
  equipment_id?: string | null;
  title: string;
  due_on: string;
  performer: "client" | "technicien";
  status: string;
  overdue: boolean;
}

interface Building {
  equipment: Equipment[];
  tasks: MaintenanceTask[];
  warranties: { kind: string; start_date: string; end_date: string; insurer?: string | null; coverage?: string | null }[];
}

function BuildingContent({ projectId, projectCode }: { projectId: string; projectCode: string }) {
  const toast = useToast();
  const data = useApi<Building>(`/client/projects/${projectId}/building`);
  const [booking, setBooking] = useState<MaintenanceTask | null>(null);
  const [note, setNote] = useState("");
  if (data.loading && !data.data) return <Skeleton className="h-96 w-full" />;
  if (!data.data) return <Alert tone="danger">{data.error}</Alert>;
  const b = data.data;
  const names = Object.fromEntries(b.equipment.map((e) => [e.id, e.name]));
  const done = async (t: MaintenanceTask) => {
    try {
      await api(`/maintenance-tasks/${t.id}/complete`, { body: {} });
      toast.success("Entretien noté", "La prochaine échéance est programmée.");
      void data.reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Home className="h-7 w-7 text-brand-600" /> Mon bâtiment
          </span>
        }
        subtitle="Équipements, notices, garanties et carnet d'entretien : gardez votre bâtiment en parfait état, avec des rappels au bon moment."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              void download(`/projects/${projectId}/building-passport.pdf`, `passeport-batiment-${projectCode}.pdf`).catch((err) =>
                toast.error("Téléchargement impossible", errorMessage(err)),
              )
            }
          >
            <Download className="h-4 w-4" /> Passeport du bâtiment (certifié)
          </Button>
        }
      />
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-accent-500" /> Carnet d&apos;entretien
            </span>
          }
          subtitle="Rappels 14 jours et la veille de chaque échéance."
        />
        {b.tasks.length ? (
          <ul className="divide-y divide-line">
            {b.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium text-ink">{t.title}</span>{" "}
                  {t.overdue ? <Badge tone="danger">En retard</Badge> : null}
                  {t.status === "booked" ? <Badge tone="info">Intervention planifiée</Badge> : null}
                  <span className="block text-xs text-muted">
                    {t.equipment_id ? `${names[t.equipment_id] ?? "Équipement"} · ` : ""}avant le {date(t.due_on)} ·{" "}
                    {t.performer === "client" ? "à faire vous-même" : "par un technicien"}
                  </span>
                </span>
                {t.status === "planned" ? (
                  <span className="flex gap-2">
                    {t.performer === "client" ? (
                      <Button size="sm" variant="secondary" onClick={() => void done(t)}>
                        <CheckCircle2 className="h-4 w-4" /> C&apos;est fait
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={() => setBooking(t)}>
                      <Wrench className="h-4 w-4" /> Planifier une intervention
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState title="Aucun entretien programmé" text="Votre carnet se remplit à la livraison, équipement par équipement." />
          </div>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Équipements installés" />
          {b.equipment.length ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {b.equipment.map((e) => (
                <div key={e.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{optionLabel(e.category)}</p>
                  <p className="mt-1 font-semibold text-ink">{e.name}</p>
                  <p className="text-xs text-muted">
                    {[e.brand, e.model].filter(Boolean).join(" ") || "—"}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {e.warranty_until ? `Garantie jusqu'au ${date(e.warranty_until)}` : "Garantie : voir contrat"}
                    {e.next_task ? ` · prochain entretien le ${date(e.next_task.due_on)}` : ""}
                  </p>
                  {e.manual_url ? (
                    <a href={e.manual_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                      <BookOpen className="h-3.5 w-3.5" /> Notice
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState icon={<FileText className="h-8 w-8" />} title="Inventaire en préparation" text="La liste des équipements et leurs notices vous sont remises à la livraison." />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Garanties
              </span>
            }
          />
          {b.warranties.length ? (
            <ul className="divide-y divide-line">
              {b.warranties.map((w) => (
                <li key={`${w.kind}-${w.end_date}`} className="px-5 py-3 text-sm">
                  <p className="font-medium">{optionLabel(w.kind)}</p>
                  <p className="text-xs text-muted">
                    jusqu&apos;au {date(w.end_date)}
                    {w.insurer ? ` · ${w.insurer}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">Les garanties démarrent à la réception des travaux.</p>
          )}
        </Card>
      </div>
      <Modal
        open={booking !== null}
        onClose={() => setBooking(null)}
        title="Planifier une intervention"
        description={booking?.title}
        footer={
          <Button
            onClick={async () => {
              try {
                const res = await api<{ ticket_number: string }>(`/maintenance-tasks/${booking?.id}/book`, { body: { note: note || null } });
                toast.success(`Demande ${res.ticket_number} créée`, "Notre SAV vous propose un créneau.");
                setBooking(null);
                setNote("");
                void data.reload();
              } catch (err) {
                toast.error("Demande impossible", errorMessage(err));
              }
            }}
          >
            Envoyer la demande
          </Button>
        }
      >
        <Field label="Précisions (disponibilités, accès…)">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

export default function ClientBuildingPage() {
  return <WithProject>{(p) => <BuildingContent projectId={p.id} projectCode={p.code} />}</WithProject>;
}
