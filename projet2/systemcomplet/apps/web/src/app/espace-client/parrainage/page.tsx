"use client";

import { Copy, Gift, HandCoins, MessageCircle, Share2, Smartphone, Users } from "lucide-react";
import { useState } from "react";

import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton, Stat } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface ReferralState {
  enabled: boolean;
  enrolled: boolean;
  rules: { reward_type: "percent" | "fixed"; reward_pct: number; reward_fixed: number; reward_cap: number; min_contract_amount: number; referee_benefit: string };
  ambassador?: {
    code: string;
    share_url: string;
    has_payout: boolean;
    momo_operator?: string | null;
    momo_hint?: string | null;
    stats: { referrals: number; signed: number; earned: string; pending: string; paid: string };
  };
  referrals?: { id: string; number: string; referee: string; status: string; amount: string; created_at: string; signed_at?: string | null; paid_at?: string | null; rejection_reason?: string | null }[];
}

const STATUS: Record<string, { label: string; tone: "info" | "accent" | "success" | "neutral" | "warning" }> = {
  captured: { label: "Demande reçue", tone: "info" },
  signed: { label: "Contrat signé — prime en validation", tone: "accent" },
  approved: { label: "Prime validée", tone: "success" },
  paid: { label: "Prime versée", tone: "success" },
  rejected: { label: "Non éligible", tone: "neutral" },
};

function rewardText(r: ReferralState["rules"]): string {
  const base = r.reward_type === "fixed" ? money(r.reward_fixed) : `${number(r.reward_pct, 1)} % du montant du contrat signé`;
  return `${base}${r.reward_cap ? ` (plafond ${money(r.reward_cap)})` : ""}, pour tout contrat d'au moins ${money(r.min_contract_amount)}`;
}

export default function ReferralPage() {
  const toast = useToast();
  const state = useApi<ReferralState>("/client/referral");
  const [terms, setTerms] = useState(false);
  const [momo, setMomo] = useState("");
  const [operator, setOperator] = useState("mtn");
  const [busy, setBusy] = useState(false);
  if (state.loading && !state.data) return <Skeleton className="h-96 w-full" />;
  if (!state.data) return <Alert tone="danger">{state.error}</Alert>;
  const s = state.data;
  if (!s.enabled && !s.enrolled)
    return (
      <EmptyState
        icon={<Gift className="h-8 w-8" />}
        title="Programme de parrainage non disponible"
        text="Ce service n'est pas ouvert pour le moment. Vous serez informé dès son ouverture."
      />
    );
  const amb = s.ambassador;
  const join = async () => {
    setBusy(true);
    try {
      await api("/client/referral", { body: { accept_terms: terms, momo_number: momo || null, momo_operator: momo ? operator : null } });
      toast.success("Bienvenue dans le programme ambassadeurs !");
      void state.reload();
    } catch (err) {
      toast.error("Adhésion impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const savePayout = async () => {
    try {
      await api("/client/referral/payout", { method: "PUT", body: { momo_number: momo, momo_operator: operator } });
      toast.success("Numéro de versement enregistré", "Par sécurité, une prime ne part pas vers un numéro modifié depuis moins de 30 jours sans contrôle.");
      setMomo("");
      void state.reload();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    }
  };
  const share = async () => {
    if (!amb) return;
    const text = `Je recommande GLOBUS ENGINEERING pour construire en toute confiance. ${s.rules.referee_benefit}. Mon lien : ${amb.share_url}`;
    if (navigator.share) {
      await navigator.share({ title: "GLOBUS ENGINEERING", text, url: amb.share_url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Message copié");
    }
  };
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Gift className="h-7 w-7 text-accent-500" /> Programme ambassadeurs
          </span>
        }
        subtitle="Recommandez GLOBUS à vos proches : ils bénéficient d'un avantage, vous recevez une prime à la signature de leur contrat."
      />
      {!s.enabled ? (
        <Alert tone="info">Le programme est fermé : vos recommandations déjà enregistrées restent suivies et les primes dues vous sont versées.</Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <Users className="h-6 w-6 text-brand-500" />
          <p className="mt-2 font-semibold">1. Partagez votre lien</p>
          <p className="text-sm text-muted">Par WhatsApp, SMS ou e-mail. Votre code suit la visite pendant 90 jours.</p>
        </Card>
        <Card className="p-5">
          <MessageCircle className="h-6 w-6 text-brand-500" />
          <p className="mt-2 font-semibold">2. Votre proche est accompagné</p>
          <p className="text-sm text-muted">{s.rules.referee_benefit}.</p>
        </Card>
        <Card className="p-5">
          <HandCoins className="h-6 w-6 text-accent-500" />
          <p className="mt-2 font-semibold">3. Vous êtes récompensé</p>
          <p className="text-sm text-muted">{rewardText(s.rules)}, versée par Mobile Money.</p>
        </Card>
      </div>
      {!amb ? (
        <Card>
          <CardHeader title="Devenir ambassadeur" subtitle="Gratuit, sans engagement. Votre code personnel est créé immédiatement." />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Numéro Mobile Money pour vos primes (facultatif)" help="Modifiable plus tard depuis cette page.">
              <Input type="tel" inputMode="tel" value={momo} onChange={(e) => setMomo(e.target.value)} placeholder="6 7X XX XX XX" />
            </Field>
            <Field label="Opérateur">
              <Select value={operator} onChange={(e) => setOperator(e.target.value)} options={[{ value: "mtn", label: "MTN Mobile Money" }, { value: "orange", label: "Orange Money" }]} />
            </Field>
            <div className="md:col-span-2">
              <Checkbox
                checked={terms}
                onChange={setTerms}
                label="J'accepte le règlement du programme ambassadeurs"
                description="Pas de prime pour soi-même ni pour un contact déjà connu de GLOBUS ; prime due à la signature du contrat, validée par la Direction commerciale."
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-line px-5 py-3">
            <Button variant="accent" disabled={!terms || !s.enabled} loading={busy} onClick={() => void join()}>
              Rejoindre le programme
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-accent-500 p-6 text-white">
              <p className="text-sm text-white/80">Votre code ambassadeur</p>
              <p className="mt-1 font-title text-4xl font-extrabold tracking-[0.2em]">{amb.code}</p>
              <p className="mt-2 break-all text-sm text-white/90">{amb.share_url}</p>
              <div className={s.enabled ? "mt-4 flex flex-wrap gap-2" : "hidden"}>
                <Button variant="light" size="sm" onClick={() => void share()}>
                  <Share2 className="h-4 w-4" /> Partager
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(amb.share_url);
                    toast.success("Lien copié");
                  }}
                >
                  <Copy className="h-4 w-4" /> Copier le lien
                </Button>
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white"
                  href={`https://wa.me/?text=${encodeURIComponent(`Je recommande GLOBUS ENGINEERING : ${amb.share_url}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Recommandations" value={amb.stats.referrals} />
              <Stat label="Contrats signés" value={amb.stats.signed} tone="info" />
              <Stat label="Primes en validation" value={money(amb.stats.pending)} tone="warning" />
              <Stat label="Primes versées" value={money(amb.stats.paid)} tone="success" />
            </div>
          </Card>
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-brand-500" /> Versement des primes
                </span>
              }
              subtitle={amb.has_payout ? `Numéro enregistré : ${amb.momo_hint} (${amb.momo_operator === "orange" ? "Orange Money" : "MTN MoMo"})` : "Aucun numéro enregistré"}
            />
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_200px_auto] md:items-end">
              <Field label={amb.has_payout ? "Nouveau numéro Mobile Money" : "Numéro Mobile Money"}>
                <Input type="tel" inputMode="tel" value={momo} onChange={(e) => setMomo(e.target.value)} placeholder="6 7X XX XX XX" />
              </Field>
              <Field label="Opérateur">
                <Select value={operator} onChange={(e) => setOperator(e.target.value)} options={[{ value: "mtn", label: "MTN Mobile Money" }, { value: "orange", label: "Orange Money" }]} />
              </Field>
              <Button disabled={momo.replace(/\D/g, "").length < 9} onClick={() => void savePayout()}>
                Enregistrer
              </Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Mes recommandations" />
            {s.referrals?.length ? (
              <ul className="divide-y divide-line">
                {s.referrals.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{r.referee}</p>
                      <p className="text-xs text-muted">
                        Recommandé le {date(r.created_at)}
                        {r.signed_at ? ` · contrat signé le ${date(r.signed_at)}` : ""}
                        {r.paid_at ? ` · prime versée le ${date(r.paid_at)}` : ""}
                        {r.rejection_reason ? ` · ${r.rejection_reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {Number(r.amount) > 0 ? <span className="font-semibold tabular-nums">{money(r.amount)}</span> : null}
                      <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState title="Aucune recommandation pour l'instant" text="Partagez votre lien : chaque demande déposée avec votre code apparaîtra ici." />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
