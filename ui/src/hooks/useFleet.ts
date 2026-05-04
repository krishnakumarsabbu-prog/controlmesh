import { useQuery } from '@tanstack/react-query';
import { fetchFleet } from '../api/fleet';
import { useAppStore } from '../store/appStore';
import { useEffect } from 'react';

export function useFleet() {
  const setFleet = useAppStore((s) => s.setFleet);

  const query = useQuery({
    queryKey: ['fleet'],
    queryFn: fetchFleet,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (query.data) setFleet(query.data);
  }, [query.data, setFleet]);

  return query;
}
