import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllMigrations, executeMigration, rollbackMigration } from '../api/migration';
import { useAppStore } from '../store/appStore';
import { useEffect } from 'react';

export function useMigrations() {
  const { migrations, setMigrations } = useAppStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['migrations'],
    queryFn: fetchAllMigrations,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (query.data) setMigrations(query.data);
  }, [query.data, setMigrations]);

  const triggerMutation = useMutation({
    mutationFn: ({ appId, sourceQm, targetQm }: { appId: string; sourceQm: string; targetQm: string }) =>
      executeMigration(appId, sourceQm, targetQm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migrations'] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (appId: string) => rollbackMigration(appId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migrations'] }),
  });

  return {
    migrations,
    isLoading: triggerMutation.isPending || rollbackMutation.isPending,
    triggerMigration: (appId: string, sourceQm: string, targetQm: string) =>
      triggerMutation.mutate({ appId, sourceQm, targetQm }),
    rollbackApp: (appId: string) => rollbackMutation.mutate(appId),
    error: query.error,
  };
}
