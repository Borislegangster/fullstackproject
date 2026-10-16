import type { Metadata } from "next";

import { CmsPageView, EmptyPublicState } from "@/components/site/page-view";
import type { PagePayload } from "@/lib/cms-types";
import { buildMetadata, getSite } from "@/lib/seo";
import { publicGetOrNull } from "@/lib/server-api";

async function getHome() {
  try {
    return await publicGetOrNull<PagePayload>("/public/pages/home");
  } catch {
    return null;
  }
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
