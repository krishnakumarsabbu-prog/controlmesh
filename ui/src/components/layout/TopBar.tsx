import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useFleet } from '../../hooks/useFleet';

export default function TopBar() {
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
    <header className="h-12 flex items-center justify-between px-6 border-b border-slate-200 bg-white shrink-0">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>
          <span className="font-medium text-slate-700">{sourceCount}</span> source QMs
        </span>
        <span className="text-slate-200">|</span>
        <span>
          <span className="font-medium text-slate-700">{targetCount}</span> target QMs
        </span>
      </div>
      <div className="text-xs text-slate-400 font-mono tabular-nums">
        {format(now, 'yyyy-MM-dd HH:mm:ss')}
      </div>
    </header>
  );
}
