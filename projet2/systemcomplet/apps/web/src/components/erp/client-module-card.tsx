"use client";

import { Power, PowerOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/ui/overlay";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Module optionnel de l'espace client (désactivé par défaut) : état, explication et bascule réservée à
 * l'administration (permission settings:write). Le menu client correspondant n'apparaît qu'une fois ouvert.
 */
export function ClientModuleCard({
  name,
  enabled,
  endpoint,
  field,
  onChange,
  openText,
  closedText,
  children,
}: {
  name: string;
  enabled: boolean;
  endpoint: string;
  field: string;
  onChange: () => void;
  openText: string;
  closedText: string;
  children?: ReactNode;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {enabled ? <Power className="h-5 w-5 text-emerald-600" /> : <PowerOff className="h-5 w-5 text-muted" />}
          Module client « {name} » {enabled ? "ouvert" : "fermé"}
          <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Visible des clients" : "Masqué des clients"}</Badge>
        </p>
        <p className="text-sm text-muted">{enabled ? openText : closedText}</p>
        {children}
      </div>
      {can("settings:write") ? (
        <Button variant={enabled ? "danger" : "accent"} onClick={() => setConfirm(true)}>
          {enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />} {enabled ? "Fermer aux clients" : "Ouvrir aux clients"}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={enabled ? `Fermer « ${name} » aux clients` : `Ouvrir « ${name} » aux clients`}
        text={enabled ? `Le menu « ${name} » disparaît de l'espace client. Les dossiers déjà engagés restent consultables par leurs titulaires.` : `Le menu « ${name} » devient visible pour tous les clients.`}
        tone={enabled ? "danger" : "accent"}
        confirmLabel={enabled ? "Fermer" : "Ouvrir"}
        onConfirm={async () => {
          try {
            await api(endpoint, { method: "PUT", body: { [field]: !enabled } });
            toast.success(enabled ? `« ${name} » fermé aux clients` : `« ${name} » ouvert aux clients`);
            onChange();
          } catch (err) {
            toast.error("Modification impossible", errorMessage(err));
          }
        }}
      />
    </Card>
  );
}
