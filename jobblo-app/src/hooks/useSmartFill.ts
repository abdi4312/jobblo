import { useMutation } from '@tanstack/react-query';
import { generateFullJobListing, analyzeJobImage } from '../services/ai.service';

export function useSmartFillMutation() {
  return useMutation({
    mutationFn: ({ prompt, context }: Parameters<typeof generateFullJobListing>[0] extends never ? never : { prompt: string; context: Parameters<typeof generateFullJobListing>[1] }) => generateFullJobListing(prompt, context),
  });
}

export function useAnalyzeImageMutation() {
  return useMutation({
    mutationFn: ({ uri, name, type }: { uri: string; name: string; type: string }) =>
      analyzeJobImage(uri, name, type),
  });
}
