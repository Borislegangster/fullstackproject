"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use } from "react";

import { PROJECT_TABS, ProjectWorkspace } from "@/components/erp/project-workspace";

function Inner({ id }: { id: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("onglet") ?? "synthese";
  const tab = PROJECT_TABS.some((t) => t.key === wanted) ? wanted : "synthese";
  return <ProjectWorkspace projectId={id} tab={tab} onTab={(t) => router.replace(`/erp/chantiers/${id}?onglet=${t}`, { scroll: false })} />;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Inner id={id} />
    </Suspense>
  );
}
