import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/**
 * Wrapper around useQuery that automatically shows an error toast on failure.
 * Use this for all CMS data fetching in the Site Vitrine.
 */
export function useCmsQuery<T>(
key: string | string[],
fetcher: () => Promise<T>,
options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>)
{
  return useQuery<T, Error>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: fetcher,
    ...options,
    meta: {
      ...options?.meta,
      onError: (error: Error) => {
        toast.error(
          error.message || 'Une erreur est survenue lors du chargement.'
        );
      }
    }
  });
}