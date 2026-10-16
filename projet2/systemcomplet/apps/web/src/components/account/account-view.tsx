"use client";

import { BellRing, Fingerprint, KeyRound, LogOut, Monitor, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CodeInput, Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal, Tabs } from "@/components/ui/overlay";
import { PasswordStrength, passwordIssues } from "@/components/ui/password-strength";
import { Alert, Badge, Button, Card, CardHeader, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, relative } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";
import { webauthnRegister, webauthnSupported } from "@/lib/webauthn";

function ProfileTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    phone: user?.phone ?? "",
    whatsapp: user?.whatsapp ?? "",
    job_title: user?.job_title ?? "",
    locale: user?.locale ?? "fr",
    timezone: user?.timezone ?? "Africa/Douala",
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const me = await api("/auth/me", { method: "PATCH", body: { ...form, phone: form.phone || null, whatsapp: form.whatsapp || null, job_title: form.job_title || null } });
      setUser(me);
      toast.success("Profil enregistré");
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Informations personnelles" subtitle={user?.email} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Prénom" required>
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </Field>
        <Field label="Nom" required>
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="WhatsApp">
          <Input type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </Field>
        <Field label="Fonction">
          <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
        </Field>
        <Field label="Fuseau horaire">
          <Select
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            options={["Africa/Douala", "Europe/Paris", "Europe/Brussels", "America/New_York", "America/Toronto", "Africa/Abidjan", "Africa/Lagos", "Europe/London"].map((v) => ({ value: v, label: v }))}
          />
        </Field>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button onClick={save} loading={busy} disabled={!form.first_name.trim() || !form.last_name.trim()}>
          Enregistrer
        </Button>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const invalid = !current || passwordIssues(next).length > 0 || next !== confirm;
  return (
    <Card>
      <CardHeader title="Mot de passe" subtitle="Le changement de mot de passe ferme vos autres sessions." />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <Field label="Mot de passe actuel">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nouveau mot de passe">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          {next ? <PasswordStrength password={next} /> : null}
        </Field>
        <Field label="Confirmation" error={confirm && confirm !== next ? "Différent du nouveau mot de passe" : null}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button
          loading={busy}
          disabled={invalid}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/auth/password/change", { method: "POST", body: { current_password: current, new_password: next } });
              toast.success("Mot de passe modifié", user?.email);
              setCurrent("");
              setNext("");
              setConfirm("");
            } catch (err) {
              toast.error("Modification impossible", errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Modifier le mot de passe
        </Button>
      </div>
    </Card>
  );
}

interface Factor {
  id: string;
  type: string;
  name?: string | null;
  confirmed_at?: string | null;
  last_used_at?: string | null;
  created_at: string;
}

function MfaCard({ required }: { required: boolean }) {
  const toast = useToast();
  const { user, reload } = useAuth();
  const factors = useApi<Factor[]>("/auth/mfa/factors");
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string; qr_data_url: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [regen, setRegen] = useState(false);
  const [disable, setDisable] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [keyName, setKeyName] = useState("Clé de sécurité");
  const hasTotp = factors.data?.some((f) => f.type === "totp");

  const startTotp = async () => {
    setBusy(true);
    try {
      setSetup(await api("/auth/mfa/totp/setup", { method: "POST" }));
      setCode("");
    } catch (err) {
      toast.error("Activation impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmTotp = async () => {
    setBusy(true);
    try {
      const res = await api<{ codes: string[] }>("/auth/mfa/totp/confirm", { method: "POST", body: { code } });
      setCodes(res.codes);
      setSetup(null);
      await Promise.all([factors.reload(), reload()]);
      toast.success("Double authentification activée");
    } catch (err) {
      toast.error("Code refusé", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addKey = async () => {
    setBusy(true);
    try {
      const { options, challenge_token } = await api<{ options: any; challenge_token: string }>("/auth/mfa/webauthn/register/options", { method: "POST" });
      const credential = await webauthnRegister(options);
      await api("/auth/mfa/webauthn/register/verify", { method: "POST", body: { credential, challenge_token, name: keyName || "Clé de sécurité" } });
      await Promise.all([factors.reload(), reload()]);
      toast.success("Clé de sécurité enregistrée");
    } catch (err) {
      toast.error("Enregistrement de la clé impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Double authentification (MFA)"
        subtitle="Application d'authentification (TOTP), clé de sécurité / biométrie (WebAuthn) et codes de secours."
        actions={user?.mfa_enabled ? <Badge tone="success">Activée</Badge> : <Badge tone={required ? "danger" : "warning"}>{required ? "Obligatoire" : "Désactivée"}</Badge>}
      />
      <div className="space-y-5 p-5">
        {required && !user?.mfa_enabled ? <Alert tone="danger">Votre profil exige la double authentification : activez-la pour accéder à l'ensemble des fonctions.</Alert> : null}
        {factors.loading ? <Skeleton className="h-16 w-full" /> : null}
        {factors.data?.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {factors.data.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  {f.type === "webauthn" ? <Fingerprint className="h-4 w-4 text-brand-600" /> : <Smartphone className="h-4 w-4 text-brand-600" />}
                  <span>
                    <span className="font-medium">{f.name ?? (f.type === "totp" ? "Application d'authentification" : "Clé de sécurité")}</span>
                    <span className="block text-xs text-muted">Ajoutée le {dateTime(f.created_at)} · dernier usage {f.last_used_at ? relative(f.last_used_at) : "jamais"}</span>
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api(`/auth/mfa/factors/${f.id}`, { method: "DELETE" });
                      await Promise.all([factors.reload(), reload()]);
                    } catch (err) {
                      toast.error("Suppression impossible", errorMessage(err));
                    }
                  }}
                  aria-label="Supprimer ce facteur"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!hasTotp ? (
            <Button onClick={startTotp} loading={busy && !setup}>
              <Smartphone className="h-4 w-4" /> Configurer une application d'authentification
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setRegen(true)}>
              <KeyRound className="h-4 w-4" /> Régénérer les codes de secours
            </Button>
          )}
          {webauthnSupported() ? (
            <div className="flex items-center gap-2">
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="w-48" aria-label="Nom de la clé" />
              <Button variant="secondary" onClick={addKey} loading={busy && !setup}>
                <Fingerprint className="h-4 w-4" /> Ajouter une clé / biométrie
              </Button>
            </div>
          ) : null}
          {user?.mfa_enabled && !required ? (
            <Button variant="ghost" onClick={() => setDisable(true)}>
              Désactiver le MFA
            </Button>
          ) : null}
        </div>
      </div>

      <Modal open={!!setup} onClose={() => setSetup(null)} title="Configurer l'application d'authentification" size="md">
        {setup ? (
          <div className="space-y-4 text-sm">
            <p>Scannez ce QR code avec Google Authenticator, Microsoft Authenticator, FreeOTP ou équivalent, puis saisissez le code affiché.</p>
            <img src={setup.qr_data_url} alt="QR code d'activation" className="mx-auto h-48 w-48 rounded-xl ring-1 ring-line" />
            <p className="text-center text-xs text-muted">
              Saisie manuelle : <code className="break-all">{setup.secret}</code>
            </p>
            <Field label="Code à 6 chiffres">
              <CodeInput value={code} onChange={setCode} autoFocus />
            </Field>
            <Button className="w-full" onClick={confirmTotp} loading={busy} disabled={code.length !== 6}>
              Activer
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!codes} onClose={() => setCodes(null)} title="Vos codes de secours" footer={<Button onClick={() => setCodes(null)}>J'ai conservé mes codes</Button>}>
        <p className="text-sm text-muted">Chaque code ne peut servir qu'une fois. Conservez-les hors ligne en lieu sûr : ils ne seront plus affichés.</p>
        <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
          {codes?.map((c) => (
            <li key={c} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
              {c}
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            const blob = new Blob([`Codes de secours GLOBUS ENGINEERING\n${codes?.join("\n")}\n`], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "codes-secours-globus.txt";
            a.click();
          }}
        >
          Télécharger
        </Button>
      </Modal>

      <Modal
        open={regen}
        onClose={() => setRegen(false)}
        title="Régénérer les codes de secours"
        size="sm"
        footer={
          <Button
            loading={busy}
            disabled={code.length !== 6}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api<{ codes: string[] }>("/auth/mfa/recovery-codes", { method: "POST", body: { code } });
                setRegen(false);
                setCodes(res.codes);
                setCode("");
              } catch (err) {
                toast.error("Code refusé", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Régénérer
          </Button>
        }
      >
        <Field label="Code de votre application d'authentification">
          <CodeInput value={code} onChange={setCode} autoFocus />
        </Field>
      </Modal>

      <Modal
        open={disable}
        onClose={() => setDisable(false)}
        title="Désactiver la double authentification"
        size="sm"
        footer={
          <Button
            variant="danger"
            loading={busy}
            disabled={!disablePwd || code.length < 6}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/auth/mfa/disable", { method: "POST", body: { password: disablePwd, code } });
                setDisable(false);
                setDisablePwd("");
                setCode("");
                await Promise.all([factors.reload(), reload()]);
                toast.success("Double authentification désactivée");
              } catch (err) {
                toast.error("Désactivation impossible", errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Désactiver
          </Button>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">Votre compte sera moins protégé.</Alert>
          <Field label="Mot de passe">
            <Input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} />
          </Field>
          <Field label="Code TOTP ou code de secours">
            <Input value={code} onChange={(e) => setCode(e.target.value.trim())} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

interface SessionRow {
  id: string;
  created_at: string;
  last_used_at?: string | null;
  expires_at: string;
  ip?: string | null;
  user_agent?: string | null;
  application?: string | null;
  mfa_verified_at?: string | null;
  current: boolean;
}

interface DeviceRow {
  id: string;
  name?: string | null;
  platform?: string | null;
  application?: string | null;
  trusted: boolean;
  trusted_until?: string | null;
  last_seen_at?: string | null;
  created_at: string;
}

function SessionsTab() {
  const toast = useToast();
  const sessions = useApi<SessionRow[]>("/auth/sessions");
  const devices = useApi<DeviceRow[]>("/auth/devices");
  const history = useApi<{ at: string; action: string; result: string; ip?: string; user_agent?: string; application?: string }[]>("/auth/login-history");
  const [confirmOthers, setConfirmOthers] = useState(false);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Sessions actives"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setConfirmOthers(true)}>
              <LogOut className="h-4 w-4" /> Fermer les autres sessions
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="flex items-center gap-3">
                <Monitor className="h-5 w-5 text-muted" />
                <span>
                  <span className="font-medium">
                    {s.application ?? "web"} {s.current ? <Badge tone="success">Session actuelle</Badge> : null}
                  </span>
                  <span className="block max-w-xl truncate text-xs text-muted">
                    {s.ip ?? "IP inconnue"} · {s.user_agent ?? ""} · ouverte {relative(s.created_at)} · MFA {s.mfa_verified_at ? "vérifié" : "non vérifié"}
                  </span>
                </span>
              </span>
              {!s.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api(`/auth/sessions/${s.id}`, { method: "DELETE" });
                      void sessions.reload();
                    } catch (err) {
                      toast.error("Révocation impossible", errorMessage(err));
                    }
                  }}
                >
                  Révoquer
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Appareils" subtitle="Un appareil de confiance n'exige pas le second facteur pendant 30 jours (sauf profils sensibles)." />
        <ul className="divide-y divide-line">
          {(devices.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>
                <span className="font-medium">{d.name ?? "Appareil"}</span> {d.trusted ? <Badge tone="info">De confiance jusqu'au {dateTime(d.trusted_until)}</Badge> : null}
                <span className="block text-xs text-muted">Vu {d.last_seen_at ? relative(d.last_seen_at) : "—"}</span>
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await api(`/auth/devices/${d.id}`, { method: "PATCH", body: { trusted: !d.trusted } }).catch((err) => toast.error("Erreur", errorMessage(err)));
                    void devices.reload();
                  }}
                >
                  {d.trusted ? "Retirer la confiance" : "Faire confiance"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api(`/auth/devices/${d.id}`, { method: "DELETE" }).catch((err) => toast.error("Erreur", errorMessage(err)));
                    void devices.reload();
                    void sessions.reload();
                  }}
                >
                  Révoquer
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Historique de sécurité" />
        <ul className="divide-y divide-line text-sm">
          {(history.data ?? []).map((h, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
              <span>
                {optionLabel(h.action)} <Badge tone={h.result === "success" ? "success" : "danger"}>{optionLabel(h.result)}</Badge>
              </span>
              <span className="text-xs text-muted">
                {dateTime(h.at)} · {h.ip ?? ""} · {h.application ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        title="Fermer les autres sessions"
        text="Tous vos autres appareils seront déconnectés."
        onConfirm={async () => {
          const res = await api<{ revoked: number }>("/auth/sessions/revoke-others", { method: "POST" });
          toast.success(`${res.revoked} session(s) fermée(s)`);
          void sessions.reload();
        }}
      />
    </div>
  );
}

interface Prefs {
  categories: string[];
  channels: string[];
  matrix: Record<string, Record<string, boolean>>;
  mandatory: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  crm: "Commercial",
  projects: "Projets et chantiers",
  procurement: "Achats",
  deliveries: "Livraisons",
  finance: "Finances et paiements",
  subcontracting: "Sous-traitance",
  disputes: "Litiges",
  documents: "Documents",
  bim: "BIM",
  decisions: "Décisions à valider",
  qhse: "QHSE",
  support: "SAV",
  calls: "Appels",
  chat: "Messagerie",
  digest: "Résumé hebdomadaire",
  inventory: "Stocks",
  equipment: "Matériel",
  tranquillite: "Dossier Tranquillité",
  security: "Sécurité",
  system: "Système",
  general: "Général",
};

const CHANNEL_LABELS: Record<string, string> = { in_app: "Application", push: "Push", email: "E-mail", whatsapp: "WhatsApp", sms: "SMS" };

export function NotificationPreferences() {
  const toast = useToast();
  const prefs = useApi<Prefs>("/notifications/preferences");
  const [push, setPush] = useState<"enabled" | "disabled" | "unavailable" | "loading">("loading");
  useEffect(() => {
    if (!pushSupported()) {
      setPush("unavailable");
      return;
    }
    currentSubscription()
      .then((s) => setPush(s ? "enabled" : "disabled"))
      .catch(() => setPush("disabled"));
  }, []);
  const toggle = async (category: string, channel: string, enabled: boolean) => {
    try {
      const updated = await api<Prefs>("/notifications/preferences", { method: "PUT", body: { items: [{ category, channel, enabled }] } });
      prefs.setData(updated);
    } catch (err) {
      toast.error("Préférence non enregistrée", errorMessage(err));
    }
  };
  return (
    <Card>
      <CardHeader
        title="Préférences de notification"
        subtitle="Choisissez les canaux par type d'information. Les alertes de sécurité restent actives."
        actions={
          push === "unavailable" ? (
            <Badge>Push non pris en charge</Badge>
          ) : push === "enabled" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await disablePush();
                setPush("disabled");
              }}
            >
              Désactiver le push sur ce navigateur
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={async () => {
                const res = await enablePush().catch((err) => {
                  toast.error("Activation impossible", errorMessage(err));
                  return "disabled" as const;
                });
                setPush(res === "enabled" ? "enabled" : res === "unavailable" ? "unavailable" : "disabled");
                if (res === "denied") toast.warning("Notifications refusées par le navigateur");
              }}
            >
              <BellRing className="h-4 w-4" /> Activer le push
            </Button>
          )
        }
      />
      {prefs.loading ? (
        <div className="p-5">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : prefs.data ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Catégorie</th>
                {prefs.data.channels.map((ch) => (
                  <th key={ch} className="px-4 py-2 text-center">
                    {CHANNEL_LABELS[ch] ?? ch}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {prefs.data.categories.map((cat) => (
                <tr key={cat}>
                  <td className="px-4 py-2 font-medium">{CATEGORY_LABELS[cat] ?? optionLabel(cat)}</td>
                  {prefs.data!.channels.map((ch) => (
                    <td key={ch} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!prefs.data!.matrix[cat]?.[ch]}
                        disabled={(prefs.data!.mandatory.includes(cat) || cat === "system") && ch === "in_app"}
                        onChange={(e) => void toggle(cat, ch, e.target.checked)}
                        aria-label={`${CATEGORY_LABELS[cat] ?? cat} — ${CHANNEL_LABELS[ch] ?? ch}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <Alert tone="danger">{prefs.error}</Alert>
        </div>
      )}
    </Card>
  );
}

function PrivacyTab() {
  const trust = useApi<{ mfa_enabled: boolean; active_sessions: number; consents: { purposes: Record<string, boolean>; policy_version: string; source: string; created_at: string; withdrawn_at?: string | null }[]; my_validations: { title: string; validated_at: string; status: string; content_hash?: string | null }[] }>("/client/trust");
  if (trust.loading) return <Skeleton className="h-48 w-full" />;
  if (!trust.data) return <Alert tone="danger">{trust.error}</Alert>;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Centre de confiance" subtitle="Sécurité de votre compte et traçabilité de vos validations." />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-xl bg-surface p-4">
            <p className="text-xs uppercase text-muted">Double authentification</p>
            <p className="mt-1 font-semibold">{trust.data.mfa_enabled ? "Activée" : "Désactivée"}</p>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="text-xs uppercase text-muted">Sessions actives</p>
            <p className="mt-1 font-semibold">{trust.data.active_sessions}</p>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="text-xs uppercase text-muted">Validations signées</p>
            <p className="mt-1 font-semibold">{trust.data.my_validations.length}</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Journal de mes validations" />
        <ul className="divide-y divide-line text-sm">
          {trust.data.my_validations.map((v, i) => (
            <li key={i} className="px-5 py-3">
              <p className="font-medium">{v.title}</p>
              <p className="text-xs text-muted">
                {dateTime(v.validated_at)} · {optionLabel(v.status)} {v.content_hash ? `· empreinte ${v.content_hash.slice(0, 16)}…` : ""}
              </p>
            </li>
          ))}
          {!trust.data.my_validations.length ? <li className="px-5 py-4 text-muted">Aucune validation.</li> : null}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Mes consentements" />
        <ul className="divide-y divide-line text-sm">
          {trust.data.consents.map((c, i) => (
            <li key={i} className="px-5 py-3">
              <p className="font-medium">
                {Object.entries(c.purposes)
                  .filter(([, v]) => v)
                  .map(([k]) => optionLabel(k))
                  .join(", ") || "—"}
              </p>
              <p className="text-xs text-muted">
                {dateTime(c.created_at)} · politique v{c.policy_version} · {c.source}
                {c.withdrawn_at ? ` · retiré le ${dateTime(c.withdrawn_at)}` : ""}
              </p>
            </li>
          ))}
          {!trust.data.consents.length ? <li className="px-5 py-4 text-muted">Aucun consentement enregistré.</li> : null}
        </ul>
      </Card>
    </div>
  );
}

/** « Mon compte » commun aux espaces : profil, sécurité (MFA), sessions/appareils, notifications, confidentialité. */
export function AccountView({ withPrivacy = false }: { withPrivacy?: boolean }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const mfaRequired = params.get("mfa") === "obligatoire" || !!user?.mfa_required;
  const [tab, setTab] = useState(params.get("mfa") ? "securite" : "profil");
  return (
    <div>
      <PageTitle title="Mon compte" subtitle={user?.email} eyebrow={<span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Compte sécurisé</span>} />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "profil", label: "Profil" },
          { key: "securite", label: "Sécurité" },
          { key: "sessions", label: "Sessions et appareils" },
          { key: "notifications", label: "Notifications" },
          { key: "confidentialite", label: "Confiance et confidentialité", hidden: !withPrivacy },
        ]}
      />
      {tab === "profil" ? <ProfileTab /> : null}
      {tab === "securite" ? (
        <div className="space-y-6">
          <MfaCard required={mfaRequired} />
          <PasswordCard />
        </div>
      ) : null}
      {tab === "sessions" ? <SessionsTab /> : null}
      {tab === "notifications" ? <NotificationPreferences /> : null}
      {tab === "confidentialite" && withPrivacy ? <PrivacyTab /> : null}
    </div>
  );
}
