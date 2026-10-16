"use client";

import { Eye, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { ResourceView, type Row } from "@/components/erp/resource";
import { ConfiguratorView } from "@/components/configurator/configurator-view";
import { RefSelect } from "@/components/forms/ref-select";
import { Checkbox, Field, FileDrop, Input, Select, TagInput } from "@/components/ui/form";
import { Modal, Tabs } from "@/components/ui/overlay";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageTitle, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, apiUrl, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money, number, toNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { optionLabel } from "@/lib/labels";
import { REFS } from "@/lib/refs";

const opts = (values: string[]) => values.map((v) => ({ value: v, label: optionLabel(v) }));
const TIERS = ["standard", "confort", "premium"];
const AVAILABILITY = ["in_stock", "on_order", "unavailable"];

/* ----------------------------------------------------------------------------- catalogue */

function MaterialAssets({ material, reload }: { material: Row; reload: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState("image");
  const [file, setFile] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(["image", "texture", "normal"] as const).map((k) => (
          <div key={k} className="text-center">
            <div className="aspect-square overflow-hidden rounded-xl bg-slate-100" style={material.color_hex ? { backgroundColor: material.color_hex } : undefined}>
              {material[{ image: "image_file_id", texture: "texture_file_id", normal: "normal_map_file_id" }[k]] ? <img src={apiUrl(`/configurator/materials/${material.id}/${k}`)} alt={`${material.name} — ${k}`} className="h-full w-full object-cover" /> : null}
            </div>
            <p className="mt-1 text-xs text-muted">{k === "image" ? "Vignette" : k === "texture" ? "Texture" : "Carte normale"}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-line p-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "image", label: "Vignette" }, { value: "texture", label: "Texture (répétable)" }, { value: "normal", label: "Carte normale" }]} aria-label="Ressource" />
        <FileDrop files={file} onChange={setFile} accept="image/*" maxSizeMb={40} />
        <Button
          size="sm"
          loading={busy}
          disabled={!file.length}
          onClick={async () => {
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append("kind", kind);
              fd.append("file", file[0]);
              await api(`/configurator/materials/${material.id}/assets`, { method: "POST", form: fd });
              setFile([]);
              reload();
              toast.success("Ressource enregistrée");
            } catch (err) {
              toast.error("Envoi impossible", errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload className="h-4 w-4" /> Envoyer
        </Button>
      </div>
      <p className="text-sm">
        {money(material.unit_price, material.currency === "XAF" ? "FCFA" : material.currency)} / {material.unit} · {optionLabel(material.tier)} · {optionLabel(material.availability)}
        {material.lead_time_days ? ` · délai ${material.lead_time_days} j` : ""}
      </p>
    </div>
  );
}

export function MaterialsCatalogue() {
  const categories = useApi<{ items: Row[] }>("/configurator/material-categories", { page_size: 200 });
  const categoryOptions = (categories.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
  const fields = {
    category_id: { options: categoryOptions },
    tier: { options: opts(TIERS) },
    availability: { options: opts(AVAILABILITY) },
    color_hex: { widget: "color" as const },
    target_mesh_tags: { widget: "tags" as const, help: "Étiquettes de maillages compatibles (sol, mur, façade…)." },
    supplier_id: { ref: "suppliers" as const },
  };
  return (
    <div className="space-y-8">
      <ResourceView
        embedded
        config={{
          title: "Matériaux",
          subtitle: "Catalogue du configurateur : prix, délai, disponibilité, rendu (couleur, rugosité, textures), validité.",
          path: "/configurator/materials",
          columns: [
            { key: "name", label: "Matériau", sortable: true, render: (r) => (
              <span className="flex items-center gap-2">
                <span className="h-6 w-6 shrink-0 overflow-hidden rounded-md ring-1 ring-line" style={{ backgroundColor: r.color_hex ?? "#e2e8f0" }}>
                  {r.image_file_id ? <img src={apiUrl(`/configurator/materials/${r.id}/image`)} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                {r.name}
              </span>
            ) },
            { key: "category_id", label: "Catégorie", render: (r) => categoryOptions.find((c) => c.value === r.category_id)?.label ?? "—" },
            { key: "tier", label: "Gamme", format: "option" },
            { key: "unit_price", label: "Prix", sortable: true, render: (r) => `${money(r.unit_price)} / ${r.unit}` },
            { key: "availability", label: "Disponibilité", format: "option" },
            { key: "is_active", label: "Actif", format: "bool", hideOnMobile: true },
          ],
          filters: [
            { key: "category_id", label: "Catégorie", options: categoryOptions },
            { key: "tier", label: "Gamme", options: opts(TIERS) },
            { key: "availability", label: "Disponibilité", options: opts(AVAILABILITY) },
          ],
          create: { endpoint: "POST /configurator/materials", label: "Nouveau matériau", perms: ["configurator:manage"], fields, initial: { unit: "m2", currency: "XAF", tier: "standard", availability: "in_stock", roughness: 0.6, metalness: 0, texture_repeat: 1 } },
          update: { endpoint: "PATCH /configurator/materials/{item_id}", perms: ["configurator:manage"], fields },
          remove: { path: (r) => `/configurator/materials/${r.id}`, perms: ["configurator:manage"] },
          detail: (r, reload) => <MaterialAssets material={r} reload={reload} />,
        }}
      />
      <ResourceView
        embedded
        config={{
          title: "Catégories",
          path: "/configurator/material-categories",
          columns: [
            { key: "sort_order", label: "Ordre" },
            { key: "key", label: "Clé" },
            { key: "name", label: "Catégorie" },
          ],
          create: { endpoint: "POST /configurator/material-categories", label: "Nouvelle catégorie", perms: ["configurator:manage"] },
          update: { endpoint: "PATCH /configurator/material-categories/{item_id}", perms: ["configurator:manage"] },
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------- maquettes configurables */

interface ZoneDraft {
  key: string;
  label: string;
  room: string;
  category_key: string;
  mesh_names: string[];
  quantity: string;
  unit: string;
  default_material_id: string;
  allowed_material_ids: string[];
  planning_task_id: string | null;
}

const emptyZone = (n: number): ZoneDraft => ({ key: `zone-${n}`, label: "", room: "", category_key: "", mesh_names: [], quantity: "", unit: "m2", default_material_id: "", allowed_material_ids: [], planning_task_id: null });

function ModelCreate({ projectId, onDone, onCancel }: { projectId: string; onDone: (m: Row) => void; onCancel: () => void }) {
  const categories = useApi<{ items: Row[] }>("/configurator/material-categories", { page_size: 200 });
  const materials = useApi<{ items: Row[] }>("/configurator/materials", { page_size: 500, is_active: true });
  const federation = useApi<Row>(`/projects/${projectId}/bim/federation`);
  const [head, setHead] = useState({ name: "", source: "glb", bim_version_id: "", lock_date: "" });
  const [zones, setZones] = useState<ZoneDraft[]>([emptyZone(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cats = categories.data?.items ?? [];
  const mats = materials.data?.items ?? [];
  const matsFor = (categoryKey: string) => {
    const cat = cats.find((c) => c.key === categoryKey);
    return mats.filter((m) => m.category_id === cat?.id);
  };
  const setZone = (i: number, patch: Partial<ZoneDraft>) => setZones((all) => all.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" required>
          <Input value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} placeholder="Villa R+1 — finitions" />
        </Field>
        <Field label="Source 3D">
          <Select value={head.source} onChange={(e) => setHead({ ...head, source: e.target.value })} options={[{ value: "glb", label: "Fichier GLB / glTF (déposé ensuite)" }, { value: "bim_version", label: "Version de maquette BIM" }, { value: "parametric", label: "Modèle paramétrique" }]} />
        </Field>
        {head.source === "bim_version" ? (
          <Field label="Version BIM" required>
            <Select value={head.bim_version_id} onChange={(e) => setHead({ ...head, bim_version_id: e.target.value })} options={[{ value: "", label: "Choisir…" }, ...((federation.data?.models ?? []) as Row[]).map((m) => ({ value: m.version_id, label: `${m.model} v${m.number}` }))]} />
          </Field>
        ) : null}
        <Field label="Date limite des choix client">
          <Input type="date" value={head.lock_date} onChange={(e) => setHead({ ...head, lock_date: e.target.value })} />
        </Field>
      </div>
      <p className="text-sm font-semibold">Zones configurables (pièces / surfaces)</p>
      {zones.map((z, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Clé">
              <Input value={z.key} onChange={(e) => setZone(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })} />
            </Field>
            <Field label="Libellé" required>
              <Input value={z.label} onChange={(e) => setZone(i, { label: e.target.value })} placeholder="Sol du séjour" />
            </Field>
            <Field label="Pièce">
              <Input value={z.room} onChange={(e) => setZone(i, { room: e.target.value })} />
            </Field>
            <Field label="Catégorie" required>
              <Select value={z.category_key} onChange={(e) => setZone(i, { category_key: e.target.value, default_material_id: "", allowed_material_ids: [] })} options={[{ value: "", label: "Choisir…" }, ...cats.map((c) => ({ value: c.key, label: c.name }))]} />
            </Field>
            <Field label="Quantité" required>
              <Input type="number" min={0} step="any" value={z.quantity} onChange={(e) => setZone(i, { quantity: e.target.value })} />
            </Field>
            <Field label="Unité">
              <Input value={z.unit} onChange={(e) => setZone(i, { unit: e.target.value })} />
            </Field>
            <Field label="Matériau de base (inclus au contrat)" required className="md:col-span-2">
              <Select value={z.default_material_id} onChange={(e) => setZone(i, { default_material_id: e.target.value })} options={[{ value: "", label: "Choisir…" }, ...matsFor(z.category_key).map((m) => ({ value: m.id, label: `${m.name} — ${money(m.unit_price)}/${m.unit}` }))]} />
            </Field>
            <Field label="Options proposées au client" className="md:col-span-2">
              <div className="flex flex-wrap gap-2 rounded-xl border border-line p-2">
                {matsFor(z.category_key).map((m) => (
                  <Checkbox key={m.id} label={`${m.name} (${optionLabel(m.tier)})`} checked={z.allowed_material_ids.includes(m.id)} onChange={(c) => setZone(i, { allowed_material_ids: c ? [...z.allowed_material_ids, m.id] : z.allowed_material_ids.filter((x) => x !== m.id) })} />
                ))}
                {!z.category_key ? <span className="text-xs text-muted">Choisissez une catégorie.</span> : null}
              </div>
            </Field>
            <Field label="Maillages 3D ciblés" help="Noms des objets du GLB (sinon zone sans rendu)." className="md:col-span-2">
              <TagInput value={z.mesh_names} onChange={(v) => setZone(i, { mesh_names: v })} />
            </Field>
            <Field label="Tâche de planning liée" help="Le délai matériau est comparé à cette tâche.">
              <RefSelect source={REFS.tasks} value={z.planning_task_id} onChange={(v) => setZone(i, { planning_task_id: v })} context={{ project_id: projectId }} />
            </Field>
          </div>
          {zones.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setZones((all) => all.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" /> Retirer la zone
            </Button>
          ) : null}
        </Card>
      ))}
      <Button size="sm" variant="secondary" onClick={() => setZones((all) => [...all, emptyZone(all.length + 1)])}>
        <Plus className="h-4 w-4" /> Zone
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={busy}
          disabled={head.name.trim().length < 2 || zones.some((z) => !z.label || !z.category_key || !z.default_material_id || toNumber(z.quantity) <= 0)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const model = await api<Row>("/configurator/models", {
                method: "POST",
                body: {
                  project_id: projectId,
                  name: head.name.trim(),
                  source: head.source,
                  bim_version_id: head.source === "bim_version" ? head.bim_version_id || null : null,
                  lock_date: head.lock_date || null,
                  zones: zones.map((z, k) => ({ ...z, room: z.room || null, quantity: toNumber(z.quantity), allowed_material_ids: Array.from(new Set([z.default_material_id, ...z.allowed_material_ids])), sort_order: k })),
                },
              });
              onDone(model);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer la maquette configurable
        </Button>
      </div>
    </div>
  );
}

function ModelCard({ model, reload }: { model: Row; reload: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const scenarios = useApi<Row[]>(`/configurator/models/${model.id}/scenarios`);
  const [file, setFile] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [lockDate, setLockDate] = useState(model.lock_date ?? "");
  const publish = async (published: boolean) => {
    setBusy(true);
    try {
      await api(`/configurator/models/${model.id}/publish`, { method: "POST", body: { published, lock_date: lockDate || null } });
      toast.success(published ? "Configurateur publié dans l'espace client" : "Configurateur retiré de l'espace client");
      reload();
    } catch (err) {
      toast.error("Action impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={model.name}
        subtitle={`${(model.zones ?? []).length} zone(s) · source ${optionLabel(model.source)}${model.lock_date ? ` · choix jusqu'au ${date(model.lock_date)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {model.published_to_client ? <Badge tone="success">Publié client</Badge> : <Badge>Non publié</Badge>}
            {!model.choices_open ? <Badge tone="warning">Choix clos</Badge> : null}
            <Button size="sm" variant="secondary" onClick={() => setPreview(true)}>
              <Eye className="h-4 w-4" /> Aperçu
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <ul className="space-y-1 text-sm">
            {((model.zones ?? []) as Row[]).map((z) => (
              <li key={z.id} className="flex justify-between gap-2">
                <span>
                  {z.label} {z.room ? <span className="text-xs text-muted">· {z.room}</span> : null}
                </span>
                <span className="text-xs text-muted">
                  {number(z.quantity, 2)} {z.unit} · {(z.materials ?? []).length} option(s)
                </span>
              </li>
            ))}
          </ul>
          {can("configurator:manage") ? (
            <div className="space-y-2 rounded-xl border border-line p-3">
              <p className="text-xs font-semibold uppercase text-muted">Fichier 3D (GLB / glTF)</p>
              {model.file_url ? <p className="text-xs text-emerald-700">Fichier présent — un nouvel envoi le remplace.</p> : null}
              <FileDrop files={file} onChange={setFile} accept=".glb,.gltf" maxSizeMb={200} />
              <Button
                size="sm"
                loading={busy}
                disabled={!file.length}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", file[0]);
                    await api(`/configurator/models/${model.id}/file`, { method: "POST", form: fd });
                    setFile([]);
                    reload();
                  } catch (err) {
                    toast.error("Envoi impossible", errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Upload className="h-4 w-4" /> Envoyer
              </Button>
            </div>
          ) : null}
          {can("projects:publish_client") ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Date limite des choix">
                <Input type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
              </Field>
              <Button size="sm" loading={busy} onClick={() => void publish(!model.published_to_client)}>
                {model.published_to_client ? "Retirer de l'espace client" : "Publier dans l'espace client"}
              </Button>
            </div>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">Scénarios du client</p>
          {scenarios.loading && !scenarios.data ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {(scenarios.data ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {s.name} <span className="text-xs text-muted">r{s.revision}</span>
                    <span className="block text-xs text-muted">
                      {toNumber(s.price_delta) >= 0 ? "+" : ""}
                      {money(s.price_delta)} · {s.delay_delta_days > 0 ? `+${s.delay_delta_days} j` : "sans impact délai"}
                    </span>
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
              {!scenarios.data?.length ? <li className="px-3 py-3 text-muted">Aucun scénario.</li> : null}
            </ul>
          )}
        </div>
      </div>
      <Modal open={preview} onClose={() => setPreview(false)} title={`Aperçu — ${model.name}`} size="full">
        {preview ? <ConfiguratorView modelId={model.id} /> : null}
      </Modal>
    </Card>
  );
}

export function ConfiguratorModels() {
  const { can } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const models = useApi<Row[]>(projectId ? `/projects/${projectId}/configurator/models` : null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-72">
          <RefSelect source={REFS.projects} value={projectId} onChange={setProjectId} placeholder="Choisir un projet…" />
        </div>
        {projectId && can("configurator:manage") ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Maquette configurable
          </Button>
        ) : null}
      </div>
      {!projectId ? (
        <EmptyState title="Choisissez un projet" text="Les maquettes configurables sont propres à chaque projet." />
      ) : models.loading && !models.data ? (
        <Skeleton className="h-48" />
      ) : models.data?.length ? (
        <div className="space-y-4">
          {models.data.map((m) => (
            <ModelCard key={m.id} model={m} reload={() => void models.reload()} />
          ))}
        </div>
      ) : (
        <EmptyState title="Aucune maquette configurable" text="Créez des zones (sols, murs, façades…) reliées au catalogue de matériaux." />
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle maquette configurable" size="full">
        {projectId ? (
          <ModelCreate
            projectId={projectId}
            onCancel={() => setCreating(false)}
            onDone={() => {
              setCreating(false);
              void models.reload();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function ConfiguratorAdmin() {
  const { can } = useAuth();
  const [tab, setTab] = useState("maquettes");
  return (
    <div className="space-y-5">
      <PageTitle title="Configurateur 3D" subtitle="Catalogue de matériaux et maquettes configurables : le client compare ses finitions avec prix et délais en direct." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "maquettes", label: "Maquettes configurables" },
          { key: "catalogue", label: "Catalogue", hidden: !can("configurator:manage") },
        ]}
      />
      {tab === "catalogue" ? <MaterialsCatalogue /> : <ConfiguratorModels />}
    </div>
  );
}
