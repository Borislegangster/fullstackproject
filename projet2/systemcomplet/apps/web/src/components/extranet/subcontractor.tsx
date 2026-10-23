"use client";

import { Camera, Download, FileSignature, Gavel, Plus, Send, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { Checkbox, Field, FileDrop, Input, Select, TagInput, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { OtpDialog } from "@/components/ui/otp-dialog";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, relative, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";

type Row = Record<string, any>;
const BASE = "/extranet/subcontractor";

async function uploadFiles(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", f);
    ids.push((await api<{ file_id: string }>(`${BASE}/files`, { method: "POST", form: fd })).file_id);
  }
  return ids;
}

/* ----------------------------------------------------------------------------- consultations */

export function TendersInbox() {
  const tenders = useApi<Row[]>(`${BASE}/tenders`);
  return (
    <div className="space-y-4">
      <PageTitle title="Consultations" subtitle="Appels d'offres auxquels GLOBUS vous invite : dossier, bordereau de prix, dépôt d'offre sous pli scellé." />
      <Card>
        <DataTable
          rows={tenders.data ?? []}
          loading={tenders.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "number", label: "N°", render: (r) => <Link href={`/extranet/consultations/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link> },
            { key: "title", label: "Consultation" },
            { key: "deadline", label: "Date limite", render: (r) => <span className={r.open && new Date(r.deadline).getTime() - Date.now() < 3 * 86400000 ? "font-semibold text-red-600" : ""}>{dateTime(r.deadline)}</span> },
            { key: "invitation_status", label: "Ma réponse", format: "status" },
            { key: "open", label: "", render: (r) => (r.open ? <Badge tone="success">Ouverte</Badge> : <Badge>Close</Badge>) },
          ]}
          empty={{ title: "Aucune consultation", text: "Vous serez notifié dès qu'une consultation vous concernera." }}
        />
      </Card>
    </div>
  );
}

interface LineDraft {
  tender_item_id: string | null;
  designation: string;
  unit: string;
  quantity: string;
  unit_price: string;
}

function BidForm({ tender, lot, onDone, onCancel }: { tender: Row; lot: Row; onDone: () => void; onCancel: () => void }) {
  const items = (lot.items ?? []) as Row[];
  const [lines, setLines] = useState<LineDraft[]>(items.map((i) => ({ tender_item_id: i.id, designation: i.designation, unit: i.unit, quantity: String(toNumber(i.quantity)), unit_price: "" })));
  const [extra, setExtra] = useState<LineDraft[]>([]);
  const [meta, setMeta] = useState({ duration_days: "", is_variant: false, variant_description: "", exclusions: "" });
  const [memo, setMemo] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = [...lines, ...extra].reduce((s, l) => s + toNumber(l.quantity) * toNumber(l.unit_price), 0);
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Poste</th>
              <th className="px-3 py-2 text-right">Quantité</th>
              <th className="px-3 py-2">
                Prix unitaire HT<span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
              </th>
              <th className="px-3 py-2 text-right">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={l.tender_item_id ?? i}>
                <td className="px-3 py-1.5">{l.designation}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {number(l.quantity, 2)} {l.unit}
                </td>
                <td className="px-3 py-1.5">
                  <Input type="number" min={0} step="any" className="w-36" value={l.unit_price} onChange={(e) => setLines((all) => all.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(toNumber(l.quantity) * toNumber(l.unit_price))}</td>
              </tr>
            ))}
            {extra.map((l, i) => (
              <tr key={`x-${i}`} className="bg-accent-50/40">
                <td className="px-3 py-1.5">
                  <Input value={l.designation} onChange={(e) => setExtra((all) => all.map((x, j) => (j === i ? { ...x, designation: e.target.value } : x)))} placeholder="Poste complémentaire (variante)" />
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-1">
                    <Input type="number" min={0} step="any" className="w-20" value={l.quantity} onChange={(e) => setExtra((all) => all.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                    <Input className="w-14" value={l.unit} onChange={(e) => setExtra((all) => all.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <Input type="number" min={0} step="any" className="w-36" value={l.unit_price} onChange={(e) => setExtra((all) => all.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" aria-label="Retirer" className="rounded p-1.5 text-muted hover:text-red-600" onClick={() => setExtra((all) => all.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Montant total HT de l'offre
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {tender.variants_allowed ? (
        <Button size="sm" variant="ghost" onClick={() => setExtra((all) => [...all, { tender_item_id: null, designation: "", unit: "u", quantity: "1", unit_price: "" }])}>
          <Plus className="h-4 w-4" /> Poste complémentaire
        </Button>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Délai d'exécution proposé (jours)" help={tender.duration_days_target ? `Délai cible : ${tender.duration_days_target} j` : undefined}>
          <Input type="number" min={1} value={meta.duration_days} onChange={(e) => setMeta({ ...meta, duration_days: e.target.value })} />
        </Field>
        <Field label="Mémoire technique (PDF)">
          <FileDrop files={memo} onChange={setMemo} accept=".pdf" maxSizeMb={30} />
        </Field>
        <Field label="Réserves / exclusions" className="sm:col-span-2">
          <Textarea value={meta.exclusions} onChange={(e) => setMeta({ ...meta, exclusions: e.target.value })} rows={2} />
        </Field>
        {tender.variants_allowed ? (
          <>
            <Checkbox label="Il s'agit d'une variante" checked={meta.is_variant} onChange={(c) => setMeta({ ...meta, is_variant: c })} />
            {meta.is_variant ? (
              <Field label="Description de la variante" required help="5 caractères minimum" className="sm:col-span-2">
                <Textarea value={meta.variant_description} onChange={(e) => setMeta({ ...meta, variant_description: e.target.value })} rows={3} />
              </Field>
            ) : null}
          </>
        ) : null}
      </div>
      <Alert tone="info">Votre offre reste scellée jusqu'à la date limite : personne chez GLOBUS ne peut la consulter avant. Vous pouvez la retirer et la redéposer d'ici là.</Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={lines.some((l) => l.unit_price === "") || (meta.is_variant && meta.variant_description.trim().length < 5)}
          onClick={async () => {
            const bad = extra.findIndex((l) => (l.designation.trim() || l.unit_price !== "") && (!l.designation.trim() || toNumber(l.quantity) <= 0));
            if (bad >= 0) {
              setError(`Poste supplémentaire ${bad + 1} incomplet : désignation et quantité (supérieure à 0) obligatoires.`);
              return;
            }
            setBusy(true);
            setError(null);
            try {
              const [memoId] = memo.length ? await uploadFiles(memo) : [null];
              await api(`${BASE}/tenders/${tender.id}/bids`, {
                method: "POST",
                body: {
                  tender_lot_id: lot.id,
                  duration_days: meta.duration_days ? Number(meta.duration_days) : null,
                  is_variant: meta.is_variant,
                  variant_description: meta.is_variant ? meta.variant_description : null,
                  exclusions: meta.exclusions || null,
                  technical_memo_file_id: memoId,
                  lines: [
                    ...lines.map((l) => ({ tender_item_id: l.tender_item_id, unit_price: toNumber(l.unit_price) })),
                    ...extra.filter((l) => l.designation.trim() || l.unit_price !== "").map((l) => ({ designation: l.designation, unit: l.unit, quantity: toNumber(l.quantity), unit_price: toNumber(l.unit_price) })),
                  ],
                },
              });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send className="h-4 w-4" /> Déposer l'offre
        </Button>
      </div>
    </div>
  );
}

export function TenderPage({ id }: { id: string }) {
  const toast = useToast();
  const tender = useApi<Row>(`${BASE}/tenders/${id}`);
  const [lot, setLot] = useState<Row | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [counter, setCounter] = useState<Row | null>(null);
  const [offer, setOffer] = useState({ amount: "", duration_days: "", comment: "" });
  if (tender.loading && !tender.data) return <Skeleton className="h-96 w-full" />;
  if (!tender.data) return <Alert tone="danger">{tender.error}</Alert>;
  const t = tender.data;
  const open = t.status === "published" && new Date(t.deadline).getTime() > Date.now();
  const myBids = (t.my_bids ?? []) as Row[];
  const lastNeg = (b: Row): Row | null => {
    const n = (b.negotiations ?? []) as Row[];
    return n.length ? n[n.length - 1] : null;
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/extranet/consultations" className="hover:underline">Consultations</Link>}
        title={`${t.number} — ${t.title}`}
        subtitle={`${t.project ? `${t.project.name} (${t.project.city ?? ""}) · ` : ""}date limite ${dateTime(t.deadline)} (${relative(t.deadline)})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.invitation_status} />
            {open && t.invitation_status !== "declined" && !myBids.some((b) => b.status === "submitted") ? (
              <Button size="sm" variant="ghost" onClick={() => setDeclining(true)}>
                Décliner
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-2">
          {t.description ? <p className="whitespace-pre-line text-sm">{t.description}</p> : null}
          <DescriptionList
            columns={2}
            items={[
              { label: "Démarrage souhaité", value: date(t.start_date_target) },
              { label: "Durée cible", value: t.duration_days_target ? `${t.duration_days_target} jours` : "—" },
              { label: "Variantes", value: t.variants_allowed ? "Autorisées" : "Non autorisées" },
              { label: "Critères", value: Array.isArray(t.quality_criteria) ? (t.quality_criteria as Row[]).map((c) => `${c.label ?? optionLabel(c.key)} ${c.weight ?? ""}${c.weight ? " %" : ""}`).join(" · ") : "Prix, délai, valeur technique, historique" },
            ]}
          />
          {t.technical_spec ? (
            <details className="rounded-xl bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium">Cahier des charges technique</summary>
              <p className="mt-2 whitespace-pre-line">{t.technical_spec}</p>
            </details>
          ) : null}
          {t.exclusions ? <Alert tone="warning" title="Exclusions">{t.exclusions}</Alert> : null}
        </Card>
        <Card>
          <CardHeader title="Dossier de consultation" subtitle="Documents filigranés à votre nom" />
          <ul className="divide-y divide-line text-sm">
            {((t.documents ?? []) as Row[]).map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-5 py-2">
                <span>
                  {d.title} <span className="text-xs text-muted">v{d.version}</span>
                </span>
                <a href={d.url} target="_blank" rel="noopener noreferrer" aria-label={`Télécharger ${d.title}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                  <Download className="h-4 w-4" /> Télécharger
                </a>
              </li>
            ))}
            {!(t.documents ?? []).length ? <li className="px-5 py-3 text-muted">Aucun document joint.</li> : null}
          </ul>
        </Card>
      </div>
      {((t.lots ?? []) as Row[]).map((l) => {
        const bids = myBids.filter((b) => b.tender_lot_id === l.id && b.status !== "withdrawn");
        return (
          <Card key={l.id}>
            <CardHeader
              title={`Lot ${l.code} — ${l.name}`}
              subtitle={`${(l.items ?? []).length} poste(s)`}
              actions={
                open && t.invitation_status !== "declined" ? (
                  <Button size="sm" variant={bids.length ? "secondary" : "primary"} onClick={() => setLot(l)}>
                    <Send className="h-4 w-4" /> {bids.length ? (t.variants_allowed ? "Remplacer l'offre / variante" : "Remplacer l'offre") : "Remettre une offre"}
                  </Button>
                ) : null
              }
            />
            <ul className="divide-y divide-line text-sm">
              {((l.items ?? []) as Row[]).map((it) => (
                <li key={it.id} className="flex justify-between gap-2 px-5 py-1.5">
                  <span>
                    {it.code ? <span className="text-xs text-muted">{it.code} · </span> : null}
                    {it.designation}
                  </span>
                  <span className="tabular-nums text-muted">
                    {number(it.quantity, 2)} {it.unit}
                  </span>
                </li>
              ))}
            </ul>
            {bids.map((b) => {
              const n = lastNeg(b);
              const awaitingMe = n && n.status === "proposed" && n.proposed_by === "globus";
              return (
                <div key={b.id} className="space-y-2 border-t border-line bg-brand-50/40 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Mon offre : <strong>{money(b.final_amount ?? b.amount)}</strong> {b.final_amount && b.final_amount !== b.amount ? <span className="text-xs text-muted line-through">{money(b.amount)}</span> : null} {b.duration_days ? `· ${b.duration_days} j` : ""} {b.is_variant ? <Badge tone="accent">Variante</Badge> : null}
                      <span className="block text-xs text-muted">Déposée {dateTime(b.submitted_at ?? b.created_at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={b.status} />
                      {open && b.status === "submitted" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await api(`${BASE}/bids/${b.id}/withdraw`, { method: "POST" });
                              void tender.reload();
                            } catch (err) {
                              toast.error("Retrait impossible", errorMessage(err));
                            }
                          }}
                        >
                          Retirer
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  {(b.negotiations ?? []).length ? (
                    <ol className="space-y-1 text-xs">
                      {(b.negotiations as Row[]).map((neg) => (
                        <li key={neg.id}>
                          Tour {neg.round} · {neg.proposed_by === "globus" ? "GLOBUS" : "Vous"} : {money(neg.amount)} {neg.duration_days ? `· ${neg.duration_days} j` : ""} · {optionLabel(neg.status)} {neg.comment ? `— ${neg.comment}` : ""}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {awaitingMe ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await api(`${BASE}/bids/${b.id}/negotiations/accept`, { method: "POST" });
                            toast.success("Proposition acceptée");
                            void tender.reload();
                          } catch (err) {
                            toast.error("Acceptation impossible", errorMessage(err));
                          }
                        }}
                      >
                        Accepter {money(n?.amount)}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setCounter(b);
                          setOffer({ amount: "", duration_days: "", comment: "" });
                        }}
                      >
                        Contre-proposer
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
        );
      })}
      <Modal open={!!lot} onClose={() => setLot(null)} title={`Offre — lot ${lot?.code ?? ""} ${lot?.name ?? ""}`} size="xl">
        {lot ? (
          <BidForm
            tender={t}
            lot={lot}
            onCancel={() => setLot(null)}
            onDone={() => {
              setLot(null);
              void tender.reload();
              toast.success("Offre déposée", "Vous recevez un accusé de réception.");
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={declining}
        onClose={() => setDeclining(false)}
        title="Décliner la consultation"
        footer={
          <Button
            disabled={reason.trim().length < 5}
            onClick={async () => {
              try {
                await api(`${BASE}/tenders/${id}/decline`, { method: "POST", body: { reason: reason.trim() } });
                setDeclining(false);
                void tender.reload();
              } catch (err) {
                toast.error("Action impossible", errorMessage(err));
              }
            }}
          >
            Décliner
          </Button>
        }
      >
        <Field label="Motif (plan de charge, hors compétences…)" required help="5 caractères minimum">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </Field>
      </Modal>
      <Modal
        open={!!counter}
        onClose={() => setCounter(null)}
        title="Contre-proposition"
        footer={
          <Button
            disabled={toNumber(offer.amount) <= 0}
            onClick={async () => {
              try {
                await api(`${BASE}/bids/${counter?.id}/negotiations`, { method: "POST", body: { amount: toNumber(offer.amount), duration_days: offer.duration_days ? Number(offer.duration_days) : null, comment: offer.comment || null } });
                setCounter(null);
                void tender.reload();
              } catch (err) {
                toast.error("Envoi impossible", errorMessage(err));
              }
            }}
          >
            Envoyer
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Montant HT proposé" required>
            <Input type="number" min={0} step="any" value={offer.amount} onChange={(e) => setOffer({ ...offer, amount: e.target.value })} />
          </Field>
          <Field label="Délai (jours)">
            <Input type="number" min={1} value={offer.duration_days} onChange={(e) => setOffer({ ...offer, duration_days: e.target.value })} />
          </Field>
          <Field label="Commentaire">
            <Textarea value={offer.comment} onChange={(e) => setOffer({ ...offer, comment: e.target.value })} rows={2} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- marchés */

export function ContractsInbox() {
  const contracts = useApi<Row[]>(`${BASE}/subcontracts`);
  return (
    <div className="space-y-4">
      <PageTitle title="Mes marchés" subtitle="Contrats de sous-traitance : signature électronique, avancement, situations, retenue de garantie." />
      <Card>
        <DataTable
          rows={contracts.data ?? []}
          loading={contracts.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "number", label: "Marché", render: (r) => <Link href={`/extranet/marches/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link> },
            { key: "title", label: "Objet" },
            { key: "project", label: "Chantier", render: (r) => r.project?.name ?? "—" },
            { key: "amount", label: "Montant HT", format: "money", align: "right" },
            { key: "progress", label: "Avancement", render: (r) => <Progress value={toNumber(r.summary?.progress_pct)} className="w-28" label="Réalisé" /> },
            { key: "status", label: "Statut", render: (r) => (r.status === "sent" ? <Badge tone="accent">À signer</Badge> : <StatusBadge status={r.status} />) },
          ]}
          empty={{ title: "Aucun marché" }}
        />
      </Card>
    </div>
  );
}

function SituationCreate({ contract, onDone, onCancel }: { contract: Row; onDone: (s: Row) => void; onCancel: () => void }) {
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Début de période" required>
          <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
        </Field>
        <Field label="Fin de période" required>
          <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
        </Field>
      </div>
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr>
            <th className="py-1">Poste</th>
            <th className="py-1 text-right">Marché</th>
            <th className="py-1">Réalisé sur la période</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {((contract.items ?? []) as Row[]).map((it) => (
            <tr key={it.id}>
              <td className="py-1.5">{it.designation}</td>
              <td className="py-1.5 text-right tabular-nums">
                {number(it.quantity, 2)} {it.unit}
              </td>
              <td className="py-1.5">
                <Input type="number" min={0} step="any" className="w-32" value={qty[it.id] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Alert tone="info">Ajoutez ensuite des photos d'avancement géolocalisées : elles sont obligatoires pour soumettre la situation.</Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={!period.start || !period.end || !Object.values(qty).some((v) => toNumber(v) > 0)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              onDone(
                await api<Row>(`${BASE}/subcontracts/${contract.id}/situations`, {
                  method: "POST",
                  body: { period_start: period.start, period_end: period.end, lines: Object.entries(qty).filter(([, v]) => v !== "").map(([item_id, v]) => ({ item_id, period_quantity: toNumber(v) })) },
                }),
              );
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer la situation
        </Button>
      </div>
    </div>
  );
}

export function ContractPage({ id }: { id: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const contract = useApi<Row>(`${BASE}/subcontracts/${id}`);
  const [signing, setSigning] = useState(false);
  const [signer, setSigner] = useState("");
  const [accept, setAccept] = useState(false);
  const [creating, setCreating] = useState(false);
  if (contract.loading && !contract.data) return <Skeleton className="h-96 w-full" />;
  if (!contract.data) return <Alert tone="danger">{contract.error}</Alert>;
  const c = contract.data;
  const s = c.summary ?? {};
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/extranet/marches" className="hover:underline">Mes marchés</Link>}
        title={`${c.number} — ${c.title}`}
        subtitle={c.project ? `${c.project.code} · ${c.project.name}` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <a href={apiUrl(`${BASE}/subcontracts/${id}/pdf`)} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <Download className="h-3.5 w-3.5" /> Contrat PDF
            </a>
            {c.status === "sent" ? (
              <Button
                size="sm"
                variant="accent"
                onClick={() => {
                  setSigner(user?.full_name ?? "");
                  setSigning(true);
                }}
              >
                <FileSignature className="h-4 w-4" /> Signer le marché
              </Button>
            ) : null}
            {["signed", "mobilized", "in_progress"].includes(c.status) ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Nouvelle situation
              </Button>
            ) : null}
          </div>
        }
      />
      {c.status === "sent" ? <Alert tone="accent" title="Marché à signer">Lisez le contrat (PDF), puis signez par code à usage unique : la signature est horodatée et scellée.</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Montant du marché HT" value={money(c.amount)} tone="info" />
        <Stat label="Réalisé validé" value={money(s.cumulative_validated)} hint={`${number(s.progress_pct ?? 0, 1)} % · reste ${money(s.remaining_amount)}`} />
        <Stat label="Payé" value={money(s.paid)} hint={`Facturé ${money(s.invoiced)}`} tone="success" />
        <Stat label="Retenue de garantie" value={money(s.retention_held)} hint={optionLabel(s.retention_status)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bordereau" />
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Poste</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">PU</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {((c.items ?? []) as Row[]).map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-1.5">{it.designation}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {number(it.quantity, 2)} {it.unit}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(it.unit_price)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Situations" />
            <ul className="divide-y divide-line text-sm">
              {((c.situations ?? []) as Row[]).map((x) => (
                <li key={x.id} className="flex justify-between gap-2 px-5 py-2.5">
                  <Link href={`/extranet/situations/${x.id}`} className="text-brand-700 hover:underline">
                    {x.number} · {date(x.period_start)} → {date(x.period_end)}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{money(x.net_amount)}</span>
                    <StatusBadge status={x.status} />
                  </span>
                </li>
              ))}
              {!(c.situations ?? []).length ? <li className="px-5 py-3 text-muted">Aucune situation.</li> : null}
            </ul>
          </Card>
          {c.terms ? (
            <Card className="p-5">
              <p className="mb-2 font-semibold">Conditions particulières</p>
              <p className="whitespace-pre-line text-sm text-muted">{c.terms}</p>
            </Card>
          ) : null}
        </div>
      </div>
      <OtpDialog
        open={signing}
        onClose={() => setSigning(false)}
        title={`Signature du marché ${c.number}`}
        description={`Montant ${money(c.amount)} HT · retenue de garantie ${number(c.retention_pct ?? 0, 1)} %`}
        request={() => api(`${BASE}/subcontracts/${id}/sign/otp`, { method: "POST" })}
        canConfirm={accept && signer.trim().length >= 3}
        confirm={async (challenge, code) => {
          contract.setData(await api<Row>(`${BASE}/subcontracts/${id}/sign`, { method: "POST", body: { otp_token: challenge.otp_token, code, signer_name: signer.trim(), accept_terms: accept } }));
          toast.success("Marché signé", "GLOBUS est notifié ; la mobilisation peut être planifiée.");
        }}
        confirmLabel="Signer"
      >
        <div className="space-y-3">
          <Field label="Nom et qualité du signataire" required help="3 caractères minimum ; cochez aussi l'acceptation ci-dessous.">
            <Input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Jean Dupont, gérant" />
          </Field>
          <Checkbox label="J'ai lu le contrat et j'accepte ses conditions ; ma signature électronique engage mon entreprise." checked={accept} onChange={setAccept} />
        </div>
      </OtpDialog>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle situation de travaux" size="lg">
        <SituationCreate contract={c} onCancel={() => setCreating(false)} onDone={(sit) => router.push(`/extranet/situations/${sit.id}`)} />
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- situations */

export function SituationsInbox() {
  const rows = useApi<Row[]>(`${BASE}/situations`);
  return (
    <div className="space-y-4">
      <PageTitle title="Mes situations" subtitle="Déclarez l'avancement, joignez vos photos, suivez le contrôle et la validation, déposez la facture." />
      <Card>
        <DataTable
          rows={rows.data ?? []}
          loading={rows.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "number", label: "Situation", render: (r) => <Link href={`/extranet/situations/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link> },
            { key: "subcontract", label: "Marché", render: (r) => r.subcontract?.number ?? "—" },
            { key: "period", label: "Période", render: (r) => `${date(r.period_start)} → ${date(r.period_end)}` },
            { key: "net_amount", label: "Net à payer", format: "money", align: "right" },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucune situation" }}
        />
      </Card>
    </div>
  );
}

export function SituationPage({ id }: { id: string }) {
  const toast = useToast();
  const sit = useApi<Row>(`${BASE}/situations/${id}`);
  const [photos, setPhotos] = useState<File[]>([]);
  const [invoice, setInvoice] = useState({ reference: "", invoice_date: new Date().toISOString().slice(0, 10), amount: "" });
  const [invoiceFile, setInvoiceFile] = useState<File[]>([]);
  const [invoicing, setInvoicing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sit.loading && !sit.data) return <Skeleton className="h-96 w-full" />;
  if (!sit.data) return <Alert tone="danger">{sit.error}</Alert>;
  const s = sit.data;
  const upload = async () => {
    setBusy(true);
    try {
      const position = await new Promise<GeolocationPosition | null>((resolve) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 }) : resolve(null));
      for (const f of photos) {
        const fd = new FormData();
        fd.append("file", f);
        if (position) {
          fd.append("latitude", String(position.coords.latitude));
          fd.append("longitude", String(position.coords.longitude));
        }
        await api(`${BASE}/situations/${id}/photos`, { method: "POST", form: fd });
      }
      setPhotos([]);
      void sit.reload();
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/extranet/situations" className="hover:underline">Mes situations</Link>}
        title={`Situation ${s.number}`}
        subtitle={`${s.subcontract?.number ?? ""} — ${s.subcontract?.title ?? ""} · du ${date(s.period_start)} au ${date(s.period_end)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {s.status === "draft" ? (
              <Button
                size="sm"
                loading={busy}
                onClick={async () => {
                  try {
                    sit.setData(await api<Row>(`${BASE}/situations/${id}/submit`, { method: "POST" }));
                    toast.success("Situation soumise", "Le contrôle terrain va être planifié.");
                  } catch (err) {
                    toast.error("Soumission impossible", errorMessage(err));
                  }
                }}
              >
                <Send className="h-4 w-4" /> Soumettre
              </Button>
            ) : null}
            {s.status === "validated" ? (
              <Button
                size="sm"
                variant="accent"
                onClick={() => {
                  setInvoice((v) => ({ ...v, amount: String(toNumber(s.invoice_amount_expected ?? s.net_amount)) }));
                  setInvoicing(true);
                }}
              >
                <Upload className="h-4 w-4" /> Déposer la facture
              </Button>
            ) : null}
          </div>
        }
      />
      {s.status === "rejected" && s.rejection_reason ? <Alert tone="danger" title="Situation rejetée">{s.rejection_reason}</Alert> : null}
      {s.exceeds_contract && !s.derogation_granted ? <Alert tone="warning" title="Dépassement du marché">Les quantités déclarées dépassent le marché : la validation nécessite un avenant ou une dérogation de GLOBUS.</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Montant de la période" value={money(s.gross_amount)} tone="info" />
        <Stat label="Retenue de garantie" value={money(s.retention_amount)} />
        <Stat label="Avance récupérée / pénalités" value={money(toNumber(s.advance_recovered) + toNumber(s.penalties))} />
        <Stat label="Net à payer" value={money(s.net_amount)} tone="success" />
      </div>
      <Card>
        <CardHeader title="Avancement par poste" />
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Poste</th>
              <th className="px-3 py-2 text-right">Déclaré</th>
              <th className="px-3 py-2 text-right">Constaté</th>
              <th className="px-3 py-2 text-right">Cumul</th>
              <th className="px-3 py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {((s.lines ?? []) as Row[]).map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-1.5">{l.designation}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {number(l.period_quantity, 2)} {l.unit}
                </td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${l.checked_quantity !== null && l.checked_quantity !== undefined && toNumber(l.checked_quantity) < toNumber(l.period_quantity) ? "font-semibold text-amber-700" : ""}`}>{l.checked_quantity !== null && l.checked_quantity !== undefined ? number(l.checked_quantity, 2) : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{number(l.cumulative_quantity, 2)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.field_check_notes ? <p className="border-t border-line px-5 py-3 text-sm text-muted">Constat terrain : {s.field_check_notes}</p> : null}
      </Card>
      <Card>
        <CardHeader title="Photos d'avancement" subtitle="Obligatoires, datées et géolocalisées" />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {((s.photo_file_ids ?? []) as string[]).map((fid) => (
            <a key={fid} href={apiUrl(`${BASE}/situations/${id}/photos/${fid}`)} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-slate-100">
              <img src={apiUrl(`${BASE}/situations/${id}/photos/${fid}`)} alt="Photo d'avancement" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ))}
          {!(s.photo_file_ids ?? []).length ? <p className="col-span-full text-sm text-muted">Aucune photo.</p> : null}
        </div>
        {s.status === "draft" ? (
          <div className="space-y-2 border-t border-line p-4">
            <FileDrop files={photos} onChange={setPhotos} multiple accept="image/*" capture="environment" maxSizeMb={20} />
            <Button size="sm" loading={busy} disabled={!photos.length} onClick={upload}>
              <Camera className="h-4 w-4" /> Envoyer les photos
            </Button>
          </div>
        ) : null}
      </Card>
      <Modal
        open={invoicing}
        onClose={() => setInvoicing(false)}
        title="Facture de la situation"
        footer={
          <Button
            disabled={!invoice.reference || !invoiceFile.length || toNumber(invoice.amount) <= 0}
            onClick={async () => {
              try {
                const fd = new FormData();
                fd.append("reference", invoice.reference);
                fd.append("invoice_date", invoice.invoice_date);
                fd.append("amount", invoice.amount);
                fd.append("file", invoiceFile[0]);
                await api(`${BASE}/situations/${id}/invoice`, { method: "POST", form: fd });
                setInvoicing(false);
                void sit.reload();
                toast.success("Facture déposée", "Elle est contrôlée puis mise en paiement.");
              } catch (err) {
                toast.error("Dépôt impossible", errorMessage(err));
              }
            }}
          >
            Déposer
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="N° de facture" required>
            <Input value={invoice.reference} onChange={(e) => setInvoice({ ...invoice, reference: e.target.value })} />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={invoice.invoice_date} onChange={(e) => setInvoice({ ...invoice, invoice_date: e.target.value })} />
          </Field>
          <Field label="Montant TTC" required help={`Montant attendu : ${money(s.invoice_amount_expected ?? s.net_amount)} (net à payer, plus la TVA du marché le cas échéant)`}>
            <Input type="number" min={0} step="any" value={invoice.amount} onChange={(e) => setInvoice({ ...invoice, amount: e.target.value })} />
          </Field>
          <Field label="Facture (PDF ou image)" required>
            <FileDrop files={invoiceFile} onChange={setInvoiceFile} accept=".pdf,image/*" maxSizeMb={20} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- factures, réclamations, litiges */

export function SubcontractorInvoicesInbox() {
  const rows = useApi<Row[]>(`${BASE}/invoices`);
  return (
    <div className="space-y-4">
      <PageTitle title="Mes factures" subtitle="Factures déposées et leur traitement (validation, paiement, montants gelés en cas de litige)." />
      <Card>
        <DataTable
          rows={rows.data ?? []}
          loading={rows.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "reference", label: "N° de facture" },
            { key: "kind", label: "Type", format: "option" },
            { key: "invoice_date", label: "Date", format: "date" },
            { key: "amount", label: "Montant TTC", format: "money", align: "right" },
            { key: "amount_paid", label: "Réglé", format: "money", align: "right" },
            { key: "amount_frozen", label: "Gelé", render: (r) => (toNumber(r.amount_frozen) ? <Badge tone="danger">{money(r.amount_frozen)}</Badge> : "—") },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucune facture" }}
        />
      </Card>
    </div>
  );
}

export function ClaimsInbox() {
  const toast = useToast();
  const claims = useApi<Row[]>(`${BASE}/claims`);
  const contracts = useApi<Row[]>(`${BASE}/subcontracts`);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ subcontract_id: "", title: "", description: "", amount: "" });
  return (
    <div className="space-y-4">
      <PageTitle
        title="Réclamations"
        subtitle="Travaux supplémentaires, aléas, demandes de rémunération complémentaire : déposez-les ici, une réponse écrite vous est due."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nouvelle réclamation
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={claims.data ?? []}
          loading={claims.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "created_at", label: "Déposée", format: "date" },
            { key: "title", label: "Objet" },
            { key: "amount", label: "Montant", format: "money", align: "right" },
            { key: "response", label: "Réponse", render: (r) => r.response ?? "—" },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucune réclamation" }}
        />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle réclamation"
        footer={
          <Button
            disabled={v.title.trim().length < 3}
            onClick={async () => {
              try {
                await api(`${BASE}/claims`, { method: "POST", body: { subcontract_id: v.subcontract_id || null, title: v.title.trim(), description: v.description || null, amount: toNumber(v.amount) } });
                setOpen(false);
                setV({ subcontract_id: "", title: "", description: "", amount: "" });
                void claims.reload();
              } catch (err) {
                toast.error("Dépôt impossible", errorMessage(err));
              }
            }}
          >
            Déposer
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Marché concerné">
            <Select value={v.subcontract_id} onChange={(e) => setV({ ...v, subcontract_id: e.target.value })} options={[{ value: "", label: "—" }, ...(contracts.data ?? []).map((c) => ({ value: c.id, label: `${c.number} — ${c.title}` }))]} />
          </Field>
          <Field label="Objet" required help="3 caractères minimum">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Exposé">
            <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={4} />
          </Field>
          <Field label="Montant demandé HT">
            <Input type="number" min={0} step="any" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export function DisputesInbox() {
  const toast = useToast();
  const router = useRouter();
  const disputes = useApi<Row[]>(`${BASE}/disputes`);
  const contracts = useApi<Row[]>(`${BASE}/subcontracts`);
  const situations = useApi<Row[]>(`${BASE}/situations`);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ subcontract_id: "", situation_id: "", title: "", description: "", amount_disputed: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <PageTitle
        title="Litiges"
        subtitle="Désaccords sur des quantités, des pénalités ou des paiements : échanges et preuves horodatés jusqu'à la décision."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Gavel className="h-4 w-4" /> Ouvrir un litige
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={disputes.data ?? []}
          loading={disputes.loading}
          searchable={false}
          rowKey={(r) => r.id}
          columns={[
            { key: "number", label: "N°", render: (r) => <Link href={`/extranet/litiges/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link> },
            { key: "title", label: "Objet" },
            { key: "amount_disputed", label: "Montant contesté", format: "money", align: "right" },
            { key: "created_at", label: "Ouvert le", format: "date" },
            { key: "status", label: "Statut", format: "status" },
          ]}
          empty={{ title: "Aucun litige" }}
        />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ouvrir un litige"
        size="lg"
        footer={
          <Button
            loading={busy}
            disabled={v.title.trim().length < 3 || v.description.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              try {
                const file_ids = files.length ? await uploadFiles(files) : [];
                const d = await api<Row>(`${BASE}/disputes`, {
                  method: "POST",
                  body: { subcontract_id: v.subcontract_id || null, situation_id: v.situation_id || null, title: v.title.trim(), description: v.description.trim(), amount_disputed: toNumber(v.amount_disputed), file_ids },
                });
                router.push(`/extranet/litiges/${d.id}`);
              } catch (err) {
                toast.error("Ouverture impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Ouvrir le litige
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marché">
              <Select value={v.subcontract_id} onChange={(e) => setV({ ...v, subcontract_id: e.target.value })} options={[{ value: "", label: "—" }, ...(contracts.data ?? []).map((c) => ({ value: c.id, label: c.number }))]} />
            </Field>
            <Field label="Situation contestée">
              <Select value={v.situation_id} onChange={(e) => setV({ ...v, situation_id: e.target.value })} options={[{ value: "", label: "—" }, ...(situations.data ?? []).filter((x) => !v.subcontract_id || x.subcontract?.id === v.subcontract_id).map((x) => ({ value: x.id, label: `${x.number} (${date(x.period_end)})` }))]} />
            </Field>
          </div>
          <Field label="Objet" required help="3 caractères minimum">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Exposé des faits (10 caractères minimum)" required>
            <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={4} />
          </Field>
          <Field label="Montant contesté">
            <Input type="number" min={0} step="any" value={v.amount_disputed} onChange={(e) => setV({ ...v, amount_disputed: e.target.value })} />
          </Field>
          <Field label="Pièces justificatives">
            <FileDrop files={files} onChange={setFiles} multiple maxSizeMb={25} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export function DisputePage({ id }: { id: string }) {
  const toast = useToast();
  const dispute = useApi<Row>(`${BASE}/disputes/${id}`);
  const [event, setEvent] = useState({ kind: "comment", content: "", amount: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  if (dispute.loading && !dispute.data) return <Skeleton className="h-96 w-full" />;
  if (!dispute.data) return <Alert tone="danger">{dispute.error}</Alert>;
  const d = dispute.data;
  const events = (d.events ?? []) as Row[];
  const negotiating = d.status === "EN_NEGOCIATION";
  const lastOffer = [...events].reverse().find((e) => e.kind === "proposal" || e.kind === "counter_proposal");
  const canAgree = negotiating && lastOffer?.author_side === "globus";
  return (
    <div className="space-y-5">
      <PageTitle eyebrow={<Link href="/extranet/litiges" className="hover:underline">Litiges</Link>} title={`${d.number} — ${d.title}`} subtitle={`Ouvert le ${dateTime(d.created_at)}`} actions={<StatusBadge status={d.status} />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Montant contesté" value={money(d.amount_disputed)} tone="warning" />
        <Stat label="Montant gelé" value={money(d.amount_frozen)} hint="Bloqué jusqu'à la décision" />
        <Stat label="Accepté / refusé" value={d.status === "DECISION" || d.status === "RESOLU" ? `${money(d.amount_accepted)} / ${money(d.amount_refused)}` : "—"} />
      </div>
      {d.decision_summary ? <Alert tone="info" title={`Décision du ${dateTime(d.decided_at)}`}>{d.decision_summary}</Alert> : null}
      <Card>
        <CardHeader title="Chronologie" subtitle="Journal horodaté et non modifiable" />
        <ol className="ml-5 space-y-4 border-l-2 border-brand-100 py-5 pl-6 pr-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full ring-4 ring-white ${e.author_side === "party" ? "bg-brand-500" : "bg-accent-500"}`} />
              <p className="text-xs text-muted">
                {dateTime(e.created_at)} · {optionLabel(e.kind)} · {e.author_side === "party" ? "Vous" : "GLOBUS"}
                {e.from_status ? ` · ${optionLabel(e.from_status)} → ${optionLabel(e.to_status)}` : ""}
              </p>
              {e.amount !== null && e.amount !== undefined ? <p className="text-sm font-semibold">{money(e.amount)}</p> : null}
              {e.content ? <p className="whitespace-pre-line text-sm">{e.content}</p> : null}
              {((e.file_ids ?? []) as string[]).length ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {(e.file_ids as string[]).map((fid, i) => (
                    <a key={fid} href={apiUrl(`${BASE}/disputes/${id}/files/${fid}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                      <Download className="h-3 w-3" /> Pièce {i + 1}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
      {d.status !== "RESOLU" ? (
        <Card className="space-y-3 p-5">
          <p className="font-semibold">Ajouter à la chronologie</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={event.kind}
              onChange={(e) => setEvent({ ...event, kind: e.target.value })}
              options={[
                { value: "comment", label: "Commentaire" },
                { value: "evidence", label: "Preuve" },
                ...(negotiating ? [{ value: "counter_proposal", label: "Contre-proposition chiffrée" }] : []),
                ...(canAgree ? [{ value: "agreement", label: `Accord sur la proposition GLOBUS (${money(lastOffer?.amount)})` }] : []),
              ]}
              aria-label="Type"
            />
            {event.kind === "counter_proposal" ? <Input type="number" min={0} step="any" value={event.amount} onChange={(e) => setEvent({ ...event, amount: e.target.value })} placeholder="Montant proposé" /> : null}
          </div>
          <Textarea value={event.content} onChange={(e) => setEvent({ ...event, content: e.target.value })} rows={3} placeholder="Votre message" />
          <FileDrop files={files} onChange={setFiles} multiple maxSizeMb={25} label="Pièces (facultatif)" />
          <Button
            loading={busy}
            disabled={(event.kind === "comment" && !event.content.trim()) || (event.kind === "evidence" && !files.length) || (event.kind === "counter_proposal" && toNumber(event.amount) <= 0)}
            onClick={async () => {
              setBusy(true);
              try {
                const file_ids = files.length ? await uploadFiles(files) : [];
                dispute.setData(await api<Row>(`${BASE}/disputes/${id}/events`, { method: "POST", body: { kind: event.kind, content: event.content || null, amount: event.kind === "counter_proposal" ? toNumber(event.amount) : null, file_ids } }));
                setEvent({ kind: "comment", content: "", amount: "" });
                setFiles([]);
              } catch (err) {
                toast.error("Envoi impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send className="h-4 w-4" /> Envoyer
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- accueil, profil */

export function SubcontractorHome() {
  const tenders = useApi<Row[]>(`${BASE}/tenders`);
  const contracts = useApi<Row[]>(`${BASE}/subcontracts`);
  const situations = useApi<Row[]>(`${BASE}/situations`);
  const payments = useApi<Row[]>(`${BASE}/payments`);
  const openTenders = (tenders.data ?? []).filter((t) => t.open);
  const toSign = (contracts.data ?? []).filter((c) => c.status === "sent");
  const drafts = (situations.data ?? []).filter((s) => s.status === "draft");
  const paid = (payments.data ?? []).filter((p) => p.status === "succeeded").reduce((s, p) => s + toNumber(p.amount), 0);
  return (
    <div className="space-y-5">
      <PageTitle title="Espace sous-traitant" subtitle="Consultations, marchés, situations de travaux, factures et paiements GLOBUS." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Consultations ouvertes" value={openTenders.length} tone="info" />
        <Stat label="Marchés à signer" value={toSign.length} tone={toSign.length ? "accent" : "neutral"} />
        <Stat label="Situations en brouillon" value={drafts.length} />
        <Stat label="Total encaissé" value={money(paid)} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Consultations en cours" />
          <ul className="divide-y divide-line text-sm">
            {openTenders.map((t) => (
              <li key={t.id} className="flex justify-between gap-2 px-5 py-2.5">
                <Link href={`/extranet/consultations/${t.id}`} className="text-brand-700 hover:underline">
                  {t.number} · {t.title}
                </Link>
                <span className="text-xs text-muted">limite {relative(t.deadline)}</span>
              </li>
            ))}
            {!openTenders.length ? (
              <li className="p-5">
                <EmptyState title="Aucune consultation ouverte" />
              </li>
            ) : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="À faire" />
          <ul className="divide-y divide-line text-sm">
            {toSign.map((c) => (
              <li key={c.id} className="px-5 py-2.5">
                <Link href={`/extranet/marches/${c.id}`} className="text-brand-700 hover:underline">
                  Signer le marché {c.number}
                </Link>
              </li>
            ))}
            {drafts.map((s) => (
              <li key={s.id} className="px-5 py-2.5">
                <Link href={`/extranet/situations/${s.id}`} className="text-brand-700 hover:underline">
                  Compléter et soumettre la situation {s.number}
                </Link>
              </li>
            ))}
            {!toSign.length && !drafts.length ? <li className="px-5 py-4 text-muted">Rien en attente.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function SubcontractorProfile() {
  const toast = useToast();
  const profile = useApi<Row>(`${BASE}/profile`);
  const [edit, setEdit] = useState<Row | null>(null);
  if (profile.loading && !profile.data) return <Skeleton className="h-64" />;
  if (!profile.data) return <Alert tone="danger">{profile.error}</Alert>;
  const p = profile.data;
  const h = p.history ?? {};
  const v = edit ?? { email: p.email ?? "", phone: p.phone ?? "", whatsapp: p.whatsapp ?? "", address: p.address ?? "", workforce_size: p.workforce_size ?? 0, zones: p.zones ?? [], insurance_rc_until: p.insurance_rc_until ?? "", insurance_decennale_until: p.insurance_decennale_until ?? "" };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Score GLOBUS" value={number(h.score ?? p.score ?? 0, 1)} tone="info" />
        <Stat label="Marchés terminés" value={h.completed_contracts ?? 0} />
        <Stat label="Ponctualité" value={`${number(h.on_time_rate ?? 0, 1)} %`} />
        <Stat label="Note moyenne" value={h.rating_average ? `${number(h.rating_average, 2)} / 5` : "—"} />
      </div>
      <Card>
        <CardHeader title={p.trade_name || p.legal_name} subtitle={(p.trades ?? []).map((t: string) => optionLabel(t)).join(", ")} actions={<StatusBadge status={p.status} />} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <DescriptionList
            columns={1}
            items={[
              { label: "Raison sociale", value: p.legal_name },
              { label: "NIU / RCCM", value: [p.tax_id, p.trade_register].filter(Boolean).join(" · ") || "—" },
              { label: "Compte bancaire", value: p.bank_account_masked ?? "—" },
              { label: "Mobile Money", value: p.mobile_money_masked ?? "—" },
              { label: "Assurances à jour", value: p.insurance_ok ? <Badge tone="success">Oui</Badge> : <Badge tone="danger">À mettre à jour</Badge> },
            ]}
          />
          <div className="space-y-3">
            <Field label="E-mail">
              <Input type="email" value={v.email} onChange={(e) => setEdit({ ...v, email: e.target.value })} />
            </Field>
            <Field label="Téléphone / WhatsApp">
              <div className="flex gap-2">
                <Input value={v.phone} onChange={(e) => setEdit({ ...v, phone: e.target.value })} />
                <Input value={v.whatsapp} onChange={(e) => setEdit({ ...v, whatsapp: e.target.value })} />
              </div>
            </Field>
            <Field label="Adresse">
              <Input value={v.address} onChange={(e) => setEdit({ ...v, address: e.target.value })} />
            </Field>
            <Field label="Effectif">
              <Input type="number" min={0} value={v.workforce_size} onChange={(e) => setEdit({ ...v, workforce_size: Number(e.target.value) })} />
            </Field>
            <Field label="Zones d'intervention">
              <TagInput value={v.zones} onChange={(z) => setEdit({ ...v, zones: z })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Assurance RC jusqu'au">
                <Input type="date" value={v.insurance_rc_until ?? ""} onChange={(e) => setEdit({ ...v, insurance_rc_until: e.target.value })} />
              </Field>
              <Field label="Décennale jusqu'au">
                <Input type="date" value={v.insurance_decennale_until ?? ""} onChange={(e) => setEdit({ ...v, insurance_decennale_until: e.target.value })} />
              </Field>
            </div>
            {edit ? (
              <Button
                onClick={async () => {
                  try {
                    profile.setData(await api<Row>(`${BASE}/profile`, { method: "PATCH", body: { ...v, email: v.email || null, insurance_rc_until: v.insurance_rc_until || null, insurance_decennale_until: v.insurance_decennale_until || null } }));
                    setEdit(null);
                    toast.success("Profil mis à jour");
                  } catch (err) {
                    toast.error("Mise à jour impossible", errorMessage(err));
                  }
                }}
              >
                Enregistrer
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
