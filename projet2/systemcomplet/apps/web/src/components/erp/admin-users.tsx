"use client";

import { KeyRound, Lock, LogOut, Plus, Send, ShieldOff, Trash2, Unlock } from "lucide-react";
import { useMemo, useState } from "react";

import { ResourceView, type Row } from "@/components/erp/resource";
import { MultiRefSelect } from "@/components/forms/ref-select";
import type { FieldConfig } from "@/components/forms/schema-form";
import { type Discipline, disciplineNames, DisciplinesPicker } from "@/components/forms/discipline-picker";
import { personTradeField } from "@/components/forms/trade-select";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, DescriptionList, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, relative } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const AUDIENCES: Record<string, string> = { internal: "Équipe interne", client: "Clients", partner: "Partenaires (fournisseurs, sous-traitants)" };

/** Choix des rôles (groupés par public) — un utilisateur cumule les permissions de ses rôles. */
function RolePicker({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const roles = useApi<Row[]>("/roles");
  const groups = useMemo(() => {
    const out: Record<string, Row[]> = {};
    for (const r of roles.data ?? []) (out[r.audience] ??= []).push(r);
    return out;
  }, [roles.data]);
  if (roles.loading && !roles.data) return <Skeleton className="h-24" />;
  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      {Object.entries(groups).map(([audience, list]) => (
        <div key={audience}>
          <p className="mb-1 text-xs font-semibold uppercase text-muted">{AUDIENCES[audience] ?? audience}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {list.map((r) => (
              <Checkbox key={r.code} label={`${r.name}${r.mfa_required ? " · MFA" : ""}`} checked={value.includes(r.code)} onChange={(c) => onChange(c ? [...value, r.code] : value.filter((x) => x !== r.code))} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const roleField: FieldConfig = { span: 2, label: "Rôles", render: ({ value, onChange }) => <RolePicker value={value ?? []} onChange={onChange} /> };

const disciplinesField: FieldConfig = {
  span: 2,
  label: "Disciplines",
  help: "Disciplines BIM suivies par la personne (référentiel global du Hub BIM).",
  render: ({ value, onChange }) => <DisciplinesPicker path="/bim/disciplines" value={value} onChange={onChange} />,
};

/* ----------------------------------------------------------------------------- utilisateurs */

/** Nouveau lien d'activation (lien expiré, perdu ou révoqué par erreur) : les liens encore valides sont annulés. */
function ResendInvitationDialog({ open, onClose, path, email, phone, onDone }: { open: boolean; onClose: () => void; path: string; email: string; phone?: string | null; onDone: () => void }) {
  const toast = useToast();
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (key: string) => setChannels((list) => (list.includes(key) ? list.filter((c) => c !== key) : [...list, key]));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Renvoyer l'invitation"
      footer={
        <Button
          variant="accent"
          loading={busy}
          disabled={!channels.length}
          onClick={async () => {
            setBusy(true);
            try {
              await api(path, { method: "POST", body: { channels, message: message.trim() || null } });
              toast.success("Invitation renvoyée", `Nouveau lien envoyé à ${email}, valable 7 jours. L'ancien lien ne fonctionne plus.`);
              setMessage("");
              onClose();
              onDone();
            } catch (err) {
              toast.error("Renvoi impossible", errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send className="h-4 w-4" /> Renvoyer
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">
          Un nouveau lien d&apos;activation personnel est envoyé à <strong>{email}</strong>. Les liens précédents encore valides sont annulés ; les rôles et projets prévus sont conservés.
        </p>
        <Field label="Envoyer le lien par">
          <div className="flex flex-wrap gap-4 pt-1">
            <Checkbox label="E-mail" checked={channels.includes("email")} onChange={() => toggle("email")} />
            {phone ? <Checkbox label="WhatsApp" checked={channels.includes("whatsapp")} onChange={() => toggle("whatsapp")} /> : null}
          </div>
        </Field>
        <Field label="Message (facultatif)">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Votre premier lien a expiré : voici un nouveau lien." />
        </Field>
      </div>
    </Modal>
  );
}

function UserPanel({ user, reload }: { user: Row; reload: () => void }) {
  const { can, user: me } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState<string[] | null>(null);
  const disciplines = useApi<Discipline[]>("/bim/disciplines");
  const [dialog, setDialog] = useState<null | "revoke" | "mfa" | "disable" | "resend">(null);
  const [breakGlass, setBreakGlass] = useState({ justification: "", code: "" });
  const locked = user.locked_until && new Date(user.locked_until).getTime() > Date.now();
  const act = async (path: string, body?: unknown, message?: string) => {
    try {
      await api(path, { method: body === undefined ? "POST" : "PATCH", body });
      reload();
      if (message) toast.success(message);
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-4">
      <DescriptionList
        items={[
          { label: "E-mail", value: user.email },
          { label: "Organisation", value: user.organization?.name ?? "—" },
          { label: "Fonction", value: user.job_title ?? "—" },
          { label: "Métier", value: optionLabel(user.trade) },
          { label: "Disciplines", value: disciplineNames(user.disciplines, disciplines.data) || "—" },
          { label: "Téléphone", value: [user.phone, user.whatsapp].filter(Boolean).join(" · ") || "—" },
          { label: "Dernière connexion", value: user.last_login_at ? `${dateTime(user.last_login_at)} (${relative(user.last_login_at)})` : "Jamais" },
          { label: "Double authentification", value: user.mfa_enabled ? <Badge tone="success">Activée</Badge> : user.mfa_required ? <Badge tone="danger">Exigée, non activée</Badge> : <Badge>Non activée</Badge> },
          { label: "Statut", value: !user.is_active ? <Badge>Désactivé</Badge> : locked ? <Badge tone="danger">Verrouillé jusqu'au {dateTime(user.locked_until)}</Badge> : user.activated === false ? <Badge tone="warning">Invité — compte pas encore activé</Badge> : <Badge tone="success">Actif</Badge> },
        ]}
      />
      {can("users:write") ? (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">Rôles</p>
          <RolePicker value={roles ?? user.role_codes ?? []} onChange={setRoles} />
          {roles ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => { await act(`/users/${user.id}`, { role_codes: roles }, "Rôles mis à jour (tracé dans le journal d'audit)"); setRoles(null); }}>
                Enregistrer les rôles
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRoles(null)}>
                Annuler
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {can("users:write") && user.is_active && user.activated === false ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog("resend")}>
            <Send className="h-4 w-4" /> Renvoyer l&apos;invitation
          </Button>
        ) : null}
        {can("users:write") && locked ? (
          <Button size="sm" variant="secondary" onClick={() => void act(`/users/${user.id}/unlock`, undefined, "Compte déverrouillé")}>
            <Unlock className="h-4 w-4" /> Déverrouiller
          </Button>
        ) : null}
        {can("users:write") ? (
          <Button size="sm" variant="secondary" onClick={() => void act(`/users/${user.id}`, { mfa_required: !user.mfa_required }, user.mfa_required ? "MFA facultative" : "MFA exigée à la prochaine connexion")}>
            <KeyRound className="h-4 w-4" /> {user.mfa_required ? "Ne plus exiger la MFA" : "Exiger la MFA"}
          </Button>
        ) : null}
        {can("security:manage") ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog("revoke")}>
            <LogOut className="h-4 w-4" /> Déconnecter partout
          </Button>
        ) : null}
        {can("security:manage") && user.mfa_enabled ? (
          <Button size="sm" variant="ghost" onClick={() => setDialog("mfa")}>
            <ShieldOff className="h-4 w-4" /> Réinitialiser la MFA
          </Button>
        ) : null}
        {can("users:write") && user.id !== me?.id ? (
          <Button size="sm" variant="ghost" onClick={() => (user.is_active ? setDialog("disable") : void act(`/users/${user.id}`, { is_active: true }, "Compte réactivé"))}>
            <Lock className="h-4 w-4" /> {user.is_active ? "Désactiver" : "Réactiver"}
          </Button>
        ) : null}
      </div>
      <ResendInvitationDialog open={dialog === "resend"} onClose={() => setDialog(null)} path={`/users/${user.id}/invitation`} email={user.email} phone={user.whatsapp || user.phone} onDone={reload} />
      <ConfirmDialog
        open={dialog === "revoke"}
        onClose={() => setDialog(null)}
        title="Déconnecter toutes les sessions"
        text="Toutes les sessions (web, mobile, bureau) de cet utilisateur sont révoquées immédiatement."
        tone="danger"
        onConfirm={async () => {
          const res = await api<Row>(`/users/${user.id}/revoke-sessions`, { method: "POST" });
          toast.success(`${res.revoked} session(s) révoquée(s)`);
        }}
      />
      <ConfirmDialog
        open={dialog === "disable"}
        onClose={() => setDialog(null)}
        title="Désactiver le compte"
        text="L'utilisateur ne peut plus se connecter ; ses sessions sont révoquées. Ses données et traces sont conservées."
        tone="danger"
        onConfirm={async () => {
          await api(`/users/${user.id}`, { method: "PATCH", body: { is_active: false } });
          reload();
        }}
      />
      <Modal
        open={dialog === "mfa"}
        onClose={() => setDialog(null)}
        title="Réinitialiser la double authentification"
        footer={
          <Button
            variant="accent"
            disabled={breakGlass.justification.trim().length < 20 || breakGlass.code.length < 6}
            onClick={async () => {
              try {
                const grant = await api<Row>("/auth/break-glass", { method: "POST", body: { scope: "mfa_reset", justification: breakGlass.justification.trim(), code: breakGlass.code } });
                await api(`/users/${user.id}/reset-mfa`, { method: "POST", query: { break_glass_id: grant.id } });
                setDialog(null);
                setBreakGlass({ justification: "", code: "" });
                reload();
                toast.success("MFA réinitialisée", "L'utilisateur devra réenrôler un facteur ; la direction est alertée.");
              } catch (err) {
                toast.error("Réinitialisation refusée", errorMessage(err));
              }
            }}
          >
            Confirmer (accès d'urgence)
          </Button>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">Opération critique : accès d'urgence tracé, limité dans le temps, confirmé par votre propre code MFA.</Alert>
          <Field label="Justification (20 caractères minimum)">
            <Textarea value={breakGlass.justification} onChange={(e) => setBreakGlass({ ...breakGlass, justification: e.target.value })} rows={3} placeholder="Téléphone perdu, identité vérifiée par appel vidéo le …" />
          </Field>
          <Field label="Votre code MFA">
            <Input value={breakGlass.code} onChange={(e) => setBreakGlass({ ...breakGlass, code: e.target.value.trim() })} inputMode="numeric" autoComplete="one-time-code" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export function UsersList() {
  const roles = useApi<Row[]>("/roles");
  return (
    <ResourceView
      embedded
      config={{
        title: "Utilisateurs",
        subtitle: "Comptes internes, clients et partenaires ; rôles cumulables ; invitation par e-mail sécurisée.",
        path: "/users",
        columns: [
          { key: "name", label: "Nom", sortable: true, render: (r) => (
            <span>
              {r.full_name}
              <span className="block text-xs text-muted">{r.email}</span>
            </span>
          ) },
          { key: "organization", label: "Organisation", render: (r) => r.organization?.name ?? "—", hideOnMobile: true },
          { key: "role_codes", label: "Rôles", render: (r) => <span className="flex flex-wrap gap-1">{(r.role_codes ?? []).map((c: string) => <Badge key={c}>{roles.data?.find((x) => x.code === c)?.name ?? c}</Badge>)}</span> },
          { key: "mfa_enabled", label: "MFA", render: (r) => (r.mfa_enabled ? <Badge tone="success">Oui</Badge> : r.mfa_required ? <Badge tone="danger">Exigée</Badge> : <Badge>Non</Badge>) },
          { key: "last_login_at", label: "Dernière connexion", sortable: true, render: (r) => (r.last_login_at ? relative(r.last_login_at) : "Jamais"), hideOnMobile: true },
          { key: "is_active", label: "Statut", render: (r) => (!r.is_active ? <Badge>Désactivé</Badge> : r.locked_until && new Date(r.locked_until).getTime() > Date.now() ? <Badge tone="danger">Verrouillé</Badge> : r.activated === false ? <Badge tone="warning">Invité</Badge> : <Badge tone="success">Actif</Badge>) },
        ],
        filters: [
          { key: "role", label: "Rôle", options: (roles.data ?? []).map((r) => ({ value: r.code, label: r.name })) },
          { key: "kind", label: "Type d'organisation", options: ["internal", "client", "supplier", "subcontractor", "partner"].map((v) => ({ value: v, label: optionLabel(v) })) },
          { key: "active", label: "Statut", options: [{ value: "true", label: "Actifs" }, { value: "false", label: "Désactivés" }] },
        ],
        create: {
          endpoint: "POST /users",
          label: "Nouvel utilisateur",
          perms: ["users:write"],
          initial: { send_invitation: true, invitation_channels: ["email"], project_role: "membre", role_codes: [] },
          fields: {
            role_codes: roleField,
            invitation_channels: {
              label: "Envoyer l'accès par",
              help: "Lien d'activation personnel à usage unique : l'utilisateur choisit son mot de passe, puis active la double authentification (obligatoire pour les clients). Aucun mot de passe n'est transmis.",
              render: ({ value, onChange }) => (
                <div className="flex flex-wrap gap-4 pt-1">
                  {[
                    { key: "email", label: "E-mail" },
                    { key: "whatsapp", label: "WhatsApp (numéro requis)" },
                  ].map((c) => {
                    const list: string[] = Array.isArray(value) ? value : ["email"];
                    const checked = list.includes(c.key);
                    return (
                      <label key={c.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={checked} onChange={() => onChange(checked ? list.filter((x) => x !== c.key) : [...list, c.key])} />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              ),
            },
            project_ids: { span: 2, label: "Projets", render: ({ value, onChange }) => <MultiRefSelect source={REFS.projects} value={value ?? []} onChange={onChange} /> },
            trade: personTradeField,
            project_role: { options: ["membre", "chef_projet", "conducteur_travaux", "chef_chantier", "ingenieur", "architecte", "bim_manager", "acheteur", "qhse", "comptable", "client", "partenaire"].map((v) => ({ value: v, label: optionLabel(v) })) },
            disciplines: disciplinesField,
            message: { widget: "textarea", help: "Message personnel joint à l'invitation." },
          },
        },
        update: {
          endpoint: "PATCH /users/{user_id}",
          perms: ["users:write"],
          // rôles, MFA et activation ont leurs propres commandes dans la fiche
          exclude: ["role_codes", "is_active", "mfa_required"],
          fields: { trade: personTradeField, disciplines: disciplinesField, organization_id: { ref: "organizations", label: "Organisation" } },
        },
        detail: (r, reload) => <UserPanel user={r} reload={reload} />,
        detailPath: (r) => `/users/${r.id}`,
      }}
    />
  );
}

/* ----------------------------------------------------------------------------- invitations */

export function InvitationsList() {
  const { can } = useAuth();
  const toast = useToast();
  const invitations = useApi<Row[]>("/invitations");
  const roles = useApi<Row[]>("/roles");
  const [resend, setResend] = useState<Row | null>(null);
  const roleName = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? optionLabel(code);
  return (
    <Card>
      <CardHeader title="Invitations" subtitle="Liens à usage unique, valables 7 jours ; révocables avant acceptation, renvoyables tant que le compte n'est pas activé." />
      <ul className="divide-y divide-line text-sm">
        {(invitations.data ?? []).map((i) => {
          const status = i.accepted_at ? "accepted" : i.revoked_at ? "cancelled" : new Date(i.expires_at).getTime() < Date.now() ? "expired" : "pending";
          return (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span>
                {i.email}
                <span className="block text-xs text-muted">
                  {(i.role_codes ?? []).map(roleName).join(", ")} · envoyée {relative(i.created_at)} · expire {dateTime(i.expires_at)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={status} label={{ accepted: "Acceptée", cancelled: "Révoquée", expired: "Expirée", pending: "En attente" }[status]} />
                {status === "pending" && can("users:write") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api(`/invitations/${i.id}`, { method: "DELETE" });
                        void invitations.reload();
                      } catch (err) {
                        toast.error("Révocation impossible", errorMessage(err));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Révoquer
                  </Button>
                ) : null}
                {i.resendable && can("users:write") ? (
                  <Button size="sm" variant="ghost" onClick={() => setResend(i)}>
                    <Send className="h-4 w-4" /> Renvoyer
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
        {!invitations.loading && !invitations.data?.length ? <li className="px-5 py-4 text-muted">Aucune invitation.</li> : null}
      </ul>
      <ResendInvitationDialog open={!!resend} onClose={() => setResend(null)} path={`/invitations/${resend?.id}/resend`} email={resend?.email ?? ""} onDone={() => void invitations.reload()} />
    </Card>
  );
}

/* ----------------------------------------------------------------------------- rôles et permissions */

/** Modules des permissions (préfixe du code) en français. */
const PERMISSION_MODULES: Record<string, string> = {
  agenda: "Agenda",
  ai: "Assistants IA",
  analytics: "Statistiques",
  attendance: "Pointage personnel",
  audit: "Journal d'audit",
  backups: "Sauvegardes",
  billing: "Facturation",
  bim: "Hub BIM",
  calls: "Appels",
  chat: "Messagerie",
  client: "Espace client",
  cms: "Site vitrine (CMS)",
  configurator: "Configurateur 3D",
  crm: "CRM",
  dashboard: "Tableaux de bord",
  deliveries: "Livraisons",
  disputes: "Litiges",
  documents: "Documents (GED)",
  equipment: "Matériel",
  extranet: "Extranet partenaires",
  finance: "Finances",
  hr: "Ressources humaines",
  integrations: "Intégrations",
  inventory: "Stocks",
  maintenance: "Mode maintenance",
  media: "Médiathèque",
  newsletter: "Newsletter",
  notifications: "Notifications",
  planning: "Planning",
  procurement: "Achats",
  projects: "Projets",
  qhse: "QHSE",
  reports: "Rapports",
  roles: "Rôles",
  security: "Sécurité",
  seo: "Référencement (SEO)",
  settings: "Paramètres",
  site: "Chantier (terrain)",
  subcontracting: "Sous-traitance",
  suppliers: "Fournisseurs",
  support: "SAV",
  users: "Utilisateurs",
};
const moduleLabel = (module: string) => PERMISSION_MODULES[module] ?? optionLabel(module);

function PermissionMatrix({ value, onChange, readOnly }: { value: string[]; onChange: (codes: string[]) => void; readOnly?: boolean }) {
  const permissions = useApi<Row[]>("/permissions");
  const modules = useMemo(() => {
    const out: Record<string, Row[]> = {};
    for (const p of permissions.data ?? []) (out[p.module] ??= []).push(p);
    return out;
  }, [permissions.data]);
  if (permissions.loading && !permissions.data) return <Skeleton className="h-64" />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Object.entries(modules).sort(([a], [b]) => moduleLabel(a).localeCompare(moduleLabel(b), "fr")).map(([module, perms]) => {
        const all = perms.every((p) => value.includes(p.code));
        return (
          <div key={module} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{moduleLabel(module)}</p>
              {!readOnly ? (
                <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => onChange(all ? value.filter((c) => !perms.some((p) => p.code === c)) : Array.from(new Set([...value, ...perms.map((p) => p.code)])))}>
                  {all ? "Tout retirer" : "Tout cocher"}
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              {perms.map((p) => (
                <label key={p.code} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={value.includes(p.code)} disabled={readOnly} onChange={(e) => onChange(e.target.checked ? [...value, p.code] : value.filter((c) => c !== p.code))} />
                  <span>
                    {p.label}
                    <span className="ml-1 font-mono text-[11px] text-muted">{p.code}</span>
                    {p.sensitive ? <Badge tone="danger" className="ml-1">sensible</Badge> : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RolesAdmin() {
  const { can } = useAuth();
  const toast = useToast();
  const roles = useApi<Row[]>("/roles");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [perms, setPerms] = useState<string[]>([]);
  const [meta, setMeta] = useState({ name: "", description: "", audience: "internal", global_scope: false, mfa_required: false });
  const [deleting, setDeleting] = useState<Row | null>(null);
  const open = (r: Row | null) => {
    if (r) {
      setEditing(r);
      setPerms(r.permission_codes ?? []);
      setMeta({ name: r.name, description: r.description ?? "", audience: r.audience, global_scope: r.global_scope, mfa_required: r.mfa_required });
    } else {
      setCreating(true);
      setPerms([]);
      setMeta({ name: "", description: "", audience: "internal", global_scope: false, mfa_required: false });
    }
  };
  const save = async () => {
    try {
      if (editing) await api(`/roles/${editing.id}`, { method: "PATCH", body: { name: meta.name, description: meta.description || null, global_scope: meta.global_scope, mfa_required: meta.mfa_required, ...(editing.code === "ADMIN" ? {} : { permissions: perms }) } });
      else await api("/roles", { method: "POST", body: { ...meta, description: meta.description || null, permissions: perms } });
      toast.success("Rôle enregistré", "Les droits des utilisateurs concernés sont mis à jour immédiatement.");
      setEditing(null);
      setCreating(false);
      void roles.reload();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-4">
      {can("roles:manage") ? (
        <div className="flex justify-end">
          <Button onClick={() => open(null)}>
            <Plus className="h-4 w-4" /> Nouveau rôle
          </Button>
        </div>
      ) : null}
      {roles.loading && !roles.data ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(roles.data ?? []).map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="font-mono text-xs text-muted">{r.code}</p>
                </div>
                <span className="flex flex-wrap justify-end gap-1">
                  <Badge>{AUDIENCES[r.audience] ?? r.audience}</Badge>
                  {r.is_system ? <Badge tone="info">Système</Badge> : null}
                  {r.mfa_required ? <Badge tone="accent">MFA</Badge> : null}
                  {r.global_scope ? <Badge tone="warning">Tous projets</Badge> : null}
                </span>
              </div>
              {r.description ? <p className="mt-2 text-sm text-muted">{r.description}</p> : null}
              <p className="mt-2 text-xs text-muted">
                {(r.permission_codes ?? []).length} permission(s) · {r.user_count} utilisateur(s)
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => open(r)}>
                  {can("roles:manage") ? "Modifier" : "Voir"}
                </Button>
                {can("roles:manage") && !r.is_system && !r.user_count ? (
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false); }} title={editing ? `Rôle ${editing.name}` : "Nouveau rôle"} size="full" footer={can("roles:manage") ? <Button onClick={save} disabled={meta.name.trim().length < 2}>Enregistrer</Button> : undefined}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nom">
              <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} disabled={!can("roles:manage")} />
            </Field>
            <Field label="Public">
              <Select value={meta.audience} onChange={(e) => setMeta({ ...meta, audience: e.target.value })} options={Object.entries(AUDIENCES).map(([value, label]) => ({ value, label }))} disabled={!!editing} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} rows={2} disabled={!can("roles:manage")} />
            </Field>
            <div className="flex flex-wrap gap-4 md:col-span-2">
              <Checkbox label="Accès à tous les projets (sinon : projets dont l'utilisateur est membre)" checked={meta.global_scope} onChange={(c) => setMeta({ ...meta, global_scope: c })} />
              <Checkbox label="Double authentification obligatoire" checked={meta.mfa_required} onChange={(c) => setMeta({ ...meta, mfa_required: c })} />
            </div>
          </div>
          {editing?.code === "ADMIN" ? <Alert tone="info">Le rôle ADMIN dispose de toutes les permissions ; elles ne sont pas modifiables.</Alert> : null}
          <PermissionMatrix value={perms} onChange={setPerms} readOnly={!can("roles:manage") || editing?.code === "ADMIN"} />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Supprimer le rôle ${deleting?.name ?? ""}`}
        tone="danger"
        onConfirm={async () => {
          await api(`/roles/${deleting?.id}`, { method: "DELETE" });
          void roles.reload();
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- organisations, équipes */

export function OrganizationsList() {
  const kindField: FieldConfig = { options: ["internal", "client", "supplier", "subcontractor", "partner"].map((v) => ({ value: v, label: optionLabel(v) })) };
  return (
    <ResourceView
      embedded
      config={{
        title: "Organisations",
        subtitle: "Entreprise, clients (personnes morales), fournisseurs, sous-traitants, partenaires.",
        path: "/organizations",
        columns: [
          { key: "name", label: "Organisation", sortable: true },
          { key: "kind", label: "Type", format: "option" },
          { key: "city", label: "Ville", hideOnMobile: true },
          { key: "email", label: "E-mail", hideOnMobile: true },
          { key: "is_active", label: "Active", format: "bool" },
        ],
        filters: [{ key: "kind", label: "Type", options: ["internal", "client", "supplier", "subcontractor", "partner"].map((v) => ({ value: v, label: optionLabel(v) })) }],
        create: { endpoint: "POST /organizations", label: "Nouvelle organisation", perms: ["users:write"], fields: { kind: kindField, notes: { widget: "textarea" } } },
        update: { endpoint: "PATCH /organizations/{org_id}", perms: ["users:write"], fields: { kind: kindField, notes: { widget: "textarea" } } },
      }}
    />
  );
}

export function TeamsList() {
  const fields: Record<string, FieldConfig> = { leader_id: { ref: "users", label: "Chef d'équipe" }, trade: personTradeField, member_ids: { span: 2, label: "Membres", render: ({ value, onChange }) => <MultiRefSelect source={REFS.users} value={value ?? []} onChange={onChange} /> }, description: { widget: "textarea" } };
  return (
    <ResourceView
      embedded
      config={{
        title: "Équipes",
        path: "/teams",
        columns: [
          { key: "name", label: "Équipe" },
          { key: "trade", label: "Métier", format: "option" },
          { key: "members", label: "Membres", render: (r) => (r.member_ids ?? r.members ?? []).length },
          { key: "is_active", label: "Active", format: "bool" },
        ],
        create: { endpoint: "POST /teams", label: "Nouvelle équipe", perms: ["users:write"], fields },
        update: { endpoint: "PATCH /teams/{team_id}", perms: ["users:write"], fields },
        detailFields: [
          { key: "name", label: "Équipe" },
          { key: "trade", label: "Métier", render: (r) => optionLabel(r.trade) },
          { key: "leader_name", label: "Chef d'équipe", render: (r) => r.leader_name ?? "—" },
          { key: "organization_name", label: "Organisation", render: (r) => r.organization_name ?? "—" },
          { key: "member_names", label: "Membres", render: (r) => (r.member_names ?? []).join(", ") || "—" },
          { key: "description", label: "Description" },
          { key: "is_active", label: "Active", format: "bool" },
        ],
      }}
    />
  );
}

export function UsersAdminHub() {
  const { can } = useAuth();
  const [tab, setTab] = useState("utilisateurs");
  return (
    <div className="space-y-5">
      <PageTitle title="Utilisateurs et rôles" subtitle="Comptes, invitations, rôles RBAC (97 permissions), organisations et équipes — chaque changement est audité." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "utilisateurs", label: "Utilisateurs", hidden: !can("users:read") },
          { key: "invitations", label: "Invitations", hidden: !can("users:read") },
          { key: "roles", label: "Rôles et permissions" },
          { key: "organisations", label: "Organisations", hidden: !can("users:read") },
          { key: "equipes", label: "Équipes", hidden: !can("users:read") },
        ]}
      />
      {tab === "utilisateurs" ? <UsersList /> : null}
      {tab === "invitations" ? <InvitationsList /> : null}
      {tab === "roles" ? <RolesAdmin /> : null}
      {tab === "organisations" ? <OrganizationsList /> : null}
      {tab === "equipes" ? <TeamsList /> : null}
    </div>
  );
}
