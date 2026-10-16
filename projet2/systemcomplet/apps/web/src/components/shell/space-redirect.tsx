"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { resolveLink } from "@/components/shell/notification-bell";
import { Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { homeFor, type Me } from "@/lib/auth";

/** Lien générique (e-mail, push) → route équivalente dans l'espace de l'utilisateur connecté. */
export function SpaceRedirect({ path }: { path: string }) {
  const router = useRouter();
  useEffect(() => {
    api<Me>("/auth/me")
      .then((me) => {
        const home = homeFor(me);
        const base = home.startsWith("/erp") ? "/erp" : home.startsWith("/espace-client") ? "/espace-client" : "/extranet";
        router.replace(resolveLink(path, base) ?? home);
      })
      .catch(() => router.replace(`/connexion?suite=${encodeURIComponent(path)}`));
  }, [path, router]);
  return (
    <div className="mx-auto mt-24 w-full max-w-md space-y-3 p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
