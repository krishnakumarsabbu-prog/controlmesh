import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import { IS_MOCK } from '../api/client';
import { mockApi } from '../api/mock/service';
import type { MigrationRecord } from '../types';

export function useMigrationStream() {
  const queryClient = useQueryClient();
  const { setMigration, setSseConnected } = useAppStore();
  const esRef = useRef<EventSource | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (IS_MOCK) {
      setSseConnected(true);
      const unsubscribe = mockApi.subscribeSSE((record: MigrationRecord) => {
        setMigration(record);
        queryClient.invalidateQueries({ queryKey: ['migrations'] });
      });
      unsubRef.current = unsubscribe;
      return () => {
        unsubRef.current?.();
        setSseConnected(false);
      };
    }

    const connect = () => {
      if (esRef.current) esRef.current.close();

      const es = new EventSource('/api/migration/stream');
      esRef.current = es;

      es.onopen = () => setSseConnected(true);

      es.onmessage = (event) => {
        try {
          const data: MigrationRecord = JSON.parse(event.data);
          if (data.app_id) {
            setMigration(data);
            queryClient.invalidateQueries({ queryKey: ['migrations'] });
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        esRef.current = null;
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      setSseConnected(false);
    };
  }, [queryClient, setMigration, setSseConnected]);
}
