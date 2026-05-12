import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Network, ArrowRight, DatabaseZap, CircleCheck as CheckCircle,
  CircleAlert as AlertCircle, BrainCircuit, X, ShieldAlert,
  MessageSquareWarning, Upload, ChevronDown, ChevronUp, ArrowRightLeft,
} from 'lucide-react';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import UploadTopology from '../components/topology/UploadTopology';
import SourceTopologyGraph from '../components/topology/SourceTopologyGraph';
import ProvisionPipelineBoard from '../components/topology/ProvisionPipelineBoard';
import NodeDetailsDrawer from '../components/topology/NodeDetailsDrawer';
import { useFleet } from '../hooks/useFleet';
import { useMigrations } from '../hooks/useMigrations';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { bootstrapFleet, fetchTargetTopology, fetchQueueDetails, fetchActiveChannels } from '../api/fleet';
import { rollbackProvisioning } from '../api/topologyUpload';
import { useTopologyUpload, useProvisionStart } from '../hooks/useTopologyUpload';
import { useProvisionEvents } from '../hooks/useProvisionEvents';
import type { QueueManagerFleet, TopologyChannel } from '../types';
import type { QueueEntry } from '../components/topology/QMNode';
import type { TopologyNodeData } from '../api/topologyUpload';
import type { ProvisionedNode } from '../hooks/useProvisionEvents';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';

type ViewMode = 'split' | 'source' | 'target';
type ProvisionState = 'idle' | 'loading' | 'success' | 'error';

interface AnalysisResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  agentMessage: string;
  details: string[];
}

const MOCK_ANALYSIS: AnalysisResult = {
  riskLevel: 'HIGH',
  reason: 'Shared queue manager infrastructure',
  agentMessage: 'High dependency detected between APP1–APP6 on shared source QMs',
  details: [
    'QM.SRC.A serves APP1, APP2, APP3 concurrently — single point of failure',
    'QM.SRC.B serves APP4, APP5, APP6 with overlapping queue definitions',
    'No isolation boundary between application workloads detected',
    'Shared DLQs (Q.SRC.A.DLQ.LOCAL) cause message attribution risk',
  ],
};

export default function TopologyPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('split');
  const [provisionState, setProvisionState] = useState<ProvisionState>('idle');
  const [provisionMessage, setProvisionMessage] = useState<string>('');
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [agentMessage, setAgentMessage] = useState<string>('');
  const [showSourceUpload, setShowSourceUpload] = useState(false);
  const [showTargetUpload, setShowTargetUpload] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TopologyNodeData | ProvisionedNode | null>(null);
  const [provisionBoardExpanded, setProvisionBoardExpanded] = useState(true);

  // Global topology store
  const { sourceTopology, targetTopology, setSourceTopology, setTargetTopology } = useAppStore();

  // Source upload hooks
  const { upload: uploadSource, uploading: uploadingSource, uploadResult: sourceUploadResult, uploadError: sourceUploadError, reset: resetSource } = useTopologyUpload();
  // Target upload hooks
  const { upload: uploadTarget, uploading: uploadingTarget, uploadResult: targetUploadResult, uploadError: targetUploadError, reset: resetTarget } = useTopologyUpload();

  const { start: startProvisioning, starting, sessionId } = useProvisionStart();
  const provEvents = useProvisionEvents(sessionId);

  const handleUploadSource = useCallback(async (file: File) => {
    const result = await uploadSource(file);
    setSourceTopology(result.graph);
    return result;
  }, [uploadSource, setSourceTopology]);

  const handleUploadTarget = useCallback(async (file: File) => {
    const result = await uploadTarget(file);
    setTargetTopology(result.graph);
    return result;
  }, [uploadTarget, setTargetTopology]);

  function handleAnalyze() {
    setAnalysisState('loading');
    setAgentMessage('');
    setAnalysisResult(null);
    setTimeout(() => {
      setAnalysisResult(MOCK_ANALYSIS);
      setAnalysisState('done');
      setTimeout(() => setAgentMessage(MOCK_ANALYSIS.agentMessage), 600);
    }, 1400);
  }

  const { data: fleet, isLoading, refetch: refetchFleet } = useFleet();
  const { migrations } = useMigrations();

  const sourceQMs = fleet?.queue_managers.filter((q) => q.role === 'source') ?? [];

  const { data: remoteTargetTopology, isLoading: targetLoading } = useQuery({
    queryKey: ['topology-target'],
    queryFn: fetchTargetTopology,
    staleTime: 60_000,
  });

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

  const targetQMs: QueueManagerFleet[] = (remoteTargetTopology?.queue_managers ?? []).map((qm) => ({
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

  const { data: activeChannels = [] } = useQuery<TopologyChannel[]>({
    queryKey: ['active-channels', migrations],
    queryFn: fetchActiveChannels,
    refetchInterval: 4000,
  });

  const sourceChannels = activeChannels.filter((ch) =>
    sourceQMs.some((q) => q.name === ch.sourceQM)
  );

  async function handleProvisionLegacy() {
    setProvisionState('loading');
    setProvisionMessage('');
    try {
      const res = await bootstrapFleet();
      if (res.status === 'complete') {
        setProvisionState('success');
        setProvisionMessage(`Source topology provisioned: ${res.results.length} MQ objects created across QM.SRC.A and QM.SRC.B.`);
        refetchFleet();
      } else {
        throw new Error('Bootstrap returned incomplete status');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provisioning failed.';
      setProvisionState('error');
      setProvisionMessage(msg);
    }
  }

  async function handleProvisionUploaded() {
    if (!sourceUploadResult) return;
    await startProvisioning();
    setProvisionBoardExpanded(true);
  }

  const handleNodeClick = useCallback((node: TopologyNodeData | ProvisionedNode) => {
    setSelectedNode(node);
  }, []);

  const handleRollback = useCallback(async (nodeId: string) => {
    await rollbackProvisioning(nodeId);
  }, []);

  const canMigrate = !!sourceTopology && !!targetTopology;
  const hasSourceGraph = !!sourceTopology || !!sourceUploadResult?.graph;
  const hasTargetGraph = !!targetTopology || !!targetUploadResult?.graph;
  const hasUploadedGraph = hasSourceGraph;
  const hasProvisioningStarted = !!sessionId;

  const isEmpty = sourceQMs.length > 0 &&
    sourceQueueDetails &&
    Object.values(sourceQueueDetails).every(queues => queues.length === 0);

  const rewiringCount = activeChannels.filter((ch) => ch.isRewiring).length;
  const totalChannels = activeChannels.length;

  const selectedSourceRow = selectedNode && sourceUploadResult?.graph?.rows
    ? sourceUploadResult.graph.rows.find((row) => {
        const n = selectedNode as TopologyNodeData;
        return row.producer_app_id === n.app_id ||
          row.consumer_app_id === n.app_id ||
          row.producer_queue_manager === n.queue_manager ||
          row.channel_name === (n as TopologyNodeData).channel_name;
      })
    : undefined;

  const activeSourceGraph = sourceTopology || sourceUploadResult?.graph;
  const activeTargetGraph = targetTopology || targetUploadResult?.graph;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)] relative">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-text-secondary" />
          <h1 className="text-xl font-semibold text-text-primary">Topology View</h1>
          {totalChannels > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/20 border border-warning text-xs font-medium text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              {rewiringCount} rewiring · {totalChannels} channel{totalChannels !== 1 ? 's' : ''} active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(isLoading || targetLoading) && <LoadingSpinner size="sm" />}

          <button
            onClick={handleAnalyze}
            disabled={analysisState === 'loading'}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg bg-warning text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {analysisState === 'loading' ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4" />
                Analyze Topology
              </>
            )}
          </button>

          <button
            onClick={hasSourceGraph ? handleProvisionUploaded : handleProvisionLegacy}
            disabled={provisionState === 'loading' || starting}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <DatabaseZap className="w-4 h-4" />
            {starting ? 'Starting...' : provisionState === 'loading' ? 'Provisioning...' : 'Provision Source'}
          </button>

          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            {(['split', 'source', 'target'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm font-medium capitalize transition-all duration-150 ${
                  view === v
                    ? 'bg-surface-overlay text-text-primary'
                    : 'bg-surface-card text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
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
        <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg text-sm shrink-0 ${
          provisionState === 'success'
            ? 'bg-success/20 border border-success text-success'
            : 'bg-danger/20 border border-danger text-danger'
        }`}>
          <div className="flex items-start gap-3">
            {provisionState === 'success' ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
            )}
            <span>{provisionMessage}</span>
          </div>
          <button onClick={() => setProvisionMessage('')} className="text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isEmpty && provisionState === 'idle' && !hasSourceGraph && (
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-surface-card border-2 border-dashed border-surface-border items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-900/20 flex items-center justify-center border border-blue-800/50">
            <DatabaseZap className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">Clean Fleet Detected</h3>
            <p className="text-sm text-text-muted mt-1 max-w-md">
              No application queues were found. Bootstrap the source topology or upload a topology file.
            </p>
          </div>
          <button
            onClick={handleProvisionLegacy}
            className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
          >
            <DatabaseZap className="w-4 h-4" />
            Provision Hackathon Topology
          </button>
        </div>
      )}

      {analysisResult && (
        <div className="shrink-0 rounded-xl border border-danger bg-danger/20 overflow-hidden">
          <div className="flex items-start justify-between px-4 py-3 border-b border-danger bg-danger/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-danger" />
              <span className="text-sm font-semibold text-danger">AI Topology Analysis</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white tracking-wide">
                {analysisResult.riskLevel} RISK
              </span>
            </div>
            <button
              onClick={() => { setAnalysisResult(null); setAgentMessage(''); setAnalysisState('idle'); }}
              className="text-danger hover:opacity-80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-danger">
              Reason: <span className="font-semibold">{analysisResult.reason}</span>
            </p>
            <ul className="flex flex-col gap-1">
              {analysisResult.details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-danger">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
          {agentMessage && (
            <div className="flex items-center gap-2 px-4 py-2 border-t border-danger bg-danger/20">
              <MessageSquareWarning className="w-4 h-4 text-danger shrink-0" />
              <span className="text-xs font-mono text-danger">
                <span className="font-semibold text-danger">Agent:</span> {agentMessage}
              </span>
            </div>
          )}
        </div>
      )}

      {activeChannels.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-warning/20 border border-warning shrink-0 text-xs text-warning">
          <span className="font-semibold">Transparent Rewiring Active:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span className="font-mono">REMOTE</span> queue defs shadow original names — apps unchanged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-primary/40" />
            <span className="font-mono">XMIT</span> transmission queues forward messages to target
          </span>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 gap-4 min-h-0 overflow-y-auto">

        {/* Dual Upload Canvas — Source & Target side by side */}
        <div className="flex gap-4 shrink-0" style={{ minHeight: hasProvisioningStarted ? '45vh' : (activeSourceGraph || activeTargetGraph) ? '65vh' : '0' }}>
          {/* Source Topology */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Source Topology</span>
                {activeSourceGraph && (
                  <span className="text-xs text-text-muted">
                    {activeSourceGraph.nodes.length} nodes
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowSourceUpload((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  activeSourceGraph
                    ? 'bg-emerald-900/50 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                    : 'bg-surface-card border-surface-border text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
                }`}
              >
                <Upload className="w-3 h-3" />
                {activeSourceGraph ? 'Uploaded' : 'Upload Source'}
              </button>
            </div>

            <AnimatePresence>
              {showSourceUpload && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden shrink-0"
                >
                  <UploadTopology
                    onUpload={handleUploadSource}
                    uploading={uploadingSource}
                    uploadResult={sourceUploadResult}
                    uploadError={sourceUploadError}
                    onReset={() => { resetSource(); setSourceTopology(null); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {activeSourceGraph ? (
              <div className="flex-1 rounded-xl border border-surface-border overflow-hidden bg-surface-raised relative" style={{ minHeight: '300px' }}>
                <SourceTopologyGraph
                  graph={activeSourceGraph}
                  onNodeClick={handleNodeClick}
                />
                {selectedNode && (
                  <NodeDetailsDrawer
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onRollback={handleRollback}
                    sourceRow={selectedSourceRow}
                  />
                )}
              </div>
            ) : (
              <div
                className="flex-1 rounded-xl border-2 border-dashed border-surface-border bg-surface-card flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-500/50 hover:bg-blue-900/10 transition-colors"
                style={{ minHeight: '200px' }}
                onClick={() => setShowSourceUpload(true)}
              >
                <Upload className="w-8 h-8 text-text-muted" />
                <div className="text-center">
                  <p className="text-sm font-medium text-text-secondary">Upload Source Topology</p>
                  <p className="text-xs text-text-muted mt-1">CSV or XLS file</p>
                </div>
              </div>
            )}
          </div>

          {/* Migrate Button between canvases */}
          <div className="flex flex-col items-center justify-center gap-3 shrink-0 px-2">
            <motion.button
              onClick={() => navigate('/migration-plan')}
              disabled={!canMigrate}
              whileHover={canMigrate ? { scale: 1.05 } : {}}
              whileTap={canMigrate ? { scale: 0.95 } : {}}
              className={`flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border-2 text-xs font-bold transition-all duration-200 ${
                canMigrate
                  ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300 hover:bg-emerald-900/60 shadow-lg shadow-emerald-900/30'
                  : 'bg-surface-card border-surface-border text-text-muted cursor-not-allowed opacity-50'
              }`}
            >
              <ArrowRightLeft className="w-5 h-5" />
              <span>Migrate</span>
            </motion.button>
            {!canMigrate && (
              <p className="text-[10px] text-text-muted text-center max-w-[80px]">
                Upload both topologies first
              </p>
            )}
          </div>

          {/* Target Topology */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Target Topology</span>
                {activeTargetGraph && (
                  <span className="text-xs text-text-muted">
                    {activeTargetGraph.nodes.length} nodes
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowTargetUpload((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  activeTargetGraph
                    ? 'bg-emerald-900/50 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                    : 'bg-surface-card border-surface-border text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
                }`}
              >
                <Upload className="w-3 h-3" />
                {activeTargetGraph ? 'Uploaded' : 'Upload Target'}
              </button>
            </div>

            <AnimatePresence>
              {showTargetUpload && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden shrink-0"
                >
                  <UploadTopology
                    onUpload={handleUploadTarget}
                    uploading={uploadingTarget}
                    uploadResult={targetUploadResult}
                    uploadError={targetUploadError}
                    onReset={() => { resetTarget(); setTargetTopology(null); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {activeTargetGraph ? (
              <div className="flex-1 rounded-xl border border-emerald-700/40 overflow-hidden bg-surface-raised relative" style={{ minHeight: '300px' }}>
                <SourceTopologyGraph
                  graph={activeTargetGraph}
                  onNodeClick={handleNodeClick}
                />
              </div>
            ) : (
              <div
                className="flex-1 rounded-xl border-2 border-dashed border-surface-border bg-surface-card flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-900/10 transition-colors"
                style={{ minHeight: '200px' }}
                onClick={() => setShowTargetUpload(true)}
              >
                <Upload className="w-8 h-8 text-text-muted" />
                <div className="text-center">
                  <p className="text-sm font-medium text-text-secondary">Upload Target Topology</p>
                  <p className="text-xs text-text-muted mt-1">CSV or XLS file</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Provision Pipeline Board */}
        {hasProvisioningStarted && (
          <div className="flex flex-col gap-2 shrink-0" style={{ height: '50vh' }}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${provEvents.isRunning ? 'bg-blue-400 animate-pulse' : provEvents.isComplete ? 'bg-emerald-400' : 'bg-text-muted'}`} />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Live Provisioning Pipeline
                </span>
              </div>
              <button
                onClick={() => setProvisionBoardExpanded((v) => !v)}
                className="text-text-muted hover:text-text-primary transition-colors p-1"
              >
                {provisionBoardExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <AnimatePresence>
              {provisionBoardExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '100%', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex-1 relative overflow-hidden"
                >
                  <ProvisionPipelineBoard
                    nodes={provEvents.nodes}
                    events={provEvents.events}
                    isRunning={provEvents.isRunning}
                    isComplete={provEvents.isComplete}
                    onNodeClick={(n) => setSelectedNode(n)}
                  />
                  {selectedNode && (
                    <NodeDetailsDrawer
                      node={selectedNode}
                      onClose={() => setSelectedNode(null)}
                      onRollback={handleRollback}
                      sourceRow={selectedSourceRow}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Legacy topology canvas when no files uploaded */}
        {!activeSourceGraph && !activeTargetGraph && (
          view === 'split' ? (
            <div className="flex gap-4 flex-1 min-h-0">
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 px-1 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-surface-muted" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Source Topology
                  </span>
                  <span className="text-xs text-text-muted">{sourceQMs.length} shared QMs</span>
                  {sourceChannels.length > 0 && (
                    <span className="text-xs text-amber-400 font-medium">
                      {sourceChannels.length} channel{sourceChannels.length !== 1 ? 's' : ''} rewiring
                    </span>
                  )}
                </div>
                <div className="flex-1 rounded-xl border border-surface-border overflow-hidden bg-surface-raised">
                  <TopologyCanvas
                    queueManagers={sourceQMs}
                    migrations={migrations}
                    mode="source"
                    queueDetails={sourceQueueDetails ?? {}}
                    channels={[]}
                  />
                </div>
              </div>

              <div className="flex items-center self-center shrink-0">
                <div className="flex flex-col items-center gap-1 text-surface-border">
                  <ArrowRight className={`w-6 h-6 ${activeChannels.length > 0 ? 'text-warning' : 'text-surface-muted'}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${activeChannels.length > 0 ? 'text-warning' : 'text-text-muted'}`}>
                    {activeChannels.length > 0 ? `${activeChannels.length} chl` : 'migrate'}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 px-1 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Target Topology
                  </span>
                  <span className="text-xs text-text-muted">{targetQMs.length} dedicated QMs</span>
                </div>
                <div className="flex-1 rounded-xl border border-surface-border overflow-hidden bg-surface-raised">
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
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: view === 'source' ? 'var(--surface-muted)' : 'var(--accent-success)' }}
                />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {view === 'source' ? 'Source Topology' : 'Target Topology'}
                </span>
              </div>
              <div className="flex-1 rounded-xl border border-surface-border overflow-hidden bg-surface-raised">
                <TopologyCanvas
                  queueManagers={view === 'source' ? sourceQMs : targetQMs}
                  migrations={migrations}
                  mode={view as 'source' | 'target'}
                  queueDetails={view === 'source' ? (sourceQueueDetails ?? {}) : (targetQueueDetails ?? {})}
                  channels={view === 'source' ? sourceChannels : []}
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
