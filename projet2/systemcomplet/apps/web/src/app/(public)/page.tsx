import type { Metadata } from "next";

import { CmsPageView, EmptyPublicState } from "@/components/site/page-view";
import { getPage } from "@/lib/cms";
import { buildMetadata, getSite } from "@/lib/seo";

function getHome() {
  return getPage("home");
}

export async function generateMetadata(): Promise<Metadata> {
  const [site, page] = await Promise.all([getSite(), getHome()]);
  return buildMetadata({ site, seo: page?.seo, title: page?.title ?? site?.company_name ?? "Accueil", description: page?.summary, path: "/" });
}

export default async function HomePage() {
  const page = await getHome();
  if (!page) return <EmptyPublicState title="Site en cours de publication" text="Les contenus de la page d'accueil n'ont pas encore été publiés depuis l'ERP (CMS)." standalone />;
  return <CmsPageView page={page} />;
}
