"use client";

/** Géographie des visiteurs et des prospects : Cameroun / diaspora, continents, pays, régions, villes, carte Google.
 * Lieux déduits de l'adresse IP sur le serveur (base DB-IP, ville au plus, IP jamais conservée). */

import { Globe2, MapPin } from "lucide-react";
import { useState } from "react";

import { Alert, Card, CardHeader, Stat } from "@/components/ui/primitives";
import { number, toNumber } from "@/lib/format";

type Row = Record<string, any>;

export const CONTINENT_NAMES: Record<string, string> = {
  AF: "Afrique",
  AN: "Antarctique",
  AS: "Asie",
  EU: "Europe",
  NA: "Amérique du Nord",
  OC: "Océanie",
  SA: "Amérique du Sud",
};

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["fr"], { type: "region" }) : null;

export function flag(code?: string | null): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** « CM » → « Cameroun » (nom français du navigateur). */
export function countryName(code?: string | null): string {
  if (!code || code === "(non défini)") return "Non localisé";
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** « CM|Douala » → « Douala » et « Cameroun ». */
export function placeParts(value?: string | null): { name: string; country: string | null } {
  if (!value || value === "(non défini)") return { name: "Non localisé", country: null };
  const [country, ...rest] = String(value).split("|");
  return rest.length ? { name: rest.join("|"), country } : { name: String(value), country: null };
}

function GeoList({ title, subtitle, rows, label, valueKey = "sessions", extraKey, extraLabel, limit = 12 }: { title: string; subtitle?: string; rows?: Row[]; label: (r: Row) => React.ReactNode; valueKey?: string; extraKey?: string; extraLabel?: string; limit?: number }) {
  const list = (rows ?? []).filter((r) => r.value && r.value !== "(non défini)");
  const total = list.reduce((s, r) => s + toNumber(r[valueKey]), 0);
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <ul className="divide-y divide-line text-sm">
        {list.slice(0, limit).map((r) => (
          <li key={String(r.value)} className="px-4 py-2">
            <div className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{label(r)}</span>
              <span className="shrink-0 tabular-nums">
                {number(r[valueKey])}
                {extraKey ? (
                  <span className="text-xs text-muted">
                    {" "}
                    · {number(r[extraKey])} {extraLabel}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${total ? (toNumber(r[valueKey]) * 100) / total : 0}%` }} />
            </div>
          </li>
        ))}
        {!list.length ? <li className="px-4 py-3 text-muted">Pas encore de visiteur localisé.</li> : null}
      </ul>
    </Card>
  );
}

function VisitorMap({ query }: { query: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Card>
      <CardHeader title="Carte des visiteurs" subtitle="Villes d'origine : vert = Cameroun, orange = hors Cameroun (Google Maps)." />
      <div className="p-4">
        {failed ? (
          <p className="text-sm text-muted">
            Carte Google indisponible : renseignez la clé Google Maps (API « Maps Static » activée) dans Paramètres › Intégrations, ou aucun visiteur n&apos;est encore localisé sur la période.
          </p>
        ) : (
          <img src={`/api/v1/analytics/visitor-map?${query}`} alt="Carte des villes d'origine des visiteurs" className="w-full rounded-xl ring-1 ring-line" onError={() => setFailed(true)} />
        )}
      </div>
    </Card>
  );
}

export function GeoSection({ o, query }: { o: Row; query: string }) {
  const zones = Object.fromEntries(((o.zones ?? []) as Row[]).map((z) => [z.value, toNumber(z.sessions)]));
  const cameroon = zones.cameroun ?? 0;
  const abroad = zones.hors_cameroun ?? 0;
  const located = cameroon + abroad;
  const unknown = Math.max(0, toNumber(o.totals?.sessions) - located);
  const prospects = (o.prospects ?? {}) as Row;
  const geoip = (o.geoip ?? {}) as Row;
  const pct = (n: number, d: number) => (d ? `${number((n * 100) / d, 1)} %` : "—");
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe2 className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold">Géographie des visiteurs et des prospects</h2>
      </div>
      {geoip.available === false ? (
        <Alert tone="info">
          La base de géolocalisation est en cours d&apos;installation sur le serveur (téléchargement automatique, mise à jour chaque mois) : les nouveaux visiteurs seront localisés dès qu&apos;elle sera prête. Les visites passées ne peuvent pas l&apos;être (aucune adresse IP n&apos;est conservée).
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Hors Cameroun (diaspora et international)" value={pct(abroad, located)} hint={`${number(abroad)} sessions localisées à l'étranger`} tone="info" />
        <Stat label="Depuis le Cameroun" value={pct(cameroon, located)} hint={`${number(cameroon)} sessions${unknown ? ` · ${number(unknown)} non localisées` : ""}`} />
        <Stat label="Prospects de la diaspora" value={pct(toNumber(prospects.diaspora), toNumber(prospects.total))} hint={`${number(prospects.diaspora)} sur ${number(prospects.total)} demandes de la période`} tone="success" />
        <Stat label="Prospects localisés" value={number(prospects.located)} hint="Lieu détecté à l'envoi de la demande (connexion ou indicatif téléphonique)." />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <GeoList title="Continents" rows={o.continents} label={(r) => CONTINENT_NAMES[r.value] ?? r.value} extraKey="conversions" extraLabel="conv." />
        <GeoList
          title="Pays"
          rows={o.countries}
          label={(r) => (
            <>
              <span aria-hidden="true">{flag(r.value)}</span> {countryName(r.value)}
            </>
          )}
          extraKey="conversions"
          extraLabel="conv."
          limit={20}
        />
        <GeoList
          title="Prospects par pays"
          subtitle="Demandes reçues (formulaires, assistant, WhatsApp) selon le lieu détecté."
          rows={(prospects.countries ?? []) as Row[]}
          valueKey="leads"
          extraKey="qualified"
          extraLabel="qualifiés"
          label={(r) => (
            <>
              <span aria-hidden="true">{flag(r.value)}</span> {countryName(r.value)}
            </>
          )}
          limit={20}
        />
        <GeoList
          title="Régions"
          rows={o.regions}
          label={(r) => {
            const p = placeParts(r.value);
            return (
              <>
                {p.name} <span className="text-xs text-muted">{p.country ? `${flag(p.country)} ${countryName(p.country)}` : ""}</span>
              </>
            );
          }}
          extraKey="conversions"
          extraLabel="conv."
          limit={15}
        />
        <GeoList
          title="Villes"
          rows={o.cities}
          label={(r) => {
            const p = placeParts(r.value);
            return (
              <>
                <MapPin className="mr-1 inline h-3.5 w-3.5 text-muted" />
                {p.name} <span className="text-xs text-muted">{p.country ? `${flag(p.country)} ${countryName(p.country)}` : ""}</span>
              </>
            );
          }}
          extraKey="conversions"
          extraLabel="conv."
          limit={20}
        />
        <VisitorMap query={query} />
      </div>
      <p className="text-xs text-muted">
        Localisation approximative (ville au plus) déduite de l&apos;adresse IP sur le serveur ; l&apos;adresse n&apos;est jamais conservée.{" "}
        <a href={geoip.attribution?.url ?? "https://db-ip.com"} target="_blank" rel="noopener noreferrer" className="underline">
          {geoip.attribution?.label ?? "IP Geolocation by DB-IP"}
        </a>
        {geoip.edition ? ` · édition du ${new Date(geoip.edition).toLocaleDateString("fr-FR")}` : ""}
      </p>
    </section>
  );
}
