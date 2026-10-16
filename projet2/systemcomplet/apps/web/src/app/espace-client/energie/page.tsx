"use client";

import { Save, Send, Zap } from "lucide-react";
import { useState } from "react";

import { WithProject } from "@/components/client/client-project";
import { EnergySimulator, type EnergyInputs } from "@/components/innovations/energy-simulator";
import { Field, Input } from "@/components/ui/form";
import { Alert, Badge, Button, Card, CardHeader, PageTitle, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { date, money, number } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Study {
  id: string;
  title: string;
  status: string;
  created_at: string;
  results: { investment: number; savings_year: number; payback_years: number | null; after: { bill_month: number }; before: { bill_month: number } };
}

function EnergyContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const data = useApi<{ defaults: Partial<EnergyInputs>; studies: Study[] }>(`/client/projects/${projectId}/energy`);
  const [inputs, setInputs] = useState<EnergyInputs | null>(null);
  const [title, setTitle] = useState("Mon étude énergie & confort");
  if (data.loading && !data.data) return <Skeleton className="h-96 w-full" />;
  if (!data.data) return <Alert tone="danger">{data.error}</Alert>;
  const save = async () => {
    if (!inputs) return;
    try {
      await api(`/client/projects/${projectId}/energy/studies`, { body: { title, simulation: inputs } });
      toast.success("Étude enregistrée");
      void data.reload();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    }
  };
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Zap className="h-7 w-7 text-accent-500" /> Énergie & confort
          </span>
        }
        subtitle="Simulez isolation, protections solaires, climatisation inverter, solaire et batterie sur votre projet : facture, confort, autonomie."
      />
      <Card className="p-5">
        <EnergySimulator initial={{ ...data.data.defaults, measures: ["roof_insulation", "solar"] }} onResult={(i) => setInputs(i)}>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <Field label="Nom de l'étude" className="min-w-[14rem] flex-1">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Button variant="secondary" disabled={!inputs} onClick={() => void save()}>
              <Save className="h-4 w-4" /> Enregistrer
            </Button>
          </div>
        </EnergySimulator>
      </Card>
      {data.data.studies.length ? (
        <Card>
          <CardHeader title="Mes études" subtitle="« Intégrer à mon projet » : votre chef de projet vous adresse l'avenant chiffré à valider." />
          <ul className="divide-y divide-line">
            {data.data.studies.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{s.title}</span>{" "}
                  <Badge tone={s.status === "draft" ? "neutral" : "accent"}>{s.status === "draft" ? "Brouillon" : "Demandée"}</Badge>
                  <span className="block text-xs text-muted">
                    {date(s.created_at)} · {money(s.results.before.bill_month)} → {money(s.results.after.bill_month)} / mois · investissement{" "}
                    {money(s.results.investment)}
                    {s.results.payback_years ? ` · retour ${number(s.results.payback_years, 1)} ans` : ""}
                  </span>
                </span>
                {s.status === "draft" ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await api(`/client/energy/studies/${s.id}/request`, { method: "POST" });
                        toast.success("Demande transmise à votre chef de projet");
                        void data.reload();
                      } catch (err) {
                        toast.error("Envoi impossible", errorMessage(err));
                      }
                    }}
                  >
                    <Send className="h-4 w-4" /> Intégrer à mon projet
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export default function ClientEnergyPage() {
  return <WithProject>{(p) => <EnergyContent projectId={p.id} />}</WithProject>;
}
