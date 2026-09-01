import { useQuery } from '@tanstack/react-query';
import { getMyPostedServices, deleteService, updateService } from './api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import type { ServiceUpdateData } from './types';

export const useMyServices = () => {
  return useQuery({
    queryKey: ['my-services'],
    queryFn: getMyPostedServices,
  });
};

/**
 * The message the server actually sent, or a plain fallback.
 *
 * The service endpoints answer with `{ error }`; some other controllers use
 * `{ message }`. Reading only one of them is why a 409 explaining that a listing has
 * money in SafePay escrow arrived at the user as "Kunne ikke slette annonse".
 *
 * Anything that is not a readable string — an HTML error page, a validation object, a
 * bare status — falls back, so a raw backend payload is never rendered as a toast.
 */
const listingErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response
    ?.data;

  for (const candidate of [data?.error, data?.message]) {
    if (typeof candidate === 'string' && candidate.trim() && candidate.length < 300) {
      return candidate;
    }
  }
  return fallback;
};

export const useServiceActions = () => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobDetail', serviceId] });
      toast.success('Annonse slettet!');
    },
    onError: (error: unknown) => {
      // The server answers 409 with a finished Norwegian sentence in `error` when the
      // listing is tied to a contract, an escrowed payment, live work or a dispute.
      // This used to read only `data.message` — a key the service endpoints never send
      // — so every refusal collapsed to the generic fallback and the person was told
      // "Kunne ikke slette annonse" with no reason and nothing to act on.
      toast.error(listingErrorMessage(error, 'Kunne ikke slette annonsen'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceUpdateData }) => updateService(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobDetail', variables.id] });
      toast.success('Oppdrag oppdatert!');
    },
    onError: (error: unknown) => {
      toast.error(listingErrorMessage(error, 'Kunne ikke oppdatere annonsen'));
    },
  });

  return { deleteMutation, updateMutation };
};
