"use client";

import { CheckCircle2, Copy, KeyRound, LogOut, ShieldCheck, Unlock, XCircle } from "lucide-react";
import { useState } from "react";

import type { Row } from "@/components/erp/resource";
import { MultiRefSelect } from "@/components/forms/ref-select";
import { DonutChart } from "@/components/ui/charts";
import { Field, Input, Select, TagInput } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, EmptyState, PageTitle, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, number, relative, toNumber } from "@/lib/format";
import { useApi, useList } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const CRITICALITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { CRITICAL: "danger", HIGH: "warning" };

/* ----------------------------------------------------------------------------- synthèse */

export function SecurityOverview() {
  const { can } = useAuth();
  const toast = useToast();
  const overview = useApi<Row>("/admin/security/overview");
  if (overview.loading && !overview.data) return <Skeleton className="h-72" />;
  if (!overview.data) return <Alert tone="danger">{overview.error}</Alert>;
  const o = overview.data;
  const mfaPct = o.users.active ? (toNumber(o.users.mfa_enabled) * 100) / toNumber(o.users.active) : 0;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Comptes actifs" value={number(o.users.active)} hint={`${number(o.users.total)} au total`} tone="info" />
        <Stat label="Double authentification" value={`${number(mfaPct, 0)} %`} hint={`${number(o.users.mfa_enabled)} compte(s) protégé(s)`} tone={mfaPct >= 80 ? "success" : "warning"} icon={<ShieldCheck className="h-5 w-5" />} />
        <Stat label="MFA exigée non activée" value={(o.users.mfa_missing ?? []).length} tone={(o.users.mfa_missing ?? []).length ? "danger" : "success"} />
        <Stat label="Échecs de connexion (24 h)" value={number(o.failed_logins_24h)} tone={o.failed_logins_24h > 20 ? "danger" : "neutral"} />
        <Stat label="Comptes verrouillés" value={(o.locked_accounts ?? []).length} tone={(o.locked_accounts ?? []).length ? "warning" : "success"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Sessions actives" subtitle={`${number(o.sessions.total)} session(s)`} />
          <div className="p-4">
            <DonutChart data={Object.entries((o.sessions.by_application ?? {}) as Record<string, number>).map(([k, v]) => ({ name: optionLabel(k), value: toNumber(v) }))} height={200} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Comptes verrouillés" subtitle="Après plusieurs échecs de connexion" />
          <ul className="divide-y divide-line text-sm">
            {(o.locked_accounts as Row[]).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-5 py-2">
                <span>
                  {u.name}
                  <span className="block text-xs text-muted">
                    {u.email} · {u.failed_login_count} échec(s) · jusqu'au {dateTime(u.locked_until)}
                  </span>
                </span>
                {can("users:write") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api(`/users/${u.id}/unlock`, { method: "POST" });
                        void overview.reload();
                      } catch (err) {
                        toast.error("Déverrouillage impossible", errorMessage(err));
                      }
                    }}
                  >
                    <Unlock className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
            {!(o.locked_accounts ?? []).length ? <li className="px-5 py-4 text-muted">Aucun compte verrouillé.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="MFA à activer" subtitle="Rôles ou comptes soumis à la double authentification" />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
            {(o.users.mfa_missing as Row[]).map((u) => (
              <li key={u.id} className="px-5 py-2">
                {u.name} <span className="text-xs text-muted">{u.email}</span>
              </li>
            ))}
            {!(o.users.mfa_missing ?? []).length ? <li className="px-5 py-4 text-muted">Tous les comptes concernés sont protégés.</li> : null}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Alertes de sécurité récentes" subtitle="Événements de criticité élevée ou critique (chaîne d'audit infalsifiable)." />
        <ul className="divide-y divide-line text-sm">
          {(o.alerts as Row[]).map((a) => (
            <li key={a.event_id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">
                  {optionLabel(a.module)} · {a.action}
                </span>
                <span className="block text-xs text-muted">
                  {dateTime(a.timestamp_utc)} · {a.actor_label ?? a.actor_type} {a.ip ? `· ${a.ip}` : ""} {a.application ? `· ${a.application}` : ""}
                </span>
                {a.reason ? <span className="block text-xs">{a.reason}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                {a.result === "FAIL" ? <XCircle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                <Badge tone={CRITICALITY_TONE[a.criticality] ?? "neutral"}>{a.criticality}</Badge>
              </span>
            </li>
          ))}
          {!(o.alerts ?? []).length ? <li className="px-5 py-4 text-muted">Aucune alerte.</li> : null}
        </ul>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------------- sessions */

export function ActiveSessions() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList<Row>("/admin/security/sessions", { pageSize: 50 });
  const [revoke, setRevoke] = useState<Row | null>(null);
  return (
    <Card>
      <CardHeader title="Sessions actives" subtitle={`${list.total} session(s) en cours (toutes applications)`} />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Utilisateur</th>
              <th className="px-3 py-2">Application</th>
              <th className="px-3 py-2">Adresse IP</th>
              <th className="px-3 py-2">Méthode</th>
              <th className="px-3 py-2">Ouverte</th>
              <th className="px-3 py-2">Dernière activité</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.items.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">
                  {s.user}
                  <span className="block text-xs text-muted">{s.email}</span>
                </td>
                <td className="px-3 py-2">{optionLabel(s.application ?? "web")}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.ip ?? "—"}</td>
                <td className="px-3 py-2">
                  {optionLabel(s.auth_method)} {s.mfa_verified ? <Badge tone="success">MFA</Badge> : null}
                </td>
                <td className="px-3 py-2 text-xs">{dateTime(s.created_at)}</td>
                <td className="px-3 py-2 text-xs">{s.last_used_at ? relative(s.last_used_at) : "—"}</td>
                <td className="px-3 py-2">
                  {can("security:manage") ? (
                    <Button size="sm" variant="ghost" onClick={() => setRevoke(s)}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length ? <div className="p-5 text-sm text-muted">Aucune session active.</div> : null}
      </div>
      <ConfirmDialog
        open={!!revoke}
        onClose={() => setRevoke(null)}
        title={`Déconnecter ${revoke?.user ?? ""}`}
        text="Toutes les sessions de cet utilisateur sont révoquées immédiatement (web, mobile, bureau)."
        tone="danger"
        onConfirm={async () => {
          const res = await api<Row>(`/users/${revoke?.user_id}/revoke-sessions`, { method: "POST" });
          toast.success(`${res.revoked} session(s) révoquée(s)`);
          void list.reload();
        }}
      />
    </Card>
  );
}

/* ----------------------------------------------------------------------------- clés d'API */

export function ApiKeys() {
  const { can } = useAuth();
  const toast = useToast();
  const keys = useApi<Row[]>("/api-keys");
  const permissions = useApi<Row[]>("/permissions");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; scopes: string[]; expires_at: string; allowed_ips: string[] }>({ name: "", scopes: [], expires_at: "", allowed_ips: [] });
  const [created, setCreated] = useState<Row | null>(null);
  const [revoking, setRevoking] = useState<Row | null>(null);
  return (
    <Card>
      <CardHeader
        title="Clés d'API (intégrations machine à machine)"
        subtitle="Portées limitées aux permissions choisies ; restriction d'adresses IP ; expiration."
        actions={
          can("security:manage") ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <KeyRound className="h-4 w-4" /> Nouvelle clé
            </Button>
          ) : null
        }
      />
      <ul className="divide-y divide-line text-sm">
        {(keys.data ?? []).map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <span>
              {k.name} <span className="font-mono text-xs text-muted">{k.key_prefix}…</span>
              <span className="block text-xs text-muted">
                {(k.scopes ?? []).join(", ")} · {k.last_used_at ? `utilisée ${relative(k.last_used_at)}` : "jamais utilisée"} {k.expires_at ? `· expire ${dateTime(k.expires_at)}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <StatusBadge status={k.revoked_at ? "cancelled" : "active"} label={k.revoked_at ? "Révoquée" : "Active"} />
              {can("security:manage") && !k.revoked_at ? (
                <Button size="sm" variant="ghost" onClick={() => setRevoking(k)}>
                  Révoquer
                </Button>
              ) : null}
            </span>
          </li>
        ))}
        {!keys.loading && !keys.data?.length ? <li className="px-5 py-4 text-muted">Aucune clé.</li> : null}
      </ul>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouvelle clé d'API"
        size="lg"
        footer={
          <Button
            disabled={draft.name.length < 2 || !draft.scopes.length}
            onClick={async () => {
              try {
                const res = await api<Row>("/api-keys", { method: "POST", body: { name: draft.name, scopes: draft.scopes, expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null, allowed_ips: draft.allowed_ips } });
                setCreating(false);
                setCreated(res);
                setDraft({ name: "", scopes: [], expires_at: "", allowed_ips: [] });
                void keys.reload();
              } catch (err) {
                toast.error("Création impossible", errorMessage(err));
              }
            }}
          >
            Créer
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Nom">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Logiciel de comptabilité" />
          </Field>
          <Field label="Portées (permissions accordées)">
            <MultiRefSelect source={{ path: "/permissions", label: (r) => `${r.label} (${r.code})`, sublabel: (r) => optionLabel(r.module), paginated: false }} value={draft.scopes} onChange={(scopes) => setDraft({ ...draft, scopes })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Expiration">
              <Input type="datetime-local" value={draft.expires_at} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} />
            </Field>
            <Field label="Adresses IP autorisées (vide = toutes)">
              <TagInput value={draft.allowed_ips} onChange={(ips) => setDraft({ ...draft, allowed_ips: ips })} />
            </Field>
          </div>
          {permissions.data?.some((p) => draft.scopes.includes(p.code) && p.sensitive) ? <Alert tone="warning">Portée sensible sélectionnée : limitez l'adresse IP et la durée de validité.</Alert> : null}
        </div>
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)} title="Clé créée">
        <div className="space-y-3">
          <Alert tone="warning">Copiez cette clé maintenant : elle ne sera plus jamais affichée.</Alert>
          <div className="flex items-center gap-2 rounded-xl bg-slate-950 p-3">
            <code className="flex-1 break-all text-xs text-emerald-300">{created?.key}</code>
            <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(created?.key ?? "").then(() => toast.success("Clé copiée"))}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Révoquer la clé ${revoking?.name ?? ""}`}
        text="Les intégrations utilisant cette clé cessent immédiatement de fonctionner."
        tone="danger"
        onConfirm={async () => {
          await api(`/api-keys/${revoking?.id}`, { method: "DELETE" });
          void keys.reload();
        }}
      />
    </Card>
  );
}

export function SecurityCenter() {
  const { can } = useAuth();
  const [tab, setTab] = useState("synthese");
  return (
    <div className="space-y-5">
      <PageTitle title="Sécurité" subtitle="Double authentification, sessions, verrouillages, alertes, clés d'API — politique Zero Trust." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "synthese", label: "Synthèse" },
          { key: "sessions", label: "Sessions actives" },
          { key: "cles", label: "Clés d'API", hidden: !can("security:manage") },
        ]}
      />
      {tab === "synthese" ? <SecurityOverview /> : null}
      {tab === "sessions" ? <ActiveSessions /> : null}
      {tab === "cles" ? <ApiKeys /> : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------- journal d'audit */

export function AuditLog() {
  const toast = useToast();
  const [filters, setFilters] = useState({ family: "", module: "", action: "", criticality: "", start: "", end: "", actor_id: [] as string[] });
  const list = useList<Row>("/admin/audit", { pageSize: 50 }, { family: filters.family || undefined, module: filters.module || undefined, action: filters.action || undefined, criticality: filters.criticality || undefined, start: filters.start ? new Date(filters.start).toISOString() : undefined, end: filters.end ? new Date(filters.end).toISOString() : undefined, actor_id: filters.actor_id[0] || undefined });
  const [selected, setSelected] = useState<Row | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<Row | null>(null);
  return (
    <div className="space-y-5">
      <PageTitle
        title="Journal d'audit"
        subtitle="Traçabilité infalsifiable (chaînage cryptographique) des actions métier, sécurité et système."
        actions={
          <Button
            variant="secondary"
            loading={verifying}
            onClick={async () => {
              setVerifying(true);
              try {
                setVerification(await api<Row>("/admin/audit/verify"));
              } catch (err) {
                toast.error("Vérification impossible", errorMessage(err));
              } finally {
                setVerifying(false);
              }
            }}
          >
            <ShieldCheck className="h-4 w-4" /> Vérifier l'intégrité
          </Button>
        }
      />
      {verification ? (
        <Alert tone={verification.valid ? "success" : "danger"} title={verification.valid ? "Chaîne d'audit intègre" : "Rupture de la chaîne d'audit détectée"}>
          {number(verification.checked)} événement(s) vérifié(s)
          {verification.broken_at_seq ? ` · rupture à l'événement n° ${verification.broken_at_seq}` : ""}
        </Alert>
      ) : null}
      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <Select value={filters.family} onChange={(e) => setFilters({ ...filters, family: e.target.value })} options={[{ value: "", label: "Toutes familles" }, { value: "business", label: "Métier" }, { value: "security", label: "Sécurité" }, { value: "system", label: "Système" }]} aria-label="Famille" />
        <Input value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} placeholder="Module (ex. payments)" />
        <Input value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value.toUpperCase() })} placeholder="Action (ex. APPROVE)" />
        <Select value={filters.criticality} onChange={(e) => setFilters({ ...filters, criticality: e.target.value })} options={[{ value: "", label: "Toutes criticités" }, ...["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((c) => ({ value: c, label: c }))]} aria-label="Criticité" />
        <Field label="Du">
          <Input type="datetime-local" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
        </Field>
        <Field label="Au">
          <Input type="datetime-local" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
        </Field>
        <Field label="Auteur" className="md:col-span-2">
          <MultiRefSelect source={REFS.users} value={filters.actor_id} onChange={(ids) => setFilters({ ...filters, actor_id: ids.slice(-1) })} />
        </Field>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">N°</th>
                <th className="px-3 py-2">Horodatage (UTC)</th>
                <th className="px-3 py-2">Auteur</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Ressource</th>
                <th className="px-3 py-2">Résultat</th>
                <th className="px-3 py-2">Criticité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.items.map((e) => (
                <tr key={e.event_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(e)}>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.seq}</td>
                  <td className="px-3 py-1.5 text-xs">{dateTime(e.timestamp_utc)}</td>
                  <td className="px-3 py-1.5">
                    {e.actor_label ?? optionLabel(e.actor_type)}
                    {e.application ? <span className="block text-xs text-muted">{e.application}</span> : null}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs text-muted">{optionLabel(e.family)} · {e.module}</span>
                    <span className="block font-medium">{e.action}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {e.resource_type ?? "—"} {e.resource_id ? <span className="font-mono">{String(e.resource_id).slice(0, 8)}</span> : null}
                  </td>
                  <td className="px-3 py-1.5">{e.result === "FAIL" ? <Badge tone="danger">Échec</Badge> : <Badge tone="success">OK</Badge>}</td>
                  <td className="px-3 py-1.5">
                    <Badge tone={CRITICALITY_TONE[e.criticality] ?? "neutral"}>{e.criticality}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.loading && !list.items.length ? (
            <div className="p-6">
              <EmptyState title="Aucun événement" text="Ajustez les filtres." />
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
          <span className="text-muted">
            {number(list.total)} événement(s) · page {list.state.page}
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={list.state.page <= 1} onClick={() => list.setPage(list.state.page - 1)}>
              Précédent
            </Button>
            <Button size="sm" variant="secondary" disabled={list.state.page * list.state.pageSize >= list.total} onClick={() => list.setPage(list.state.page + 1)}>
              Suivant
            </Button>
          </span>
        </div>
      </Card>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Événement n° ${selected?.seq ?? ""}`} size="lg">
        {selected ? (
          <div className="space-y-3">
            <DescriptionList
              items={[
                { label: "Horodatage", value: dateTime(selected.timestamp_utc) },
                { label: "Famille / module", value: `${optionLabel(selected.family)} · ${selected.module}` },
                { label: "Action", value: selected.action },
                { label: "Auteur", value: `${selected.actor_label ?? "—"} (${optionLabel(selected.actor_type)})` },
                { label: "Application", value: [selected.application, selected.app_version].filter(Boolean).join(" ") || "—" },
                { label: "Adresse IP", value: selected.ip ?? "—" },
                { label: "Ressource", value: `${selected.resource_type ?? "—"} ${selected.resource_id ?? ""}` },
                { label: "Projet", value: selected.project_id ?? "—" },
                { label: "Résultat", value: selected.result },
                { label: "Criticité", value: selected.criticality },
                { label: "Requête", value: selected.request_id ?? "—" },
              ]}
            />
            {selected.reason ? <Alert tone="info" title="Motif">{selected.reason}</Alert> : null}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted">Modifications</p>
              <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.diff ?? {}, null, 2)}</pre>
            </div>
            <p className="break-all font-mono text-[11px] text-muted">
              Empreinte {selected.integrity_hash} · précédente {selected.prev_hash ?? "—"}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
