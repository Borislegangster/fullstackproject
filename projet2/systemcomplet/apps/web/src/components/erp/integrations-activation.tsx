"use client";

import { Copy, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import type { Row } from "@/components/erp/resource";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";

/** Services activables depuis l'ERP : choix du prestataire et réglages publics ; les clés restent dans le coffre. */
const GROUPS: {
  key: string;
  title: string;
  intro: string;
  switchField: string;
  off: string;
}[] = [
  {
    key: "whatsapp",
    title: "WhatsApp Business",
    intro:
      "Bons de commande aux fournisseurs, rappels et timelapses envoyés sur WhatsApp. Compte requis : Meta for Developers › WhatsApp (numéro professionnel vérifié, modèles de messages approuvés).",
    switchField: "WHATSAPP_PROVIDER",
    off: "console",
  },
  {
    key: "sms",
    title: "SMS",
    intro: "Codes de validation et alertes par SMS. Compte requis : Twilio (numéro ou nom d'expéditeur autorisé au Cameroun).",
    switchField: "SMS_PROVIDER",
    off: "console",
  },
  {
    key: "payments",
    title: "Paiement en ligne",
    intro: "Paiement des appels de fonds et factures par les clients (Mobile Money, carte). Compte marchand requis auprès de chaque prestataire, en environnement de production.",
    switchField: "PAYMENT_PROVIDERS",
    off: "",
  },
  {
    key: "ai",
    title: "Assistants IA (Claude)",
    intro: "Résumés, rapports vocaux structurés, lecture de documents, réponses suggérées. Compte requis : console.anthropic.com (clé API et crédit).",
    switchField: "AI_PROVIDER",
    off: "none",
  },
];

const NEED: Record<string, { label: string; tone: "danger" | "success" | "neutral" | "warning" }> = {
  required: { label: "Requis", tone: "danger" },
  optional: { label: "Facultatif", tone: "neutral" },
  unused: { label: "Non utilisé", tone: "neutral" },
};

export function NeedBadge({ need, configured }: { need?: string; configured?: boolean }) {
  if (configured) return <Badge tone="success">Renseigné</Badge>;
  const n = NEED[need ?? "optional"] ?? NEED.optional;
  return <Badge tone={n.tone}>{n.label}</Badge>;
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-xs">
      <span className="min-w-0">
        <span className="block text-muted">{label}</span>
        <code className="break-all">{value}</code>
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          toast.success("Copié");
        }}
      >
        <Copy className="h-4 w-4" /> Copier
      </Button>
    </div>
  );
}

export function IntegrationsActivation({ secrets, onSecret, onSaved }: { secrets: Row[]; onSecret: (secret: Row) => void; onSaved: () => void }) {
  const toast = useToast();
  const [config, setConfig] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const load = async () => {
    try {
      const c = await api<Row>("/admin/integrations/config");
      setConfig(c);
      setDraft(Object.fromEntries(((c.fields ?? []) as Row[]).map((f) => [f.name, f.value ?? (f.multiple ? [] : "")])));
    } catch (err) {
      setError({ _: errorMessage(err) });
    }
  };
  useEffect(() => {
    void load();
  }, []);
  if (!config) return error._ ? <Alert tone="danger">{error._}</Alert> : null;
  const fields = (config.fields ?? []) as Row[];
  const callbacks = (config.callbacks ?? {}) as Record<string, string>;
  const save = async (group: string) => {
    setBusy(group);
    setError((e) => ({ ...e, [group]: "" }));
    try {
      const values = Object.fromEntries(fields.filter((f) => f.group === group).map((f) => [f.name, f.multiple ? (draft[f.name] ?? []) : String(draft[f.name] ?? "").trim() || null]));
      const c = await api<Row>("/admin/integrations/config", {
        method: "PUT",
        body: { values },
      });
      setConfig(c);
      toast.success("Réglages enregistrés", "Actifs sur tout le serveur sous 15 secondes.");
      onSaved();
    } catch (err) {
      setError((e) => ({ ...e, [group]: errorMessage(err) }));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card>
      <CardHeader
        title="Activer les services"
        subtitle="Activez un service, renseignez ses réglages puis ses clés (bouton « Définir ») : aucune intervention sur le serveur n'est nécessaire. Les clés sont chiffrées et jamais réaffichées."
      />
      <div className="divide-y divide-line">
        {GROUPS.map((g) => {
          const own = fields.filter((f) => f.group === g.key);
          const sw = own.find((f) => f.name === g.switchField);
          const active = sw?.multiple ? (draft[g.switchField] ?? []).length > 0 : !!draft[g.switchField] && draft[g.switchField] !== g.off;
          const keys = secrets.filter((x) => x.group === g.key && x.need !== "unused");
          const missing = keys.filter((x) => x.need === "required" && !x.configured);
          return (
            <section key={g.key} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{g.title}</p>
                <Badge tone={!active ? "neutral" : missing.length ? "warning" : "success"}>{!active ? "Désactivé" : missing.length ? `${missing.length} clé(s) à renseigner` : "Activé"}</Badge>
              </div>
              <p className="text-xs text-muted">{g.intro}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {own.map((f) => {
                  if (f.name !== g.switchField && !active) return null;
                  const choices = (f.choices ?? []) as {
                    value: string;
                    label: string;
                  }[];
                  const overridden = JSON.stringify(f.value) !== JSON.stringify(f.server_value);
                  const help = [
                    f.help,
                    overridden && f.server_value !== null && f.server_value !== undefined && String(f.server_value) !== ""
                      ? `Valeur du serveur : ${Array.isArray(f.server_value) ? f.server_value.join(", ") || "aucune" : f.server_value}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  if (f.multiple) {
                    const value = (draft[f.name] ?? []) as string[];
                    return (
                      <Field key={f.name} label={f.label} help={help || undefined} className="sm:col-span-2">
                        <div className="flex flex-wrap gap-4">
                          {choices.map((c) => (
                            <Checkbox
                              key={c.value}
                              label={c.label}
                              checked={value.includes(c.value)}
                              onChange={(on) =>
                                setDraft((d) => ({
                                  ...d,
                                  [f.name]: on ? [...value, c.value] : value.filter((x) => x !== c.value),
                                }))
                              }
                            />
                          ))}
                        </div>
                      </Field>
                    );
                  }
                  if (g.key === "payments" && f.name !== g.switchField) {
                    // Réglages propres à un prestataire : affichés seulement s'il est coché.
                    const owner = f.name.startsWith("MTN_") ? "mtn_momo" : f.name.startsWith("ORANGE_") ? "orange_money" : f.name.startsWith("CINETPAY_") ? "cinetpay" : null;
                    if (owner && !((draft.PAYMENT_PROVIDERS ?? []) as string[]).includes(owner)) return null;
                  }
                  return (
                    <Field key={f.name} label={f.label} help={help || undefined}>
                      {choices.length ? (
                        <Select
                          value={draft[f.name] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [f.name]: e.target.value,
                            }))
                          }
                          options={choices}
                        />
                      ) : (
                        <Input
                          value={draft[f.name] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [f.name]: e.target.value,
                            }))
                          }
                          autoComplete="off"
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
              {active && g.key === "whatsapp" && callbacks.whatsapp ? (
                <CopyLine
                  label="URL de rappel à déclarer chez Meta (Webhooks › URL de rappel) — jeton de vérification : la clé « Jeton de vérification du webhook WhatsApp »"
                  value={callbacks.whatsapp}
                />
              ) : null}
              {active && g.key === "payments" ? (
                <div className="space-y-2">
                  {((draft.PAYMENT_PROVIDERS ?? []) as string[]).includes("stripe") && callbacks.stripe ? (
                    <CopyLine label="Webhook à déclarer chez Stripe (Développeurs › Webhooks)" value={callbacks.stripe} />
                  ) : null}
                  {((draft.PAYMENT_PROVIDERS ?? []) as string[]).includes("flutterwave") && callbacks.flutterwave ? (
                    <CopyLine label="Webhook à déclarer chez Flutterwave (Paramètres › Webhooks)" value={callbacks.flutterwave} />
                  ) : null}
                  {((draft.PAYMENT_PROVIDERS ?? []) as string[]).includes("mtn_momo") && callbacks.mtn_callback_host ? (
                    <CopyLine label="MTN MoMo : hôte de rappel (providerCallbackHost) à indiquer lors de la création de l'utilisateur API" value={callbacks.mtn_callback_host} />
                  ) : null}
                </div>
              ) : null}
              {active && keys.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                  {keys.map((x) => (
                    <li key={x.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0">
                        {x.label} <span className="font-mono text-xs text-muted">{x.name}</span>
                        {x.need_reason ? <span className="block text-xs text-muted">{x.need_reason}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <NeedBadge need={x.need} configured={x.configured} />
                        <Button size="sm" variant="secondary" onClick={() => onSecret(x)}>
                          <KeyRound className="h-4 w-4" /> {x.configured ? "Renouveler" : "Définir"}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {error[g.key] ? <Alert tone="danger">{error[g.key]}</Alert> : null}
              <div className="flex justify-end">
                <Button size="sm" loading={busy === g.key} onClick={() => void save(g.key)}>
                  Enregistrer — {g.title}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
