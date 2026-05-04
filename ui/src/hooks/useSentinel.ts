import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bclClient } from '../api/client';
import { useAppStore } from '../store/appStore';

export function useSentinel() {
  const queryClient = useQueryClient();
  const { setTheme } = useAppStore();

  const statusQuery = useQuery({
    queryKey: ['sentinel-status'],
    queryFn: async () => {
      const { data } = await bclClient.get('/api/sentinel/status');
      return data;
    },
    refetchInterval: 5000,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      setTheme('sentinel');
      const { data } = await bclClient.post('/api/sentinel/scan');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sentinel-status'] });
    },
  });

  const healMutation = useMutation({
    mutationFn: async (id?: string) => {
      const url = id ? `/api/sentinel/heal/${id}` : '/api/sentinel/heal-all';
      const { data } = await bclClient.post(url);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sentinel-status'] });
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    scan: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    heal: healMutation.mutate,
    isHealing: healMutation.isPending,
  };
}
