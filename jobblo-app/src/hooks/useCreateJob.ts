import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createJob, type CreateJobFormValues, type CreateJobImage } from '../services/createJob.service';
import { queryKeys } from '../queryKeys';

export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ values, images }: { values: CreateJobFormValues; images: CreateJobImage[] }) => createJob(values, images),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.infinite() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview }),
      ]);
    },
  });
}
