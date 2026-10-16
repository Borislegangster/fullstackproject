import { Eye } from "lucide-react";
import { cookies, draftMode } from "next/headers";
import type { ReactNode } from "react";

import { CookieBanner } from "@/components/site/cookie-banner";
import { FloatingWidgets } from "@/components/site/floating-widgets";
import { ScrollProgress } from "@/components/site/fx";
import { GlobusLoader } from "@/components/site/globus-loader";
import { SiteBanners } from "@/components/site/site-banners";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteTracking } from "@/components/site/site-tracking";
import { BRAND_ICON_FALLBACK } from "@/lib/brand";
import { PREVIEW_COOKIE } from "@/lib/preview";
import { getSite, JsonLd, organizationLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const site = await getSite();
  const policyVersion = site?.consent?.policy_version ?? "1";
  // Aperçu depuis l'ERP : contenu non publié, aucune mesure d'audience ni bandeau de consentement.
  const preview = (await draftMode()).isEnabled && !!(await cookies()).get(PREVIEW_COOKIE);
  return (
    <>
      {preview ? (
        <div className="fixed inset-x-0 bottom-0 z-[90] flex flex-wrap items-center justify-center gap-3 bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-2xl">
          <Eye className="h-4 w-4" /> Mode aperçu : ce contenu n&apos;est peut-être pas encore publié.
          {/* Gestionnaire de route (redirection serveur) : navigation complète requise. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/apercu/sortie" className="rounded-full bg-white/20 px-3 py-0.5 underline-offset-2 hover:bg-white/30">
            Quitter l&apos;aperçu
          </a>
        </div>
      ) : (
        <GlobusLoader companyName={site?.company_name ?? "GLOBUS ENGINEERING"} />
      )}
      <ScrollProgress />
      <JsonLd data={organizationLd(site)} />
      <SiteHeader items={site?.menus?.header?.items ?? []} logo={site?.logo} companyName={site?.company_name ?? "GLOBUS ENGINEERING"} phone={site?.contacts?.phone} />
      <main id="contenu" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter site={site} />
      {preview ? null : <FloatingWidgets contacts={site?.contacts} privacyPath={site?.pages?.privacy} iconUrl={site?.brand?.sizes?.["192"] ?? BRAND_ICON_FALLBACK} />}
      <SiteBanners banners={site?.banners ?? []} pages={site?.pages ?? {}} />
      {preview ? null : (
        <>
          <CookieBanner texts={site?.consent?.texts} policyVersion={policyVersion} cookiesPath={site?.pages?.cookies} />
          <SiteTracking tracking={site?.tracking ?? {}} policyVersion={policyVersion} />
        </>
      )}
    </>
  );
}
