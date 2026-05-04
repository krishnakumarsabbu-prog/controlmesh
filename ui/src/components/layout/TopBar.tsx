import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';
import { useFleet } from '../../hooks/useFleet';

interface TopBarProps {
  pageTitle?: string;
}

export default function TopBar({ pageTitle }: TopBarProps) {
  const [now, setNow] = useState(new Date());
  const { data: fleet } = useFleet();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const qms = fleet?.queue_managers ?? [];
  const sourceCount = qms.filter((q) => q.role === 'source').length;
  const targetCount = qms.filter((q) => q.role === 'target').length;

  return (
    <header className="h-13 flex items-center justify-between px-6 py-3 border-b border-surface-border bg-surface-raised shrink-0">
      <div className="flex items-center gap-3">
        {pageTitle && (
          <h2 className="text-sm font-semibold text-text-primary">{pageTitle}</h2>
        )}
        <div className="h-4 w-px bg-surface-border" />
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>
            <span className="font-medium text-text-secondary">{sourceCount}</span> source QMs
          </span>
          <span className="text-surface-muted">|</span>
          <span>
            <span className="font-medium text-text-secondary">{targetCount}</span> target QMs
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-accent-emerald">
          <Activity className="w-3.5 h-3.5" />
          <span className="font-medium">Live</span>
        </div>
        <div className="h-4 w-px bg-surface-border" />
        <div className="text-xs text-text-muted font-mono tabular-nums">
          {format(now, 'yyyy-MM-dd HH:mm:ss')}
        </div>
      </div>
    </header>
  );
}
