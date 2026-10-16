"use client";

import { Building2 } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export interface ClientProject {
  id: string;
  code: string;
  name: string;
  status: string;
  health?: string | null;
  progress_pct?: string | number | null;
  city?: string | null;
  universe?: string | null;
  start_planned?: string | null;
  end_planned?: string | null;
}

interface ClientProjectState {
  projects: ClientProject[] | null;
  project: ClientProject | null;
  setProjectId: (id: string) => void;
}

const Ctx = createContext<ClientProjectState | null>(null);
const KEY = "globus_client_project";

/** Projet courant de l'espace client (sélecteur multi-projets, mémorisé sur l'appareil). */
export function ClientProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ClientProject[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !user.spaces.includes("client")) return;
    api<ClientProject[]>("/client/projects")
      .then((list) => {
        setProjects(list);
        const stored = localStorage.getItem(KEY);
        setProjectId(list.find((p) => p.id === stored)?.id ?? list[0]?.id ?? null);
      })
      .catch(() => setProjects([]));
  }, [user]);

  const value = useMemo<ClientProjectState>(
    () => ({
      projects,
      project: projects?.find((p) => p.id === projectId) ?? null,
      setProjectId: (id) => {
        localStorage.setItem(KEY, id);
        setProjectId(id);
      },
    }),
    [projects, projectId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientProject(): ClientProjectState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClientProject hors ClientProjectProvider");
  return ctx;
}

export function ProjectSwitcher() {
  const { projects, project, setProjectId } = useClientProject();
  if (!projects?.length) return null;
  if (projects.length === 1)
    return (
      <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
        <Building2 className="h-4 w-4 shrink-0 text-brand-500" /> {project?.name}
      </p>
    );
  return (
    <label className="flex max-w-sm items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-brand-500" />
      <span className="sr-only">Projet</span>
      <select value={project?.id ?? ""} onChange={(e) => setProjectId(e.target.value)} className="w-full truncate rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Rend `children(projet)` une fois le projet courant connu, avec états vides explicites. */
export function WithProject({ children }: { children: (project: ClientProject) => ReactNode }) {
  const { projects, project } = useClientProject();
  if (projects === null)
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (!project)
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Aucun projet rattaché à votre compte"
        text="Dès la signature de votre contrat, votre chef de projet ouvre votre espace projet : suivi du chantier, finances, documents et décisions."
      />
    );
  return <>{children(project)}</>;
}
