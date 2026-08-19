import { useMutation } from '@tanstack/react-query';
import { generateFullJobListing } from '../services/ai.service';

export function useSmartFillMutation() {
  return useMutation({
    mutationFn: ({ prompt, context }: Parameters<typeof generateFullJobListing>[0] extends never ? never : { prompt: string; context: Parameters<typeof generateFullJobListing>[1] }) => generateFullJobListing(prompt, context),
  });
}
