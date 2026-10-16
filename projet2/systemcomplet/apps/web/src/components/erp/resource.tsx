"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { SchemaForm, type FieldConfig } from "@/components/forms/schema-form";
import { DataTable, formatCell, type CellFormat, type Column, type FilterDef } from "@/components/ui/data-table";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/overlay";
import { Button, DescriptionList, PageTitle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, download } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useList, type UseList } from "@/lib/hooks";
import { fieldLabel } from "@/lib/labels";
import { BODIES } from "@/generated/schemas";

export type Row = Record<string, any>;

export interface RowAction {
  key: string;
  label: string;
  /** Clé BODIES (ex. "POST /procurement/orders/{order_id}/send") ; le paramètre de chemin reçoit l'identifiant de la ligne. */
  endpoint?: string;
  /** Chemin POST sans corps (confirmation simple). */
  path?: (row: Row) => string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  when?: (row: Row) => boolean;
  perms?: string[];
  confirm?: string;
  reasonLabel?: string;
  tone?: "primary" | "danger" | "accent";
  fields?: Record<string, FieldConfig>;
  initial?: (row: Row) => Row;
  success?: string;
  idempotent?: boolean;
  /** Corps JSON envoyé pour une action à confirmation simple (reçoit le motif saisi le cas échéant). */
  body?: (row: Row, reason: string) => Record<string, unknown>;
  /** Action personnalisée (ouverture d'un écran dédié…). */
  run?: (row: Row) => void;
}

export interface DetailField {
  key: string;
  label?: string;
  format?: CellFormat;
  render?: (row: Row) => ReactNode;
}

export interface ResourceConfig {
  title: string;
  subtitle?: string;
  /** Endpoint de liste (pagination serveur) ; ou `rows` statiques. */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  columns: Column<Row>[];
  filters?: FilterDef[];
  search?: boolean;
  /** Création : clé BODIES (ex. "POST /sites"). */
  create?: { endpoint: string; label?: string; fields?: Record<string, FieldConfig>; order?: string[]; exclude?: string[]; fixed?: Row; initial?: Row; perms?: string[]; idempotent?: boolean };
  /** Modification : clé BODIES (ex. "PATCH /sites/{item_id}"). */
  update?: { endpoint: string; fields?: Record<string, FieldConfig>; order?: string[]; exclude?: string[]; perms?: string[] };
  /** Suppression : chemin DELETE. */
  remove?: { path: (row: Row) => string; perms?: string[]; confirm?: string };
  actions?: RowAction[];
  /** Fiche détaillée : lien vers une page dédiée… */
  href?: (row: Row) => string;
  /** …ou contenu personnalisé du panneau latéral. */
  detail?: (row: Row, reload: () => void) => ReactNode;
  detailFields?: DetailField[];
  detailPath?: (row: Row) => string;
  exportDataset?: string;
  toolbar?: ReactNode;
  emptyText?: string;
  pageSize?: number;
}

function paramName(endpoint: string): string | null {
  const m = endpoint.match(/\{(\w+)\}/);
  return m ? m[1] : null;
}

const HIDDEN_DETAIL = new Set(["id", "deleted_at", "version", "password_hash", "token_hash", "portal_token_hash", "public_token_hash", "secret", "ciphertext"]);

export function RecordFields({ row, fields }: { row: Row; fields?: DetailField[] }) {
  const base: DetailField[] = fields ?? Object.keys(row).filter((k) => !HIDDEN_DETAIL.has(k) && typeof row[k] !== "object").map((k) => ({ key: k }));
  const items = base
    .filter((f) => f.render || (row[f.key] !== null && row[f.key] !== undefined && row[f.key] !== ""))
    .map((f) => {
      const value = row[f.key];
      const fmt: CellFormat | undefined =
        f.format ??
        (/_at$/.test(f.key) ? "datetime" : /(date|_on)$/.test(f.key) || /^(start|end)_/.test(f.key) ? "date" : /^(status|state)$/.test(f.key) ? "status" : typeof value === "boolean" ? "bool" : /(amount|total|price|cost|budget|balance|ceiling|salary)/.test(f.key) ? "money" : undefined);
      return { label: f.label ?? fieldLabel(f.key), value: f.render ? f.render(row) : formatCell(value, fmt ?? "option", row) };
    });
  return <DescriptionList items={items} />;
}

/** Action de ligne générique : formulaire généré (si l'endpoint a un corps) ou confirmation. */
export function ActionRunner({ action, row, onDone, onClose }: { action: RowAction; row: Row; onDone: (result: unknown) => void; onClose: () => void }) {
  const toast = useToast();
  const body = action.endpoint ? BODIES[action.endpoint] : undefined;
  const param = action.endpoint ? paramName(action.endpoint) : null;
  if (action.endpoint && body?.schema) {
    return (
      <Modal open onClose={onClose} title={action.label} size="lg">
        <SchemaForm
          endpoint={action.endpoint}
          params={param ? { [param]: String(row.id) } : {}}
          fields={action.fields}
          initial={action.initial?.(row)}
          idempotent={action.idempotent}
          submitLabel={action.label}
          onCancel={onClose}
          onSuccess={(res) => {
            toast.success(action.success ?? "Action effectuée");
            onDone(res);
          }}
        />
      </Modal>
    );
  }
  const path = action.path ? action.path(row) : action.endpoint ? action.endpoint.split(" ")[1].replace(/\{\w+\}/, String(row.id)) : "";
  const method = action.method ?? (action.endpoint?.split(" ")[0] as RowAction["method"]) ?? "POST";
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={action.label}
      text={action.confirm ?? "Confirmer cette action ?"}
      tone={action.tone ?? "primary"}
      confirmLabel={action.label}
      reasonLabel={action.reasonLabel}
      onConfirm={async (reason) => {
        const payload = action.body ? action.body(row, reason) : action.reasonLabel ? { reason } : undefined;
        const res = await api(path, { method, body: payload, idempotent: action.idempotent });
        toast.success(action.success ?? "Action effectuée");
        onDone(res);
      }}
    />
  );
}

/** Liste paginée + création + fiche + modification + suppression + actions métier, pilotées par configuration. */
export function ResourceView({ config, list: externalList, embedded = false }: { config: ResourceConfig; list?: UseList<Row>; embedded?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { canAny } = useAuth();
  const internalList = useList<Row>(externalList ? null : config.path, { pageSize: config.pageSize ?? 25 }, config.query ?? {});
  const list = externalList ?? internalList;
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [action, setAction] = useState<{ action: RowAction; row: Row } | null>(null);
  const allowed = (perms?: string[]) => !perms || canAny(...perms);

  const openRow = async (row: Row) => {
    if (config.href) {
      router.push(config.href(row));
      return;
    }
    setSelected(row);
    setEditing(false);
    if (config.detailPath) {
      try {
        setSelected(await api<Row>(config.detailPath(row)));
      } catch {
        /* la ligne de liste reste affichée */
      }
    }
  };

  const reloadSelected = async () => {
    void list.reload();
    if (selected && config.detailPath) {
      try {
        setSelected(await api<Row>(config.detailPath(selected)));
      } catch {
        setSelected(null);
      }
    }
  };

  const rowActions = (config.actions ?? []).filter((a) => allowed(a.perms));
  const header = (
    <PageTitle
      title={config.title}
      subtitle={config.subtitle}
      actions={
        <>
          {config.toolbar}
          {config.exportDataset ? (
            <Button variant="secondary" onClick={() => void download(`/reports/export/${config.exportDataset}`, `${config.exportDataset}.xlsx`, { format: "xlsx" }).catch((err) => toast.error("Export impossible", String(err)))}>
              Exporter
            </Button>
          ) : null}
          {config.create && allowed(config.create.perms) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> {config.create.label ?? "Nouveau"}
            </Button>
          ) : null}
        </>
      }
    />
  );

  return (
    <div>
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {config.subtitle ? <p className="text-sm text-muted">{config.subtitle}</p> : <span />}
          <div className="flex flex-wrap gap-2">
            {config.toolbar}
            {config.create && allowed(config.create.perms) ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> {config.create.label ?? "Nouveau"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        header
      )}
      <DataTable
        list={list}
        columns={config.columns}
        filters={config.filters}
        searchable={config.search !== false}
        onRowClick={(r) => void openRow(r)}
        empty={{ title: "Aucun élément", text: config.emptyText }}
        rowActions={
          rowActions.length
            ? (row) => (
                <div className="flex justify-end gap-1">
                  {rowActions
                    .filter((a) => !a.when || a.when(row))
                    .slice(0, 3)
                    .map((a) => (
                      <Button key={a.key} size="sm" variant={a.tone === "danger" ? "ghost" : "secondary"} onClick={() => (a.run ? a.run(row) : setAction({ action: a, row }))}>
                        {a.label}
                      </Button>
                    ))}
                </div>
              )
            : undefined
        }
      />

      {config.create ? (
        <Modal open={creating} onClose={() => setCreating(false)} title={config.create.label ?? `Nouveau — ${config.title}`} size="lg">
          <SchemaForm
            endpoint={config.create.endpoint}
            fields={config.create.fields}
            order={config.create.order}
            exclude={config.create.exclude}
            fixed={config.create.fixed}
            initial={config.create.initial}
            idempotent={config.create.idempotent}
            submitLabel="Créer"
            onCancel={() => setCreating(false)}
            onSuccess={(res: Row) => {
              setCreating(false);
              toast.success("Enregistré");
              void list.reload();
              if (res?.id && config.href) router.push(config.href(res));
            }}
          />
        </Modal>
      ) : null}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? String(selected.number ?? selected.code ?? selected.name ?? selected.title ?? selected.label ?? config.title) : ""}
        subtitle={selected?.status ? formatCell(selected.status, "status") : undefined}
        footer={
          selected ? (
            <>
              {config.remove && allowed(config.remove.perms) ? (
                <Button variant="ghost" onClick={() => setDeleting(selected)}>
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              ) : null}
              {rowActions
                .filter((a) => !a.when || a.when(selected))
                .map((a) => (
                  <Button key={a.key} variant={a.tone === "danger" ? "danger" : a.tone === "accent" ? "accent" : "secondary"} onClick={() => (a.run ? a.run(selected) : setAction({ action: a, row: selected }))}>
                    {a.label}
                  </Button>
                ))}
              {config.update && allowed(config.update.perms) && !editing ? (
                <Button onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          editing && config.update ? (
            <SchemaForm
              endpoint={config.update.endpoint}
              params={{ [paramName(config.update.endpoint) ?? "id"]: String(selected.id) }}
              initial={selected}
              partial
              fields={config.update.fields}
              order={config.update.order}
              exclude={config.update.exclude}
              onCancel={() => setEditing(false)}
              onSuccess={(res: Row) => {
                setEditing(false);
                setSelected(res && typeof res === "object" ? { ...selected, ...res } : selected);
                toast.success("Modifications enregistrées");
                void list.reload();
              }}
            />
          ) : config.detail ? (
            config.detail(selected, () => void reloadSelected())
          ) : (
            <RecordFields row={selected} fields={config.detailFields} />
          )
        ) : null}
      </Drawer>

      {deleting && config.remove ? (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Supprimer"
          text={config.remove.confirm ?? "Cet élément sera supprimé (action journalisée)."}
          tone="danger"
          confirmLabel="Supprimer"
          onConfirm={async () => {
            await api(config.remove!.path(deleting), { method: "DELETE" });
            setSelected(null);
            toast.success("Supprimé");
            void list.reload();
          }}
        />
      ) : null}

      {action ? (
        <ActionRunner
          action={action.action}
          row={action.row}
          onClose={() => setAction(null)}
          onDone={(res) => {
            setAction(null);
            void list.reload();
            if (selected) {
              if (res && typeof res === "object" && "id" in (res as Row)) setSelected({ ...selected, ...(res as Row) });
              else void reloadSelected();
            }
          }}
        />
      ) : null}
    </div>
  );
}

/** Lien de colonne vers une fiche. */
export function CellLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}
