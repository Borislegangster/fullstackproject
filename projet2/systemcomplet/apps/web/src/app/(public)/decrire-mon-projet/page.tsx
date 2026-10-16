import type { Metadata } from "next";

import { DescribeProjectWizard } from "@/components/site/describe-wizard";
import { CmsPageView, PageHeader } from "@/components/site/page-view";
import { getPage, listingMetadata } from "@/lib/cms";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata("describe-project", "Décrire mon projet", "/decrire-mon-projet");
}

/** Questionnaire prospect (§4.4) : la page éditoriale vient du CMS ; le questionnaire reste disponible en toutes circonstances. */
export default async function DescribeProjectPage() {
  const page = await getPage("describe-project");
  const hasForm = page?.sections.some((s) => s.blocks.some((b) => b.kind === "form" && b.form_key === "describe_project"));
  if (page && hasForm) return <CmsPageView page={page} />;
  const wizard = (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page max-w-3xl">
        <DescribeProjectWizard />
      </div>
    </section>
  );
  if (page) return <CmsPageView page={page} after={wizard} />;
  return (
    <>
      <PageHeader title="Décrire mon projet" crumbs={[{ name: "Accueil", path: "/" }, { name: "Décrire mon projet", path: "/decrire-mon-projet" }]} />
      {wizard}
    </>
  );
}
