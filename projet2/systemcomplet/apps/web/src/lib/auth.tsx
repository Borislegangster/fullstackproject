"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "./api";

export interface Me {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string | null;
  whatsapp?: string | null;
  job_title?: string | null;
  trade?: string | null;
  disciplines?: string[];
  locale: string;
  timezone: string;
  roles: string[];
  permissions: string[];
  organization?: { id: string; name: string; kind: string } | null;
  mfa_enabled: boolean;
  mfa_required: boolean;
  preferences: Record<string, unknown>;
  spaces: string[];
  /** Modules optionnels activés par l'administration (ex. « referrals » : parrainage). */
  features?: string[];
  avatar_url?: string | null;
  email_verified: boolean;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  can: (...perms: string[]) => boolean;
  canAny: (...perms: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
  reload: () => Promise<Me | null>;
  logout: () => Promise<void>;
  setUser: (user: Me | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function homeFor(user: Me): string {
  if (user.spaces.includes("erp")) return "/erp";
  if (user.spaces.includes("client")) return "/espace-client";
  if (user.spaces.includes("extranet_subcontractor")) return "/extranet/consultations";
  if (user.spaces.includes("extranet_supplier")) return "/extranet/commandes";
  return "/";
}

/** Page « mon compte » (MFA, sessions, préférences) de l'espace principal de l'utilisateur. */
export function accountPathFor(user: Me): string {
  if (user.spaces.includes("erp")) return "/erp/compte";
  if (user.spaces.includes("client")) return "/espace-client/compte";
  if (user.spaces.some((s) => s.startsWith("extranet"))) return "/extranet/compte";
  return "/connexion";
}

/** Destination de retour après connexion : uniquement un chemin interne (pas de redirection ouverte). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/connexion") || next.startsWith("/inscription") || next.startsWith("/activation")) return null;
  return next;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const reload = useCallback(async () => {
    try {
      const me = await api<Me>("/auth/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      if (pathname && !pathname.startsWith("/connexion")) router.replace(`/connexion?suite=${encodeURIComponent(pathname)}`);
    };
    const onMfaRequired = () => {
      if (!user) return;
      const target = accountPathFor(user);
      if (pathname !== target) router.replace(`${target}?mfa=obligatoire`);
    };
    window.addEventListener("globus:unauthorized", onUnauthorized);
    window.addEventListener("globus:mfa-required", onMfaRequired);
    return () => {
      window.removeEventListener("globus:unauthorized", onUnauthorized);
      window.removeEventListener("globus:mfa-required", onMfaRequired);
    };
  }, [pathname, router, user]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* session déjà expirée */
    } finally {
      setUser(null);
      router.replace("/connexion");
    }
  }, [router]);

  const value = useMemo<AuthState>(() => {
    const perms = new Set(user?.permissions ?? []);
    return {
      user,
      loading,
      can: (...p) => p.every((x) => perms.has(x)),
      canAny: (...p) => p.some((x) => perms.has(x)),
      hasRole: (...r) => r.some((x) => user?.roles.includes(x)),
      reload,
      logout,
      setUser,
    };
  }, [user, loading, reload, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}

/** Garde d'espace : redirige vers la connexion ou vers l'espace autorisé de l'utilisateur. */
export function useSpaceGuard(spaces: string | string[]): { ready: boolean; user: Me | null } {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const wanted = Array.isArray(spaces) ? spaces : [spaces];
  const allowed = !!user && user.spaces.some((s) => wanted.includes(s));
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/connexion?suite=${encodeURIComponent(pathname ?? "/")}`);
    else if (!allowed) router.replace(homeFor(user));
  }, [loading, user, allowed, router, pathname]);
  return { ready: !loading && allowed, user };
}
