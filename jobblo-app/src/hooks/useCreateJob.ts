import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createJob, updateJob, type CreateJobFormValues, type CreateJobImage } from '../services/createJob.service';
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

export function useUpdateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, values, images, imagesToDelete }: { serviceId: string; values: CreateJobFormValues; images: CreateJobImage[]; imagesToDelete: string[] }) => updateJob(serviceId, values, images, imagesToDelete),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.mine }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(variables.serviceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.infinite() }),
      ]);
    },
  });
}
