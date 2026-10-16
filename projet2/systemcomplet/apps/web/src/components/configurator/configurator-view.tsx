"use client";

import clsx from "clsx";
import { Camera, Check, Copy, GitCompare, Lock, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SceneViewer, type SceneViewerHandle } from "@/components/three/scene-viewer";
import { Input } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, money, number, toNumber } from "@/lib/format";
import { optionLabel } from "@/lib/labels";

interface MaterialOption {
  id: string;
  name: string;
  description?: string | null;
  unit: string;
  unit_price: string;
  currency: string;
  availability?: string | null;
  lead_time_days?: number | null;
  tier?: string | null;
  color_hex?: string | null;
  roughness?: string | null;
  metalness?: string | null;
  texture_repeat?: string | null;
  image_url?: string | null;
  texture_url?: string | null;
  normal_url?: string | null;
}

interface Zone {
  id: string;
  key: string;
  label: string;
  room?: string | null;
  category_key: string;
  mesh_names: string[];
  quantity: string;
  unit: string;
  default_material_id: string;
  materials: MaterialOption[];
}

interface ModelData {
  id: string;
  name: string;
  file_url?: string | null;
  lock_date?: string | null;
  choices_open: boolean;
  published_to_client?: boolean;
  zones: Zone[];
}

interface ScenarioItem {
  id: string;
  zone_id: string;
  material_id: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  default_line_total: string;
  delta: string;
  delay_days: number;
  zone: string;
  mesh_names: string[];
  material?: MaterialOption | null;
}

interface Scenario {
  id: string;
  name: string;
  status: string;
  base_total: string;
  scenario_total: string;
  price_delta: string;
  delay_delta_days: number;
  computed_at?: string | null;
  decision_id?: string | null;
  snapshot_file_id?: string | null;
  items: ScenarioItem[];
}

interface CompareData {
  scenarios: { id: string; name: string; status: string; total: string; price_delta: string; delay_delta_days: number }[];
  zones: { zone: string; choices: Record<string, { material: string; tier?: string | null; line_total: string; delta: string; delay_days: number }> }[];
}

function materialSpec(m?: MaterialOption | null) {
  if (!m) return null;
  return { color_hex: m.color_hex, roughness: m.roughness, metalness: m.metalness, texture_url: m.texture_url, normal_url: m.normal_url, repeat: m.texture_repeat };
}

/** Configurateur 3D de matériaux (§11) : choix par zone, aperçu temps réel, delta prix/délai, comparaison, soumission OTP. */
export function ConfiguratorView({ modelId, validationsHref }: { modelId: string; validationsHref?: string }) {
  const toast = useToast();
  const router = useRouter();
  const viewer = useRef<SceneViewerHandle>(null);
  const [model, setModel] = useState<ModelData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meshesReady, setMeshesReady] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, list] = await Promise.all([api<ModelData>(`/configurator/models/${modelId}`), api<Scenario[]>(`/configurator/models/${modelId}/scenarios`)]);
        if (cancelled) return;
        setModel(m);
        let rows = list;
        if (!rows.length && m.choices_open) {
          try {
            rows = [await api<Scenario>(`/configurator/models/${modelId}/scenarios`, { method: "POST", body: { name: "Mon scénario" } })];
          } catch {
            /* consultation seule */
          }
        }
        setScenarios(rows);
        setActiveId(rows.find((s) => s.status === "draft")?.id ?? rows[0]?.id ?? null);
        setZoneId(m.zones[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const scenario = scenarios.find((s) => s.id === activeId) ?? null;
  const itemByZone = useMemo(() => new Map((scenario?.items ?? []).map((i) => [i.zone_id, i])), [scenario]);
  const editable = !!model?.choices_open && scenario?.status === "draft";

  // Applique les matériaux du scénario à la maquette 3D.
  useEffect(() => {
    if (!meshesReady || !scenario || !model) return;
    model.zones.forEach((z) => {
      const item = itemByZone.get(z.id);
      const material = item?.material ?? z.materials.find((m) => m.id === z.default_material_id);
      const spec = materialSpec(material);
      if (spec) viewer.current?.applyMaterial(z.mesh_names, spec);
    });
  }, [meshesReady, scenario, model, itemByZone]);

  const choose = async (zone: Zone, material: MaterialOption) => {
    if (!scenario || !editable) return;
    setBusy(`choice-${material.id}`);
    viewer.current?.applyMaterial(zone.mesh_names, materialSpec(material)!);
    try {
      const updated = await api<Scenario>(`/configurator/scenarios/${scenario.id}/choices`, { method: "PUT", body: { zone_id: zone.id, material_id: material.id } });
      setScenarios((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      toast.error("Choix non enregistré", errorMessage(err));
      const previous = itemByZone.get(zone.id)?.material;
      if (previous) viewer.current?.applyMaterial(zone.mesh_names, materialSpec(previous)!);
    } finally {
      setBusy(null);
    }
  };

  const capture = async () => {
    if (!scenario) return;
    setBusy("snapshot");
    try {
      const blob = await viewer.current?.snapshot();
      if (!blob) throw new Error("Capture indisponible");
      const form = new FormData();
      form.append("file", new File([blob], `${scenario.name}.png`, { type: "image/png" }));
      const updated = await api<Scenario>(`/configurator/scenarios/${scenario.id}/snapshot`, { method: "POST", form });
      setScenarios((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Capture enregistrée");
    } catch (err) {
      toast.error("Capture impossible", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!model) return <Skeleton className="h-[36rem] w-full" />;
  const zone = model.zones.find((z) => z.id === zoneId) ?? model.zones[0];
  const current = zone ? itemByZone.get(zone.id) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">{model.name}</h1>
          <p className="text-sm text-muted">{model.choices_open ? (model.lock_date ? `Choix ouverts jusqu'au ${date(model.lock_date)}` : "Choix ouverts") : "Les choix sont clôturés"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm" aria-label="Scénario">
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {optionLabel(s.status)}
              </option>
            ))}
          </select>
          {scenario ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => {
                setDupName(`${scenario.name} (variante)`);
                setDupOpen(true);
              }}>
                <Copy className="h-4 w-4" /> Variante
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setCompareIds(scenarios.slice(0, 2).map((s) => s.id))} disabled={scenarios.length < 2}>
                <GitCompare className="h-4 w-4" /> Comparer
              </Button>
              {model.file_url ? (
                <Button variant="secondary" size="sm" onClick={capture} loading={busy === "snapshot"}>
                  <Camera className="h-4 w-4" /> Capture
                </Button>
              ) : null}
              {editable ? (
                <Button size="sm" variant="accent" onClick={() => setSubmitOpen(true)}>
                  <Send className="h-4 w-4" /> Soumettre pour validation
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {scenario ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs uppercase text-muted">Total de référence</p>
            <p className="mt-1 font-title text-xl font-bold">{money(scenario.base_total)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted">Total du scénario</p>
            <p className="mt-1 font-title text-xl font-bold text-brand-700">{money(scenario.scenario_total)}</p>
            <p className={clsx("text-sm font-semibold", toNumber(scenario.price_delta) > 0 ? "text-amber-700" : toNumber(scenario.price_delta) < 0 ? "text-emerald-700" : "text-muted")}>
              {toNumber(scenario.price_delta) > 0 ? "+" : ""}
              {money(scenario.price_delta)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted">Impact délai</p>
            <p className={clsx("mt-1 font-title text-xl font-bold", scenario.delay_delta_days > 0 ? "text-amber-700" : "text-ink")}>
              {scenario.delay_delta_days > 0 ? "+" : ""}
              {scenario.delay_delta_days} jour(s)
            </p>
            <StatusBadge status={scenario.status} />
          </Card>
        </div>
      ) : (
        <Alert tone="info">Aucun scénario : la configuration est en lecture seule.</Alert>
      )}
      {!editable && scenario ? (
        <Alert tone="warning">
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Ce scénario n'est plus modifiable{scenario.status !== "draft" ? ` (${optionLabel(scenario.status)})` : ""}.
          </span>
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {model.file_url ? (
            <SceneViewer ref={viewer} url={model.file_url} className="h-[60vh] min-h-[380px]" onLoaded={() => setMeshesReady(true)} onPick={(name) => {
              const z = model.zones.find((x) => x.mesh_names.includes(name) || x.mesh_names.some((n) => name.startsWith(`${n}_`)));
              if (z) setZoneId(z.id);
            }} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-brand-50 text-sm text-muted">Aperçu 3D indisponible pour cette maquette.</div>
          )}
          <p className="mt-2 text-xs text-muted">Touchez une surface de la maquette pour sélectionner la zone correspondante.</p>
        </div>
        <Card className="lg:col-span-2">
          <CardHeader title="Zones et matériaux" />
          <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2">
            {model.zones.map((z) => (
              <button key={z.id} type="button" onClick={() => setZoneId(z.id)} className={clsx("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium", z.id === zone?.id ? "bg-brand-500 text-white" : "bg-slate-100 text-ink hover:bg-slate-200")}>
                {z.label}
              </button>
            ))}
          </div>
          {zone ? (
            <div className="space-y-3 p-4">
              <p className="text-xs text-muted">
                {zone.room ? `${zone.room} · ` : ""}
                {number(zone.quantity, 2)} {zone.unit}
                {current ? ` · actuel : ${current.material?.name ?? "—"} (${money(current.line_total)})` : ""}
              </p>
              <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
                {zone.materials.map((m) => {
                  const selected = current?.material_id === m.id || (!current && m.id === zone.default_material_id);
                  const lineTotal = toNumber(m.unit_price) * toNumber(zone.quantity);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={!editable || busy === `choice-${m.id}`}
                        onClick={() => void choose(zone, m)}
                        className={clsx("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition", selected ? "border-brand-400 bg-brand-50" : "border-line hover:border-brand-200", !editable && "cursor-default")}
                      >
                        {m.image_url ? <img src={m.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-line" style={{ backgroundColor: m.color_hex ?? "#ddd" }} />}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {m.name} {m.tier ? <Badge tone="accent">{optionLabel(m.tier)}</Badge> : null}
                          </span>
                          <span className="block text-xs text-muted">
                            {money(m.unit_price)}/{m.unit} · total {money(lineTotal)}
                            {m.availability && m.availability !== "in_stock" ? ` · ${optionLabel(m.availability)}` : ""}
                            {m.lead_time_days ? ` · ${m.lead_time_days} j` : ""}
                          </span>
                        </span>
                        {selected ? <Check className="h-5 w-5 text-brand-600" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <Modal
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        title="Créer une variante"
        size="sm"
        footer={
          <Button
            loading={busy === "dup"}
            disabled={dupName.trim().length < 2}
            onClick={async () => {
              if (!scenario) return;
              setBusy("dup");
              try {
                const copy = await api<Scenario>(`/configurator/scenarios/${scenario.id}/duplicate`, { method: "POST", body: { name: dupName.trim() } });
                setScenarios((list) => [...list, copy]);
                setActiveId(copy.id);
                setDupOpen(false);
              } catch (err) {
                toast.error("Variante impossible", errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            Créer
          </Button>
        }
      >
        <Input value={dupName} onChange={(e) => setDupName(e.target.value)} aria-label="Nom de la variante" />
      </Modal>

      <Modal
        open={compareIds.length > 0}
        onClose={() => {
          setCompareIds([]);
          setCompare(null);
        }}
        title="Comparer des scénarios"
        size="xl"
        footer={
          <Button
            disabled={compareIds.length < 2}
            loading={busy === "compare"}
            onClick={async () => {
              setBusy("compare");
              try {
                setCompare(await api<CompareData>(`/configurator/models/${modelId}/compare`, { query: { ids: compareIds.join(",") } }));
              } catch (err) {
                toast.error("Comparaison impossible", errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            Comparer
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm">
              <input
                type="checkbox"
                checked={compareIds.includes(s.id)}
                onChange={(e) => setCompareIds((ids) => (e.target.checked ? [...ids, s.id].slice(0, 4) : ids.filter((x) => x !== s.id)))}
              />
              {s.name}
            </label>
          ))}
        </div>
        {compare ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Zone</th>
                  {compare.scenarios.map((s) => (
                    <th key={s.id} className="px-3 py-2 text-left">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {compare.zones.map((z) => (
                  <tr key={z.zone}>
                    <td className="px-3 py-2 font-medium">{z.zone}</td>
                    {compare.scenarios.map((s) => {
                      const c = z.choices[s.id];
                      return (
                        <td key={s.id} className="px-3 py-2">
                          {c ? (
                            <>
                              {c.material}
                              <span className="block text-xs text-muted">
                                {money(c.line_total)} ({toNumber(c.delta) > 0 ? "+" : ""}
                                {money(c.delta)}) {c.delay_days ? `· ${c.delay_days} j` : ""}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-brand-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  {compare.scenarios.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      {money(s.total)}
                      <span className="block text-xs font-normal">
                        {toNumber(s.price_delta) > 0 ? "+" : ""}
                        {money(s.price_delta)} · {s.delay_delta_days} j
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Soumettre ce scénario"
        text={`Le scénario « ${scenario?.name ?? ""} » (${money(scenario?.price_delta ?? 0)}, ${scenario?.delay_delta_days ?? 0} j) sera soumis à votre validation sécurisée par code. Il ne sera plus modifiable.`}
        confirmLabel="Soumettre"
        tone="accent"
        onConfirm={async () => {
          if (!scenario) return;
          const res = await api<Scenario>(`/configurator/scenarios/${scenario.id}/submit`, { method: "POST" });
          setScenarios((list) => list.map((s) => (s.id === res.id ? res : s)));
          toast.success("Scénario soumis", "Validez-le par code dans la rubrique Validations.");
          if (validationsHref) router.push(validationsHref);
        }}
      />
    </div>
  );
}
