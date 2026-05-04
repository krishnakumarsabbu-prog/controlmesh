import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network, ArrowRight, DatabaseZap, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import { useFleet } from '../hooks/useFleet';
import { useMigrations } from '../hooks/useMigrations';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { provisionTopology, fetchTargetTopology, fetchQueueDetails, fetchActiveChannels } from '../api/fleet';
import type { QueueManagerFleet, TopologyChannel } from '../types';
import type { QueueEntry } from '../components/topology/QMNode';

type ViewMode = 'split' | 'source' | 'target';
type ProvisionState = 'idle' | 'loading' | 'success' | 'error';

export default function TopologyPage() {
  const [view, setView] = useState<ViewMode>('split');
  const [provisionState, setProvisionState] = useState<ProvisionState>('idle');
  const [provisionMessage, setProvisionMessage] = useState<string>('');
  const { data: fleet, isLoading, refetch: refetchFleet } = useFleet();
  const { migrations } = useMigrations();

  const sourceQMs = fleet?.queue_managers.filter((q) => q.role === 'source') ?? [];

  const { data: targetTopology, isLoading: targetLoading } = useQuery({
    queryKey: ['topology-target'],
    queryFn: fetchTargetTopology,
    staleTime: 60_000,
  });

  // Fetch queue details for source QMs (these change during rewiring)
  const { data: sourceQueueDetails } = useQuery({
    queryKey: ['queue-details-source', sourceQMs.map((q) => q.name), migrations],
    queryFn: async () => {
      const results: Record<string, QueueEntry[]> = {};
      for (const qm of sourceQMs) {
        results[qm.name] = await fetchQueueDetails(qm.name);
      }
      return results;
    },
    enabled: sourceQMs.length > 0,
    refetchInterval: 4000,
  });

  // Fetch queue details for target QMs
  const targetQMs: QueueManagerFleet[] = (targetTopology?.queue_managers ?? []).map((qm) => ({
    name: qm.name,
    internal_name: qm.name.toLowerCase(),
    svc_url: '',
    role: 'target' as const,
    status: 'unknown' as const,
  }));

  const { data: targetQueueDetails } = useQuery({
    queryKey: ['queue-details-target', targetQMs.map((q) => q.name)],
    queryFn: async () => {
      const results: Record<string, QueueEntry[]> = {};
      for (const qm of targetQMs) {
        results[qm.name] = await fetchQueueDetails(qm.name);
      }
      return results;
    },
    enabled: targetQMs.length > 0,
    staleTime: 30_000,
  });

  // Fetch active channels for rewiring visualization
  const { data: activeChannels = [] } = useQuery<TopologyChannel[]>({
    queryKey: ['active-channels', migrations],
    queryFn: fetchActiveChannels,
    refetchInterval: 4000,
  });

  // For split view, we need a combined QM list with channels bridging between canvases
  // Each canvas gets its respective channels only
  const sourceChannels = activeChannels.filter((ch) =>
    sourceQMs.some((q) => q.name === ch.sourceQM)
  );

  async function handleProvision() {
    setProvisionState('loading');
    setProvisionMessage('');
    try {
      await provisionTopology();
      setProvisionState('success');
      setProvisionMessage('Source topology provisioned: 6 apps (AppA–F), 2 queue managers (QM1, QM2), 3 shared queues (Q1–Q3), 1 channel (QM1 → QM2).');
      refetchFleet();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provisioning failed.';
      setProvisionState('error');
      setProvisionMessage(msg);
    }
  }

  const rewiringCount = activeChannels.filter((ch) => ch.isRewiring).length;
  const totalChannels = activeChannels.length;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Topology View</h1>
          {totalChannels > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {rewiringCount} rewiring · {totalChannels} channel{totalChannels !== 1 ? 's' : ''} active
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(isLoading || targetLoading) && <LoadingSpinner size="sm" />}
          <button
            onClick={handleProvision}
            disabled={provisionState === 'loading'}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <DatabaseZap className="w-4 h-4" />
            {provisionState === 'loading' ? 'Provisioning...' : 'Provision Source Topology'}
          </button>
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

      {/* Provision feedback banner */}
      {provisionMessage && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm shrink-0 ${
            provisionState === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {provisionState === 'success' ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-800" />
          )}
          <span>{provisionMessage}</span>
        </div>
      )}

      {/* Transparent rewiring legend */}
      {activeChannels.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-amber-50 border border-amber-100 shrink-0 text-xs text-amber-800">
          <span className="font-semibold">Transparent Rewiring Active:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-mono">REMOTE</span> queue defs shadow original names — apps unchanged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-blue-300" />
            <span className="font-mono">XMIT</span> transmission queues forward messages to target
          </span>
        </div>
      )}

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
              {sourceChannels.length > 0 && (
                <span className="text-xs text-amber-600 font-medium">
                  {sourceChannels.length} channel{sourceChannels.length !== 1 ? 's' : ''} rewiring
                </span>
              )}
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <TopologyCanvas
                queueManagers={sourceQMs}
                migrations={migrations}
                mode="source"
                queueDetails={sourceQueueDetails ?? {}}
                channels={[]}
              />
            </div>
          </div>

          {/* Arrow with channel count */}
          <div className="flex items-center self-center shrink-0">
            <div className="flex flex-col items-center gap-1 text-slate-300">
              <ArrowRight className={`w-6 h-6 ${activeChannels.length > 0 ? 'text-amber-400' : ''}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${activeChannels.length > 0 ? 'text-amber-500' : ''}`}>
                {activeChannels.length > 0 ? `${activeChannels.length} chl` : 'migrate'}
              </span>
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
              <TopologyCanvas
                queueManagers={targetQMs}
                migrations={migrations}
                mode="target"
                queueDetails={targetQueueDetails ?? {}}
                channels={[]}
              />
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
              queueDetails={view === 'source' ? (sourceQueueDetails ?? {}) : (targetQueueDetails ?? {})}
              channels={view === 'source' ? sourceChannels : []}
            />
          </div>
        </div>
      )}
    </div>
  );
}
