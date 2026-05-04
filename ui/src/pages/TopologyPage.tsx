import { useState } from 'react';
import { Network, ArrowRight } from 'lucide-react';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import { useFleet } from '../hooks/useFleet';
import { useMigrations } from '../hooks/useMigrations';
import LoadingSpinner from '../components/shared/LoadingSpinner';

type ViewMode = 'split' | 'source' | 'target';

export default function TopologyPage() {
  const [view, setView] = useState<ViewMode>('split');
  const { data: fleet, isLoading } = useFleet();
  const { migrations } = useMigrations();

  const sourceQMs = fleet?.queue_managers.filter((q) => q.role === 'source') ?? [];
  const targetQMs = fleet?.queue_managers.filter((q) => q.role === 'target') ?? [];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Topology View</h1>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <LoadingSpinner size="sm" />}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['split', 'source', 'target'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  view === v
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas area */}
      {view === 'split' ? (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Source */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 px-1 shrink-0">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Source Topology
              </span>
              <span className="text-xs text-slate-400">{sourceQMs.length} shared QMs</span>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <TopologyCanvas queueManagers={sourceQMs} migrations={migrations} mode="source" />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center self-center shrink-0">
            <div className="flex flex-col items-center gap-1 text-slate-300">
              <ArrowRight className="w-6 h-6" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">migrate</span>
            </div>
          </div>

          {/* Target */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 px-1 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Target Topology
              </span>
              <span className="text-xs text-slate-400">{targetQMs.length} dedicated QMs</span>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <TopologyCanvas queueManagers={targetQMs} migrations={migrations} mode="target" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex items-center gap-2 px-1 shrink-0">
            <span className={`w-2 h-2 rounded-full ${view === 'source' ? 'bg-slate-400' : 'bg-emerald-400'}`} />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {view === 'source' ? 'Source Topology' : 'Target Topology'}
            </span>
          </div>
          <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            <TopologyCanvas
              queueManagers={view === 'source' ? sourceQMs : targetQMs}
              migrations={migrations}
              mode={view as 'source' | 'target'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
