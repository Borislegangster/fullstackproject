"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { CollectionsHub } from "@/components/cms/collections";
import { PagesList } from "@/components/cms/page-editor";
import { CommentsModeration, FormsAdmin, NavigationEditor, SiteSettingsEditor } from "@/components/cms/site-admin";
import { Tabs } from "@/components/ui/overlay";
import { PageTitle } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

/** Back-office du site public : toutes les données éditoriales sont pilotées ici (Zero Hardcode). */
export function CmsHub() {
  const { can } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "pages";
  return (
    <div className="space-y-5">
      <PageTitle title="Contenus du site (CMS)" subtitle="Pages composées de blocs, collections (univers, offres, réalisations, blog…), navigation, formulaires — circuit brouillon → relecture → publication." />
      <Tabs
        value={tab}
        onChange={(t) => router.replace(`/erp/cms?onglet=${t}`, { scroll: false })}
        tabs={[
          { key: "pages", label: "Pages" },
          { key: "collections", label: "Collections" },
          { key: "navigation", label: "Navigation" },
          { key: "formulaires", label: "Formulaires" },
          { key: "commentaires", label: "Commentaires" },
          { key: "reglages", label: "Réglages du site", hidden: !can("cms:read") },
        ]}
      />
      {tab === "pages" ? <PagesList /> : null}
      {tab === "collections" ? <CollectionsHub /> : null}
      {tab === "navigation" ? <NavigationEditor /> : null}
      {tab === "formulaires" ? <FormsAdmin /> : null}
      {tab === "commentaires" ? <CommentsModeration /> : null}
      {tab === "reglages" ? <SiteSettingsEditor /> : null}
    </div>
  );
}
