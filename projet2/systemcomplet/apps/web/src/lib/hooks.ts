"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, errorMessage, type Page } from "./api";

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface Loadable<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T | undefined | ((prev: T | undefined) => T | undefined)) => void;
}

/** Chargement d'une ressource GET avec états explicites (chargement, erreur, rechargement). */
export function useApi<T = any>(path: string | null, query?: Query, deps: unknown[] = []): Loadable<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const queryKey = JSON.stringify(query ?? {});
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(path, { query: JSON.parse(queryKey) as Query, signal: ctrl.signal });
      if (!ctrl.signal.aborted) setData(result);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (!ctrl.signal.aborted) setError(errorMessage(err));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, ...deps]);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export interface ListState {
  page: number;
  pageSize: number;
  sort?: string;
  q: string;
  filters: Record<string, string>;
}

export interface UseList<T> extends Loadable<Page<T>> {
  state: ListState;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort?: string) => void;
  setQ: (q: string) => void;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  items: T[];
  total: number;
}

/** Liste paginée côté serveur (page, tri, recherche, filtres) conforme au format Page<T> de l'API. */
export function useList<T = any>(
  path: string | null,
  init: Partial<ListState> = {},
  extraQuery: Query = {},
): UseList<T> {
  const [state, setState] = useState<ListState>({
    page: init.page ?? 1,
    pageSize: init.pageSize ?? 25,
    sort: init.sort,
    q: init.q ?? "",
    filters: init.filters ?? {},
  });
  const debouncedQ = useDebounce(state.q, 300);
  const query = useMemo<Query>(
    () => ({
      ...extraQuery,
      ...state.filters,
      page: state.page,
      page_size: state.pageSize,
      sort: state.sort,
      q: debouncedQ || undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(extraQuery), JSON.stringify(state.filters), state.page, state.pageSize, state.sort, debouncedQ],
  );
  const loadable = useApi<Page<T> | T[]>(path, query);
  // Certains points d'API renvoient une liste simple : normalisation au format Page<T>.
  const page: Page<T> | undefined = Array.isArray(loadable.data)
    ? { items: loadable.data, total: loadable.data.length, page: 1, page_size: loadable.data.length || 1 }
    : loadable.data;
  return {
    ...loadable,
    data: page,
    setData: loadable.setData as Loadable<Page<T>>["setData"],
    state,
    items: page?.items ?? [],
    total: page?.total ?? 0,
    setPage: (page) => setState((s) => ({ ...s, page })),
    setPageSize: (pageSize) => setState((s) => ({ ...s, pageSize, page: 1 })),
    setSort: (sort) => setState((s) => ({ ...s, sort, page: 1 })),
    setQ: (q) => setState((s) => ({ ...s, q, page: 1 })),
    setFilter: (key, value) =>
      setState((s) => {
        const filters = { ...s.filters };
        if (value === "" || value === undefined) delete filters[key];
        else filters[key] = value;
        return { ...s, filters, page: 1 };
      }),
    resetFilters: () => setState((s) => ({ ...s, filters: init.filters ?? {}, q: "", page: 1 })),
  };
}

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Exécution d'une action (POST/PATCH…) avec état d'envoi et message d'erreur. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, setError };
}

export function useInterval(callback: () => void, ms: number | null): void {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
