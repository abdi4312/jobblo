import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  createCampaign,
  deleteCampaign,
  fetchCampaignAnalytics,
  fetchCampaignDefaults,
  fetchCampaigns,
  updateCampaign,
  type Campaign,
} from '../../api/admin/campaigns';

export const useCampaigns = () =>
  useQuery({ queryKey: ['admin', 'campaigns'], queryFn: fetchCampaigns });

export const useCampaignDefaults = () =>
  useQuery({ queryKey: ['admin', 'campaigns', 'defaults'], queryFn: fetchCampaignDefaults });

export const useCampaignAnalytics = (campaignId?: string) =>
  useQuery({
    queryKey: ['admin', 'campaigns', campaignId, 'analytics'],
    queryFn: () => fetchCampaignAnalytics(campaignId!),
    enabled: Boolean(campaignId),
  });

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaign: Omit<Campaign, '_id'>) => createCampaign(campaign),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
    onError: () => toast.error('Kunne ikke opprette kampanjen.'),
  });
};

export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaign: Campaign) => updateCampaign(campaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      toast.success('Kampanjen er lagret.');
    },
    onError: () => toast.error('Kunne ikke lagre kampanjen. Kontroller datoer og kampanjeoverlapp.'),
  });
};

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      queryClient.removeQueries({ queryKey: ['admin', 'campaigns', campaignId, 'analytics'] });
      toast.success('Kampanjen er slettet. Analysehistorikken er bevart.');
    },
    onError: () => toast.error('Kunne ikke slette kampanjen.'),
  });
};
