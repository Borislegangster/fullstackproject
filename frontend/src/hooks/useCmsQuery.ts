import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
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

/**
 * Wrapper around useMutation that automatically shows a success / error toast.
 * Use for CMS write operations from the public site (contact form, newsletter…).
 */
export function useCmsMutation<TData, TVariables>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'> & {
    successMessage?: string;
  }
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn,
    ...options,
    onSuccess: (...args) => {
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      (options?.onSuccess as any)?.(...args);
    },
    onError: (...args) => {
      const err = args[0];
      toast.error(err?.message || "Une erreur est survenue.");
      (options?.onError as any)?.(...args);
    },
  });
}