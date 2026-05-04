import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import type { MigrationRecord } from '../types';

export function useMigrationStream() {
  const queryClient = useQueryClient();
  const { setMigration, setSseConnected } = useAppStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
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
        // Reconnect after 3s
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
