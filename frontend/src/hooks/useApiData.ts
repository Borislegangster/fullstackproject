/**
 * useApiData — Hook that tries to load real data from the API
 * and falls back to the provided mock data if the API is not configured
 * or the request fails.
 *
 * This allows a gradual migration from mock-based pages to real API data
 * without breaking anything.
 */
import { useQuery } from '@tanstack/react-query';
import { isApiConfigured } from '../services/api/axiosClient';

interface UseApiDataOptions<T> {
  /** Unique query key for React Query cache */
  queryKey: string[];
  /** API function to call */
  apiFn: () => Promise<T>;
  /** Static/mock data to use as fallback */
  fallback: T;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Returns real data from the API when the backend is reachable,
 * or falls back to mock data seamlessly.
 */
export function useApiData<T>({ queryKey, apiFn, fallback, enabled = true }: UseApiDataOptions<T>) {
  const apiReady = isApiConfigured();

  const query = useQuery({
    queryKey,
    queryFn: apiFn,
    enabled: apiReady && enabled,
    retry: 1,
    staleTime: 30_000,
  });

  return {
    data: apiReady && query.data ? query.data : fallback,
    isLoading: apiReady ? query.isLoading : false,
    isError: apiReady ? query.isError : false,
    error: query.error,
    refetch: query.refetch,
    isLive: apiReady && !!query.data, // true when using real data
  };
}
