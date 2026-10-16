"use client";

import { Download, Printer, QrCode, RefreshCw, ScanLine, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { CellLink, ResourceView, type Row } from "@/components/erp/resource";
import { RefSelect } from "@/components/forms/ref-select";
import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { personTradeField } from "@/components/forms/trade-select";
import { BracketsEditor, RowsEditor, WeekdaysPicker } from "@/components/forms/structured-fields";
import { Checkbox, Field, FileDrop, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, download, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel, personTradeOptions } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
const CONTRACTS = ["CDI", "CDD", "journalier", "stage", "interim"];
const DOC_KINDS = ["contrat", "cni", "diplome", "certificat_medical", "avertissement", "attestation", "fiche_paie"];
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const time = (value?: string | null) => (value ? new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—");

/* ----------------------------------------------------------------------------- employés */

export function EmployeesList() {
  const router = useRouter();
  return (
    <ResourceView
      embedded
      config={{
        title: "Personnel",
        subtitle: "Dossiers, contrats, badges QR, affectations chantier ; données sensibles chiffrées et masquées.",
        path: "/hr/employees",
        href: (r) => `/erp/rh/employes/${r.id}`,
        columns: [
          { key: "matricule", label: "Matricule", render: (r) => <CellLink href={`/erp/rh/employes/${r.id}`}>{r.matricule}</CellLink> },
          { key: "last_name", label: "Nom", sortable: true, render: (r) => r.full_name },
          { key: "job_title", label: "Poste" },
          { key: "trade", label: "Métier", format: "option", hideOnMobile: true },
          { key: "contract_type", label: "Contrat", format: "option", hideOnMobile: true },
          { key: "hire_date", label: "Embauche", format: "date", sortable: true, hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [
          { key: "status", label: "Statut", options: opts(["active", "suspended", "terminated"]) },
          { key: "trade", label: "Métier", options: personTradeOptions() },
        ],
        create: {
          endpoint: "POST /hr/employees",
          label: "Nouvel employé",
          perms: ["hr:write"],
          initial: { contract_type: "CDI", pay_frequency: "monthly", hire_date: today() },
          fields: {
            trade: personTradeField,
            contract_type: { options: opts(CONTRACTS) },
            pay_frequency: { options: opts(["monthly", "weekly", "daily"]) },
            gender: { options: [{ value: "M", label: "Homme" }, { value: "F", label: "Femme" }, { value: "X", label: "Non précisé" }] },
            user_id: { ref: "users", label: "Compte utilisateur (auto-pointage, espace salarié)" },
            national_id: { help: "Chiffré au repos, masqué à l'affichage." },
            social_security_number: { help: "Chiffré au repos, masqué à l'affichage." },
            bank_account: { help: "Chiffré au repos, masqué à l'affichage." },
          },
        },
        actions: [{ key: "open", label: "Ouvrir le dossier", run: (r) => router.push(`/erp/rh/employes/${r.id}`) }],
      }}
    />
  );
}

export function EmployeeDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const employee = useApi<Row>(`/hr/employees/${id}`);
  const history = useApi<Row[]>(`/hr/employees/${id}/history`);
  const docs = useApi<Row[]>(`/hr/employees/${id}/documents`);
  const attendance = useApi<{ items: Row[] }>("/hr/attendance", { employee_id: id, page_size: 31 });
  const leaves = useApi<{ items: Row[] }>("/hr/leaves", { employee_id: id, page_size: 20 });
  const [tab, setTab] = useState("dossier");
  const [dialog, setDialog] = useState<null | "edit" | "terminate" | "badge" | "doc" | "regen">(null);
  const [badgeKey, setBadgeKey] = useState(0);
  if (employee.loading && !employee.data) return <Skeleton className="h-96 w-full" />;
  if (!employee.data) return <Alert tone="danger">{employee.error}</Alert>;
  const e = employee.data;
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/rh" className="hover:underline">Personnel</Link>}
        title={e.full_name}
        subtitle={`${e.matricule} · ${e.job_title}${e.trade ? ` · ${optionLabel(e.trade)}` : ""} · ${optionLabel(e.contract_type)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            {can("hr:write") && e.status === "active" ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("badge")}>
                  <QrCode className="h-4 w-4" /> Badge
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("edit")}>
                  Modifier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog("terminate")}>
                  Fin de contrat
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Embauche" value={date(e.hire_date)} hint={e.end_date ? `Fin ${date(e.end_date)}` : undefined} />
        <Stat label="Rémunération" value={e.base_salary !== undefined ? money(e.base_salary) : "Confidentiel"} hint={e.base_salary !== undefined ? `${optionLabel(e.pay_frequency)} · ${money(e.daily_rate)} / jour · ${money(e.hourly_rate)} / h` : undefined} />
        <Stat label="Affectation" value={e.current_project_id ? "Chantier" : "Siège"} hint={e.department ?? undefined} />
        <Stat label="Pointages (31 j)" value={attendance.data?.items?.length ?? 0} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "dossier", label: "Dossier" },
          { key: "documents", label: "Documents", count: docs.data?.length ?? null },
          { key: "pointage", label: "Pointage" },
          { key: "conges", label: "Congés" },
          { key: "historique", label: "Historique" },
        ]}
      />
      {tab === "dossier" ? (
        <Card className="p-5">
          <DescriptionList
            columns={3}
            items={[
              { label: "Téléphone", value: e.phone },
              { label: "E-mail", value: e.email },
              { label: "Adresse", value: e.address },
              { label: "Naissance", value: date(e.birth_date) },
              { label: "Contact d'urgence", value: e.emergency_contact },
              { label: "Département", value: e.department },
              { label: "N° CNI", value: e.national_id_masked },
              { label: "N° CNPS", value: e.social_security_number_masked },
              { label: "Compte bancaire", value: e.bank_account_masked },
              { label: "Mobile Money", value: e.mobile_money_number_masked ?? e.mobile_money_number },
              { label: "Compte utilisateur", value: e.user_id ? "Lié" : "Non lié" },
            ]}
          />
        </Card>
      ) : null}
      {tab === "documents" ? (
        <Card>
          <CardHeader
            title="Documents RH"
            subtitle="Accès tracés et filigranés ; documents « très sensibles » réservés à la paie."
            actions={
              can("hr:write") ? (
                <Button size="sm" onClick={() => setDialog("doc")}>
                  <Upload className="h-4 w-4" /> Ajouter
                </Button>
              ) : null
            }
          />
          <ul className="divide-y divide-line text-sm">
            {(docs.data ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  {d.title}
                  <span className="block text-xs text-muted">
                    {optionLabel(d.kind)} · {optionLabel(d.confidentiality)} · {dateTime(d.created_at)}
                    {d.expiry_date ? ` · expire le ${date(d.expiry_date)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {d.expiry_date && new Date(d.expiry_date).getTime() < Date.now() ? <Badge tone="danger">Expiré</Badge> : null}
                  <a href={apiUrl(`/hr/documents/${d.id}/file`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                    <Download className="h-4 w-4" /> Ouvrir
                  </a>
                </span>
              </li>
            ))}
            {!docs.data?.length ? <li className="px-5 py-4 text-muted">Aucun document.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "pointage" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {(attendance.data?.items ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-2">
                <span>
                  {date(a.work_date)} · {time(a.check_in)} → {time(a.check_out)}
                  <span className="block text-xs text-muted">
                    {optionLabel(a.method)} · {number(a.hours_worked, 2)} h{toNumber(a.overtime_hours) ? ` dont ${number(a.overtime_hours, 2)} h sup.` : ""}
                    {a.inside_geofence === false ? " · hors zone chantier" : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.validated_at ? <Badge tone="success">Validé</Badge> : null}
                </span>
              </li>
            ))}
            {!attendance.data?.items?.length ? <li className="px-5 py-4 text-muted">Aucun pointage.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "conges" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {(leaves.data?.items ?? []).map((l) => (
              <li key={l.id} className="flex justify-between gap-2 px-5 py-2">
                <span>
                  {optionLabel(l.kind)} · {date(l.start_date)} → {date(l.end_date)} ({number(l.days, 1)} j)
                  {l.reason ? <span className="block text-xs text-muted">{l.reason}</span> : null}
                </span>
                <StatusBadge status={l.status} />
              </li>
            ))}
            {!leaves.data?.items?.length ? <li className="px-5 py-4 text-muted">Aucune demande.</li> : null}
          </ul>
        </Card>
      ) : null}
      {tab === "historique" ? (
        <Card>
          <ol className="space-y-3 p-5">
            {(history.data ?? []).map((h) => (
              <li key={h.id} className="text-sm">
                <span className="text-xs text-muted">{date(h.effective_date)}</span> · <strong>{optionLabel(h.kind)}</strong> — {h.description}
              </li>
            ))}
            {!history.data?.length ? <li className="text-sm text-muted">Aucun événement.</li> : null}
          </ol>
        </Card>
      ) : null}

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Modifier le dossier" size="xl">
        <SchemaForm
          endpoint="PATCH /hr/employees/{employee_id}"
          params={{ employee_id: id }}
          initial={e}
          partial
          exclude={can("hr:payroll") ? [] : ["base_salary", "hourly_rate", "daily_rate"]}
          fields={{
            trade: personTradeField,
            contract_type: { options: opts(CONTRACTS) },
            pay_frequency: { options: opts(["monthly", "weekly", "daily"]) },
            status: { options: opts(["active", "suspended"]) },
            user_id: { ref: "users" },
            reason: { widget: "textarea", help: "Obligatoire pour toute modification de rémunération (tracée)." },
            national_id: { placeholder: e.national_id_masked ?? "", help: "Laisser vide pour ne pas modifier." },
            social_security_number: { placeholder: e.social_security_number_masked ?? "", help: "Laisser vide pour ne pas modifier." },
            bank_account: { placeholder: e.bank_account_masked ?? "", help: "Laisser vide pour ne pas modifier." },
          }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            employee.setData(res);
            setDialog(null);
            void history.reload();
          }}
        />
      </Modal>
      <Modal open={dialog === "terminate"} onClose={() => setDialog(null)} title="Fin de contrat">
        <SchemaForm
          endpoint="POST /hr/employees/{employee_id}/terminate"
          params={{ employee_id: id }}
          initial={{ end_date: today() }}
          fields={{ reason: { widget: "textarea" } }}
          onCancel={() => setDialog(null)}
          onSuccess={(res: Row) => {
            employee.setData(res);
            setDialog(null);
            toast.success("Contrat clôturé", "Le badge est désactivé.");
          }}
          columns={1}
        />
      </Modal>
      <Modal
        open={dialog === "badge"}
        onClose={() => setDialog(null)}
        title={`Badge — ${e.full_name}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDialog("regen")}>
              <RefreshCw className="h-4 w-4" /> Régénérer
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimer
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-64 rounded-2xl border-2 border-brand-500 p-4 text-center print:border-black">
          <p className="font-display text-lg font-bold text-brand-700">GLOBUS</p>
          <img key={badgeKey} src={`${apiUrl(`/hr/employees/${id}/badge`)}?v=${badgeKey}`} alt={`QR du badge de ${e.full_name}`} className="mx-auto my-3 h-48 w-48" />
          <p className="font-semibold">{e.full_name}</p>
          <p className="text-xs text-muted">
            {e.matricule} · {e.job_title}
          </p>
        </div>
        <p className="mt-3 text-center text-xs text-muted">Chaque affichage du badge est tracé. Régénérer invalide l'ancien QR (perte, vol).</p>
      </Modal>
      <ConfirmDialog
        open={dialog === "regen"}
        onClose={() => setDialog("badge")}
        title="Régénérer le badge"
        text="L'ancien QR ne sera plus accepté au pointage."
        tone="danger"
        onConfirm={async () => {
          await api(`/hr/employees/${id}/badge/regenerate`, { method: "POST" });
          setBadgeKey((k) => k + 1);
          setDialog("badge");
        }}
      />
      <Modal open={dialog === "doc"} onClose={() => setDialog(null)} title="Ajouter un document">
        <SchemaForm
          endpoint="POST /hr/employees/{employee_id}/documents"
          params={{ employee_id: id }}
          initial={{ confidentiality: "confidential", kind: "contrat" }}
          fields={{ kind: { options: opts(DOC_KINDS) }, confidentiality: { options: opts(["internal", "confidential", "very_sensitive"]) } }}
          onCancel={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            void docs.reload();
          }}
          columns={1}
        />
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------- pointage */

function ScanStation({ onScanned }: { onScanned: () => void }) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [badge, setBadge] = useState("");
  const [last, setLast] = useState<Row | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const submit = async () => {
    const value = badge.trim();
    if (value.length < 8) return;
    setBadge("");
    try {
      const res = await api<Row>("/hr/attendance/scan", { method: "POST", body: { badge: value, project_id: projectId, site_id: siteId, client_mutation_id: crypto.randomUUID() } });
      setLast(res);
      onScanned();
    } catch (err) {
      toast.error("Pointage refusé", errorMessage(err));
    } finally {
      input.current?.focus();
    }
  };
  return (
    <Card>
      <CardHeader title="Poste de pointage" subtitle="Douchette QR ou saisie : le premier scan du jour enregistre l'arrivée, le suivant le départ." />
      <div className="grid gap-4 p-5 md:grid-cols-3">
        <Field label="Projet">
          <RefSelect source={REFS.projects} value={projectId} onChange={(v) => { setProjectId(v); setSiteId(null); }} />
        </Field>
        <Field label="Site">
          <RefSelect key={projectId ?? "none"} source={REFS.sites} value={siteId} onChange={setSiteId} context={{ project_id: projectId }} />
        </Field>
        <Field label="Badge">
          <Input
            ref={input}
            value={badge}
            onChange={(ev) => setBadge(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                void submit();
              }
            }}
            placeholder="Scanner le badge…"
            autoComplete="off"
          />
        </Field>
      </div>
      {last ? (
        <div className="border-t border-line px-5 py-3 text-sm">
          <ScanLine className="mr-1 inline h-4 w-4 text-emerald-600" />
          {last.employee} ({last.matricule}) — {last.scan === "out" ? "départ" : "arrivée"} à {time(last.scan === "out" ? last.check_out : last.check_in)}
        </div>
      ) : null}
    </Card>
  );
}

function SiteQr() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="QR d'auto-pointage du chantier" subtitle="À afficher à l'entrée : les salariés pointent depuis l'application mobile (géolocalisation obligatoire)." />
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Projet">
          <RefSelect source={REFS.projects} value={projectId} onChange={(v) => { setProjectId(v); setSiteId(null); }} />
        </Field>
        <Field label="Site">
          <RefSelect key={projectId ?? "none"} source={REFS.sites} value={siteId} onChange={setSiteId} context={{ project_id: projectId }} />
        </Field>
        {siteId ? (
          <div className="text-center">
            <img src={apiUrl(`/hr/sites/${siteId}/attendance-qr`)} alt="QR du chantier" className="mx-auto h-40 w-40" />
            <Button size="sm" variant="ghost" onClick={() => window.open(apiUrl(`/hr/sites/${siteId}/attendance-qr`), "_blank", "noopener")}>
              <Printer className="h-4 w-4" /> Imprimer
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function AttendanceView() {
  const { can, canAny } = useAuth();
  const [range, setRange] = useState({ start: monthStart(), end: today() });
  const [version, setVersion] = useState(0);
  return (
    <div className="space-y-6">
      {canAny("hr:write", "site:report") ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ScanStation onScanned={() => setVersion((v) => v + 1)} />
          <SiteQr />
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Du">
          <Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </Field>
        <Field label="Au">
          <Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </Field>
      </div>
      <ResourceView
        key={version}
        embedded
        config={{
          title: "Pointages",
          path: "/hr/attendance",
          query: { start: range.start || undefined, end: range.end || undefined },
          exportDataset: "attendance",
          columns: [
            { key: "work_date", label: "Date", format: "date" },
            { key: "employee", label: "Employé", render: (r) => `${r.employee} (${r.matricule})` },
            { key: "check_in", label: "Arrivée", render: (r) => time(r.check_in) },
            { key: "check_out", label: "Départ", render: (r) => time(r.check_out) },
            { key: "hours_worked", label: "Heures", render: (r) => `${number(r.hours_worked, 2)}${toNumber(r.overtime_hours) ? ` (+${number(r.overtime_hours, 2)})` : ""}` },
            { key: "method", label: "Mode", format: "option", hideOnMobile: true },
            { key: "inside_geofence", label: "Zone", render: (r) => (r.inside_geofence === false ? <Badge tone="danger">Hors zone</Badge> : r.inside_geofence ? <Badge tone="success">Sur site</Badge> : "—"), hideOnMobile: true },
            { key: "status", label: "Statut", format: "status" },
            { key: "validated_at", label: "Validé", render: (r) => (r.validated_at ? "Oui" : "Non") },
          ],
          create: can("hr:write")
            ? { endpoint: "POST /hr/attendance/manual", label: "Saisie manuelle", perms: ["hr:write"], initial: { work_date: today(), status: "present" }, fields: { status: { options: opts(["present", "absent", "late", "leave", "sick"]) }, reason: { help: "Motif de la saisie manuelle (tracé)." } } }
            : undefined,
          actions: [{ key: "validate", label: "Valider", path: (r) => `/hr/attendance/${r.id}/validate`, when: (r) => !r.validated_at, perms: ["hr:write", "site:report"], success: "Pointage validé" }],
        }}
      />
    </div>
  );
}

export function AttendanceSummary() {
  const [range, setRange] = useState({ start: monthStart(), end: today() });
  const [projectId, setProjectId] = useState<string | null>(null);
  const summary = useApi<Row[]>("/hr/attendance/summary", { start: range.start, end: range.end, project_id: projectId ?? undefined });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Du">
          <Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </Field>
        <Field label="Au">
          <Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </Field>
        <div className="w-64">
          <Field label="Projet">
            <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Tous" />
          </Field>
        </div>
      </div>
      {summary.loading && !summary.data ? (
        <Skeleton className="h-40" />
      ) : summary.error ? (
        <Alert tone="danger">{summary.error}</Alert>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Employé</th>
                  <th className="px-3 py-2 text-right">Jours présents</th>
                  <th className="px-3 py-2 text-right">Heures</th>
                  <th className="px-3 py-2 text-right">Heures sup.</th>
                  <th className="px-3 py-2 text-right">Retards</th>
                  <th className="px-3 py-2 text-right">Absences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(summary.data ?? []).map((r) => (
                  <tr key={r.employee_id}>
                    <td className="px-3 py-2">
                      <CellLink href={`/erp/rh/employes/${r.employee_id}`}>{r.name}</CellLink> <span className="text-xs text-muted">{r.matricule}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.days_present, 1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.hours, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{number(r.overtime_hours, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.late}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${toNumber(r.absences) ? "font-semibold text-red-600" : ""}`}>{r.absences}</td>
                  </tr>
                ))}
                {!summary.data?.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted">
                      Aucun pointage sur la période.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------- congés */

export function LeavesList() {
  return (
    <ResourceView
      embedded
      config={{
        title: "Congés et absences",
        path: "/hr/leaves",
        columns: [
          { key: "employee_id", label: "Employé", render: (r) => <CellLink href={`/erp/rh/employes/${r.employee_id}`}>Dossier</CellLink> },
          { key: "kind", label: "Type", format: "option" },
          { key: "start_date", label: "Du", format: "date" },
          { key: "end_date", label: "Au", format: "date" },
          { key: "days", label: "Jours", format: "number" },
          { key: "reason", label: "Motif", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        filters: [{ key: "status", label: "Statut", options: opts(["pending", "approved", "rejected", "cancelled"]) }],
        create: { endpoint: "POST /hr/leaves", label: "Nouvelle absence", perms: ["hr:write"], fields: { kind: { options: opts(["conge", "maladie", "sans_solde", "autre"]) }, reason: { widget: "textarea" } } },
        actions: [
          { key: "approve", label: "Accorder", path: (r) => `/hr/leaves/${r.id}/decision`, when: (r) => r.status === "pending", perms: ["hr:write"], body: () => ({ approve: true }), confirm: "Accorder ce congé ?", success: "Congé accordé" },
          { key: "reject", label: "Refuser", path: (r) => `/hr/leaves/${r.id}/decision`, when: (r) => r.status === "pending", perms: ["hr:write"], body: () => ({ approve: false }), confirm: "Refuser ce congé ?", tone: "danger", success: "Congé refusé" },
        ],
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- paie */

export function PayrollRunsList() {
  const router = useRouter();
  return (
    <ResourceView
      embedded
      config={{
        title: "Paie",
        subtitle: "Calcul depuis les pointages (heures, heures sup.), cotisations paramétrées, double validation RH / finance, preuve de paiement.",
        path: "/hr/payroll-runs",
        href: (r) => `/erp/rh/paie/${r.id}`,
        columns: [
          { key: "period", label: "Période", render: (r) => <CellLink href={`/erp/rh/paie/${r.id}`}>{r.period}</CellLink> },
          { key: "number", label: "N°", hideOnMobile: true },
          { key: "employees", label: "Salariés", format: "number" },
          { key: "total_gross", label: "Brut", format: "money", align: "right" },
          { key: "total_net", label: "Net", format: "money", align: "right" },
          { key: "total_employer_charges", label: "Charges patronales", format: "money", align: "right", hideOnMobile: true },
          { key: "status", label: "Statut", format: "status" },
        ],
        create: { endpoint: "POST /hr/payroll-runs", label: "Nouvelle paie", perms: ["hr:payroll"], initial: { period: new Date().toISOString().slice(0, 7) }, fields: { period: { help: "Format AAAA-MM", placeholder: "2026-10" } } },
        actions: [{ key: "open", label: "Ouvrir", run: (r) => router.push(`/erp/rh/paie/${r.id}`) }],
      }}
    />
  );
}

export function PayrollRunDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const run = useApi<Row>(`/hr/payroll-runs/${id}`);
  const [adjust, setAdjust] = useState<Row | null>(null);
  const [dialog, setDialog] = useState<null | "validate" | "paid">(null);
  const [paid, setPaid] = useState({ method: "bank_transfer", reference: "" });
  const [proof, setProof] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  if (run.loading && !run.data) return <Skeleton className="h-96 w-full" />;
  if (!run.data) return <Alert tone="danger">{run.error}</Alert>;
  const r = run.data;
  const editable = ["draft", "computed"].includes(r.status);
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow={<Link href="/erp/rh?onglet=paie" className="hover:underline">Paie</Link>}
        title={`Paie ${r.period}`}
        subtitle={`${r.number} · calculée ${dateTime(r.computed_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} />
            <Button size="sm" variant="secondary" onClick={() => void download(`/hr/payroll-runs/${id}/export.csv`, `paie-${r.period}.csv`).catch((err) => toast.error("Export impossible", errorMessage(err)))}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {can("hr:payroll") && editable ? (
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    run.setData(await api(`/hr/payroll-runs/${id}/compute`, { method: "POST" }));
                    toast.success("Paie recalculée");
                  } catch (err) {
                    toast.error("Calcul impossible", errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" /> Recalculer
              </Button>
            ) : null}
            {can("hr:payroll", "finance:approve") && r.status === "computed" ? (
              <Button size="sm" onClick={() => setDialog("validate")}>
                Valider (finance)
              </Button>
            ) : null}
            {can("finance:pay") && r.status === "validated" ? (
              <Button size="sm" variant="accent" onClick={() => setDialog("paid")}>
                Marquer payée
              </Button>
            ) : null}
          </div>
        }
      />
      {!r.parameters_reviewed ? (
        <Alert tone="warning" title="Paramètres de paie non revus">
          Les taux de cotisation utilisés sont ceux par défaut : faites-les valider par un expert-comptable (onglet « Paramètres de paie ») avant toute paie réelle.
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Brut" value={money(r.total_gross)} tone="info" />
        <Stat label="Retenues salariales" value={money(r.total_deductions)} />
        <Stat label="Charges patronales" value={money(r.total_employer_charges)} />
        <Stat label="Net à payer" value={money(r.total_net)} tone="success" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Salarié</th>
                <th className="px-3 py-2 text-right">Jours / heures</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-right">H. sup.</th>
                <th className="px-3 py-2 text-right">Primes + indemn.</th>
                <th className="px-3 py-2 text-right">Brut</th>
                <th className="px-3 py-2 text-right">Retenues</th>
                <th className="px-3 py-2 text-right">Avances</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {((r.items ?? []) as Row[]).map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2">
                    <CellLink href={`/erp/rh/employes/${i.employee_id}`}>{i.employee}</CellLink>
                    <span className="block text-xs text-muted">{i.matricule}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {number(i.days_worked, 1)} j · {number(i.hours_worked, 1)} h
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(i.base_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(i.overtime_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(toNumber(i.bonuses) + toNumber(i.allowances))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(i.gross)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" title={Object.entries((i.deduction_details ?? {}) as Record<string, unknown>).map(([k, v]) => `${k} : ${v}`).join("\n")}>
                    {money(i.deductions)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(i.advances)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(i.net)}</td>
                  <td className="px-3 py-2">
                    <span className="flex gap-1">
                      {can("hr:payroll") && editable ? (
                        <Button size="sm" variant="ghost" onClick={() => setAdjust(i)}>
                          Ajuster
                        </Button>
                      ) : null}
                      <a href={apiUrl(`/hr/payroll-runs/${id}/items/${i.id}/payslip`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                        Bulletin
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`Ajustement — ${adjust?.employee ?? ""}`}>
        {adjust ? (
          <SchemaForm
            endpoint="PATCH /hr/payroll-runs/{run_id}/items/{item_id}"
            params={{ run_id: id, item_id: adjust.id }}
            initial={{ bonuses: adjust.bonuses, allowances: adjust.allowances, advances: adjust.advances }}
            fields={{ reason: { widget: "textarea", help: "Motif obligatoire (tracé)." } }}
            onCancel={() => setAdjust(null)}
            onSuccess={(res: Row) => {
              run.setData(res);
              setAdjust(null);
            }}
            columns={1}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={dialog === "validate"}
        onClose={() => setDialog(null)}
        title="Valider la paie"
        text={`Net total ${money(r.total_net)} pour ${(r.items ?? []).length} salarié(s). Les bulletins sont générés et la masse salariale imputée aux chantiers au prorata des heures.`}
        onConfirm={async () => {
          run.setData(await api(`/hr/payroll-runs/${id}/validate`, { method: "POST" }));
        }}
      />
      <Modal
        open={dialog === "paid"}
        onClose={() => setDialog(null)}
        title="Paiement des salaires"
        footer={
          <Button
            loading={busy}
            disabled={!proof.length}
            onClick={async () => {
              setBusy(true);
              try {
                const fd = new FormData();
                fd.append("method", paid.method);
                if (paid.reference) fd.append("reference", paid.reference);
                fd.append("proof", proof[0]);
                run.setData(await api(`/hr/payroll-runs/${id}/paid`, { method: "POST", form: fd }));
                setDialog(null);
                toast.success("Paie marquée payée", "Les bulletins sont disponibles dans l'espace salarié.");
              } catch (err) {
                toast.error("Enregistrement impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Mode de paiement">
            <Select value={paid.method} onChange={(e) => setPaid({ ...paid, method: e.target.value })} options={opts(["bank_transfer", "mobile_money", "cash", "cheque"])} />
          </Field>
          <Field label="Référence">
            <Input value={paid.reference} onChange={(e) => setPaid({ ...paid, reference: e.target.value })} />
          </Field>
          <Field label="Preuve (ordre de virement, état signé)" required>
            <FileDrop files={proof} onChange={setProof} accept=".pdf,image/*" maxSizeMb={20} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

const PAYROLL_REQUIRED: [string, string][] = [
  ["monthly_hours", "heures mensuelles"],
  ["overtime_rate", "majoration des heures supplémentaires"],
  ["unpaid_day_divisor", "diviseur journalier"],
];
const IRPP_REQUIRED: [string, string][] = [
  ["professional_abatement_pct", "abattement professionnel"],
  ["annual_abatement", "abattement annuel"],
  ["monthly_exemption_threshold", "seuil d'exonération"],
  ["cac_pct", "CAC"],
];

/** Paramètres de paie saisis par rubrique (généralités, cotisations, IRPP, barèmes RAV et TDL), sans JSON. */
function PayrollParametersEditor({ value, onChange }: { value: Row; onChange: (v: Row) => void }) {
  const set = (patch: Row) => onChange({ ...value, ...patch });
  const irpp: Row = value.irpp && typeof value.irpp === "object" ? value.irpp : {};
  const setIrpp = (patch: Row) => set({ irpp: { ...irpp, ...patch } });
  const num = (text: string) => (text === "" ? null : Number(text));
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold text-ink">Généralités</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Heures mensuelles" help="Base du taux horaire (173,33 h).">
            <Input type="number" min={1} step="any" value={value.monthly_hours ?? ""} onChange={(e) => set({ monthly_hours: num(e.target.value) })} />
          </Field>
          <Field label="Majoration des heures sup." help="Coefficient : 1,2 = +20 %.">
            <Input type="number" min={1} step="any" value={value.overtime_rate ?? ""} onChange={(e) => set({ overtime_rate: num(e.target.value) })} />
          </Field>
          <Field label="Diviseur journalier" help="Retenue par jour non payé = salaire ÷ ce nombre.">
            <Input type="number" min={1} step={1} value={value.unpaid_day_divisor ?? ""} onChange={(e) => set({ unpaid_day_divisor: num(e.target.value) })} />
          </Field>
          <Field label="Devise">
            <Input value={value.currency ?? ""} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} maxLength={3} />
          </Field>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-ink">Cotisations</h3>
        <p className="text-xs text-muted">La retenue salariale de code CNPS_PVID est déduite de la base imposable de l'IRPP.</p>
        <RowsEditor
          value={Array.isArray(value.contributions) ? value.contributions : []}
          onChange={(contributions) => set({ contributions })}
          itemLabel="Cotisation"
          title={(r, i) => r.label || r.code || `Cotisation ${i + 1}`}
          fields={[
            { key: "code", label: "Code", placeholder: "Ex. CNPS_PVID" },
            { key: "label", label: "Libellé" },
            { key: "employee_rate", label: "Part salarié (%)", type: "number", min: 0 },
            { key: "employer_rate", label: "Part employeur (%)", type: "number", min: 0 },
            { key: "ceiling", label: "Plafond mensuel (FCFA)", type: "number", min: 0, help: "Vide = sans plafond." },
          ]}
          newRow={() => ({ code: "", label: "", base: "gross", employee_rate: 0, employer_rate: 0, ceiling: null })}
          addLabel="Cotisation"
        />
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-ink">IRPP et CAC</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Abattement professionnel (%)">
            <Input type="number" min={0} step="any" value={irpp.professional_abatement_pct ?? ""} onChange={(e) => setIrpp({ professional_abatement_pct: num(e.target.value) })} />
          </Field>
          <Field label="Abattement annuel (FCFA)">
            <Input type="number" min={0} step="any" value={irpp.annual_abatement ?? ""} onChange={(e) => setIrpp({ annual_abatement: num(e.target.value) })} />
          </Field>
          <Field label="Seuil d'exonération mensuel (FCFA)">
            <Input type="number" min={0} step="any" value={irpp.monthly_exemption_threshold ?? ""} onChange={(e) => setIrpp({ monthly_exemption_threshold: num(e.target.value) })} />
          </Field>
          <Field label="CAC (% de l'IRPP)">
            <Input type="number" min={0} step="any" value={irpp.cac_pct ?? ""} onChange={(e) => setIrpp({ cac_pct: num(e.target.value) })} />
          </Field>
        </div>
        <Field label="Barème progressif de l'IRPP">
          <BracketsEditor value={irpp.brackets} onChange={(brackets) => setIrpp({ brackets })} ceilingLabel="Revenu annuel imposable jusqu'à (FCFA)" valueLabel="Taux (%)" />
        </Field>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Field label="Barème de la RAV (redevance audiovisuelle)">
          <BracketsEditor value={value.rav_brackets} onChange={(rav_brackets) => set({ rav_brackets })} ceilingLabel="Salaire brut jusqu'à (FCFA)" valueLabel="Montant (FCFA)" />
        </Field>
        <Field label="Barème de la TDL (taxe de développement local)">
          <BracketsEditor value={value.tdl_brackets} onChange={(tdl_brackets) => set({ tdl_brackets })} ceilingLabel="Salaire de base jusqu'à (FCFA)" valueLabel="Montant (FCFA)" />
        </Field>
      </section>
    </div>
  );
}

export function PayrollParameters() {
  const { can } = useAuth();
  const toast = useToast();
  const params = useApi<Row>("/hr/payroll-parameters");
  const [draft, setDraft] = useState<Row | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (params.loading && !params.data) return <Skeleton className="h-64" />;
  if (!params.data) return <Alert tone="danger">{params.error}</Alert>;
  const p = params.data;
  const value = draft ?? Object.fromEntries(Object.entries(p).filter(([k]) => !["reviewed", "reviewer_note"].includes(k)));
  const irpp: Row = value.irpp ?? {};
  const missing = [...PAYROLL_REQUIRED.filter(([k]) => !value[k]), ...IRPP_REQUIRED.filter(([k]) => irpp[k] === null || irpp[k] === undefined)].map(([, label]) => label);
  return (
    <div className="space-y-4">
      {p.reviewed ? <Alert tone="success" title="Paramètres revus">{p.reviewer_note ?? "Validés par un expert."}</Alert> : <Alert tone="warning" title="Paramètres par défaut, non revus">Taux CNPS, CFC, FNE, IRPP, RAV, TDL à faire valider avant la première paie réelle.</Alert>}
      <Card>
        <CardHeader title="Contributions" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2 text-right">Salarié %</th>
                <th className="px-3 py-2 text-right">Employeur %</th>
                <th className="px-3 py-2 text-right">Plafond</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {((p.contributions ?? []) as Row[]).map((c) => (
                <tr key={c.code}>
                  <td className="px-3 py-1.5 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-1.5">{c.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(c.employee_rate, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{number(c.employer_rate, 2)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.ceiling ? money(c.ceiling) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {can("hr:payroll", "settings:write") ? (
        <Card className="space-y-4 p-5">
          <PayrollParametersEditor value={value} onChange={setDraft} />
          {missing.length ? <Alert tone="warning">À renseigner avant d'enregistrer : {missing.join(", ")}.</Alert> : null}
          <Checkbox label="Paramètres revus et validés par un expert-comptable" checked={reviewed} onChange={setReviewed} />
          <Field label="Note du réviseur">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cabinet, date, référence de la lettre de mission…" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              disabled={missing.length > 0}
              onClick={async () => {
                setBusy(true);
                try {
                  params.setData(await api("/hr/payroll-parameters", { method: "PUT", body: { parameters: value, reviewed, reviewer_note: note || null } }));
                  setDraft(null);
                  toast.success("Paramètres enregistrés");
                } catch (err) {
                  toast.error("Enregistrement impossible", errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enregistrer
            </Button>
            {draft ? (
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
                Annuler les modifications
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function WorkSchedulesList() {
  const workingDays: FieldConfig = { span: 2, label: "Jours travaillés", render: ({ value, onChange }) => <WeekdaysPicker value={value} onChange={onChange} /> };
  return (
    <ResourceView
      embedded
      config={{
        title: "Horaires de travail",
        path: "/hr/work-schedules",
        columns: [
          { key: "name", label: "Horaire" },
          { key: "start_time", label: "Début" },
          { key: "end_time", label: "Fin" },
          { key: "break_minutes", label: "Pause (min)" },
        ],
        create: { endpoint: "POST /hr/work-schedules", label: "Nouvel horaire", perms: ["hr:write"], initial: { working_days: [0, 1, 2, 3, 4, 5] }, fields: { working_days: workingDays } },
        update: { endpoint: "PATCH /hr/work-schedules/{item_id}", perms: ["hr:write"], fields: { working_days: workingDays } },
        remove: { path: (r) => `/hr/work-schedules/${r.id}`, perms: ["hr:write"] },
      }}
    />
  );
}

export function HrHub({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const { can, canAny } = useAuth();
  return (
    <div className="space-y-5">
      <PageTitle title="Ressources humaines" subtitle="Personnel, badges et pointage géolocalisé, congés, paie camerounaise paramétrable." />
      <Tabs
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "personnel", label: "Personnel" },
          { key: "pointage", label: "Pointage" },
          { key: "synthese", label: "Synthèse", hidden: !can("hr:read") },
          { key: "conges", label: "Congés", hidden: !can("hr:read") },
          { key: "paie", label: "Paie", hidden: !can("hr:payroll") },
          { key: "horaires", label: "Horaires", hidden: !can("hr:read") },
          { key: "parametres", label: "Paramètres de paie", hidden: !can("hr:payroll") },
        ]}
      />
      {tab === "personnel" ? <EmployeesList /> : null}
      {tab === "pointage" && canAny("hr:read", "site:report") ? <AttendanceView /> : null}
      {tab === "synthese" ? <AttendanceSummary /> : null}
      {tab === "conges" ? <LeavesList /> : null}
      {tab === "paie" ? <PayrollRunsList /> : null}
      {tab === "horaires" ? <WorkSchedulesList /> : null}
      {tab === "parametres" ? <PayrollParameters /> : null}
    </div>
  );
}
