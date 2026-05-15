import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowRight, ArrowLeft, Server, Network, Lock, RefreshCw, ChevronRight, CircleCheck as CheckCircle2, Layers, GitBranch, Zap, TriangleAlert as AlertTriangle, Terminal, Play, RotateCcw } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import { useWorkspaceStore } from '../store/workspaceStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuntimeConfig {
  queueManager: string;
  channel: string;
  host: string;
  port: string;
  queueName: string;
  tls: boolean;
  retryPolicy: string;
}

type DeploymentStrategy = 'blue-green' | 'rolling' | 'canary' | 'immediate';

interface ConsoleLine {
  id: number;
  ts: string;
  level: 'INFO' | 'WARN' | 'OK' | 'ERROR' | 'CMD' | 'HEAD';
  text: string;
}

// ── Mock topology nodes ───────────────────────────────────────────────────────

const TARGET_QMS = [
  { id: 'cloud-pay-qm1', label: 'CLOUD.PAY.QM1', type: 'target', status: 'ready' },
  { id: 'cloud-ledger-qm2', label: 'CLOUD.LEDGER.QM2', type: 'target', status: 'ready' },
  { id: 'cloud-audit-qm2', label: 'CLOUD.AUDIT.QM2', type: 'target', status: 'provisioning' },
];

const TARGET_CHANNELS = [
  { id: 'ch-1', src: 'CLOUD.PAY.QM1', dst: 'CLOUD.LEDGER.QM2', label: 'PAY.TO.LEDGER', active: true },
  { id: 'ch-2', src: 'CLOUD.PAY.QM1', dst: 'CLOUD.AUDIT.QM2', label: 'PAY.TO.AUDIT', active: false },
];

// ── Deployment log sequences per strategy ─────────────────────────────────────

const DEPLOY_SEQUENCES: Record<DeploymentStrategy, string[][]> = {
  'blue-green': [
    ['HEAD', '━━━  BLUE/GREEN DEPLOYMENT INITIATED  ━━━'],
    ['CMD',  '$ oc get deployment payment-api -n mq-prod'],
    ['INFO', 'deployment.apps/payment-api   1/1   1   1   18m'],
    ['CMD',  '$ oc scale deployment/payment-api-green --replicas=2'],
    ['INFO', 'Scaling GREEN environment → 2 replicas'],
    ['INFO', 'Waiting for rollout... (0/2 pods ready)'],
    ['INFO', 'Waiting for rollout... (1/2 pods ready)'],
    ['OK',   'GREEN environment healthy: 2/2 pods running'],
    ['CMD',  '$ oc apply -f runtime-config-cloud.yaml'],
    ['INFO', 'configmap/payment-api-runtime-config updated'],
    ['INFO', 'Injecting MQ settings → CLOUD.PAY.QM1:1414'],
    ['INFO', 'TLS cipher: TLS_AES_256_GCM_SHA384 ✓'],
    ['INFO', 'CCDT updated → cloud.pay.qm1.mq.ibm.com'],
    ['CMD',  '$ oc rollout status deployment/payment-api-green'],
    ['INFO', 'Waiting for rollout to finish: 0 of 2 updated replicas available...'],
    ['INFO', 'Waiting for rollout to finish: 1 of 2 updated replicas available...'],
    ['OK',   'Rollout complete. 2/2 replicas available'],
    ['CMD',  '$ oc set route payment-api --to=payment-api-green'],
    ['INFO', 'Traffic switching BLUE → GREEN'],
    ['INFO', 'Running readiness probe on /health/mq...'],
    ['INFO', 'Probe attempt 1/3 → HTTP 200 OK (latency: 42ms)'],
    ['OK',   'Readiness probe passed ✓'],
    ['CMD',  '$ oc scale deployment/payment-api-blue --replicas=0'],
    ['INFO', 'Draining BLUE environment'],
    ['OK',   '━━━  BLUE/GREEN DEPLOYMENT SUCCESSFUL  ━━━'],
  ],
  'rolling': [
    ['HEAD', '━━━  ROLLING DEPLOYMENT INITIATED  ━━━'],
    ['CMD',  '$ oc rollout restart deployment/payment-api'],
    ['INFO', 'deployment.apps/payment-api restarted'],
    ['INFO', 'Rolling update: pod payment-api-78b9d4c5-xq7k2 terminating'],
    ['INFO', 'Pulling image: registry.redhat.io/payment-api:v2.4.1'],
    ['INFO', 'Container runtime-config updated → CLOUD.PAY.QM1'],
    ['INFO', 'Pod payment-api-78b9d4c5-xq7k2 starting...'],
    ['INFO', 'Running readiness probe /health/mq → 200 OK'],
    ['OK',   'Pod payment-api-78b9d4c5-xq7k2 running (1/2 updated)'],
    ['INFO', 'Rolling update: pod payment-api-78b9d4c5-r2p9m terminating'],
    ['INFO', 'Container runtime-config updated → CLOUD.PAY.QM1'],
    ['INFO', 'Pod payment-api-78b9d4c5-r2p9m starting...'],
    ['INFO', 'Running readiness probe /health/mq → 200 OK'],
    ['OK',   'Pod payment-api-78b9d4c5-r2p9m running (2/2 updated)'],
    ['OK',   '━━━  ROLLING DEPLOYMENT SUCCESSFUL  ━━━'],
  ],
  'canary': [
    ['HEAD', '━━━  CANARY DEPLOYMENT INITIATED  ━━━'],
    ['INFO', 'Deploying canary: 10% traffic weight'],
    ['CMD',  '$ oc apply -f payment-api-canary.yaml'],
    ['INFO', 'deployment.apps/payment-api-canary created'],
    ['INFO', 'VirtualService updated: canary weight=10, stable weight=90'],
    ['INFO', 'Canary pod payment-api-canary-5f7bc9-kl8tz starting...'],
    ['INFO', 'Injecting runtime config → CLOUD.PAY.QM1'],
    ['OK',   'Canary pod healthy — routing 10% traffic'],
    ['INFO', 'Monitoring canary metrics (60s observation window)...'],
    ['INFO', 'Error rate: 0.00% ✓  |  Latency p99: 48ms ✓'],
    ['INFO', 'Promoting canary: 50% traffic weight'],
    ['INFO', 'VirtualService updated: canary weight=50, stable weight=50'],
    ['INFO', 'Error rate: 0.00% ✓  |  Latency p99: 45ms ✓'],
    ['INFO', 'Promoting canary: 100% traffic weight'],
    ['CMD',  '$ oc delete deployment payment-api-stable'],
    ['INFO', 'Stable deployment decommissioned'],
    ['OK',   '━━━  CANARY DEPLOYMENT SUCCESSFUL  ━━━'],
  ],
  'immediate': [
    ['HEAD', '━━━  IMMEDIATE DEPLOYMENT INITIATED  ━━━'],
    ['WARN', 'WARNING: Immediate deployment — no gradual rollout'],
    ['CMD',  '$ oc scale deployment/payment-api --replicas=0'],
    ['INFO', 'Stopping all application pods...'],
    ['INFO', 'All pods terminated'],
    ['CMD',  '$ oc apply -f runtime-config-cloud.yaml'],
    ['INFO', 'Applying updated runtime configuration'],
    ['INFO', 'configmap/payment-api-runtime-config replaced'],
    ['CMD',  '$ oc scale deployment/payment-api --replicas=2'],
    ['INFO', 'Starting application pods with new config...'],
    ['INFO', 'Pod payment-api-88c4d9-w7x2v starting... '],
    ['INFO', 'Pod payment-api-88c4d9-p3q9n starting...'],
    ['INFO', 'Running readiness probe /health/mq → 200 OK'],
    ['INFO', 'Running readiness probe /health/mq → 200 OK'],
    ['OK',   'All pods running with updated MQ config'],
    ['OK',   '━━━  IMMEDIATE DEPLOYMENT SUCCESSFUL  ━━━'],
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowTs(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function levelColor(level: ConsoleLine['level']): string {
  switch (level) {
    case 'OK':   return '#22c55e';
    case 'WARN': return '#f59e0b';
    case 'ERROR':return '#ef4444';
    case 'CMD':  return '#22d3ee';
    case 'HEAD': return '#60a5fa';
    default:     return '#94a3b8';
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConfigRedeploy() {
  const navigate = useNavigate();
  const { setStep, addTimelineEvent } = useWorkspaceStore();

  const [config, setConfig] = useState<RuntimeConfig>({
    queueManager: 'CLOUD.PAY.QM1',
    channel: 'CLOUD.SVRCONN',
    host: 'cloud.pay.qm1.mq.ibm.com',
    port: '1414',
    queueName: 'PAY.EVENT.OUT',
    tls: true,
    retryPolicy: 'exponential',
  });

  const [strategy, setStrategy] = useState<DeploymentStrategy>('blue-green');
  const [deploying, setDeploying] = useState(false);
  const [deployDone, setDeployDone] = useState(false);
  const [consoleLines, setConsoleLines] = useState<ConsoleeLine[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  // auto scroll console
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [consoleLines]);

  function startDeploy() {
    setDeployDone(false);
    setConsoleLines([]);
    setDeploying(true);
    const sequence = DEPLOY_SEQUENCES[strategy];
    let i = 0;
    const delays = sequence.map((_, idx) => 300 + idx * 220 + Math.random() * 120);
    let cumulative = 0;

    sequence.forEach((entry, idx) => {
      cumulative += delays[idx];
      setTimeout(() => {
        const line: ConsoleeLine = {
          id: lineCounter.current++,
          ts: nowTs(),
          level: entry[0] as ConsoleeLine['level'],
          text: entry[1],
        };
        setConsoleLines(prev => [...prev, line]);
        if (idx === sequence.length - 1) {
          setDeploying(false);
          setDeployDone(true);
        }
      }, cumulative);
    });
  }

  function resetConsole() {
    setConsoleLines([]);
    setDeploying(false);
    setDeployDone(false);
  }

  const proceed = () => {
    setStep('target-validation');
    addTimelineEvent({
      type: 'success',
      title: 'Config & Redeploy Complete',
      detail: 'Runtime config updated and deployment successful',
      step: 'config-redeploy',
    });
    navigate('/migration/target-validation');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      {/* ── Three-panel body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── LEFT: Runtime config form ── */}
        <motion.div
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[300px] shrink-0 border-r border-surface-border flex flex-col overflow-y-auto"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
            <span className="text-xs font-semibold text-text-primary">Runtime Configuration</span>
          </div>

          <div className="p-4 space-y-3 flex-1">
            {/* Queue Manager */}
            <ConfigField
              icon={<Server className="w-3 h-3" />}
              label="Queue Manager"
              value={config.queueManager}
              onChange={v => setConfig(c => ({ ...c, queueManager: v }))}
            />
            {/* Channel */}
            <ConfigField
              icon={<Network className="w-3 h-3" />}
              label="Channel"
              value={config.channel}
              onChange={v => setConfig(c => ({ ...c, channel: v }))}
            />
            {/* Host */}
            <ConfigField
              icon={<ChevronRight className="w-3 h-3" />}
              label="Host"
              value={config.host}
              onChange={v => setConfig(c => ({ ...c, host: v }))}
            />
            {/* Port */}
            <ConfigField
              icon={<ChevronRight className="w-3 h-3" />}
              label="Port"
              value={config.port}
              onChange={v => setConfig(c => ({ ...c, port: v }))}
              type="number"
            />
            {/* Queue Name */}
            <ConfigField
              icon={<Layers className="w-3 h-3" />}
              label="Queue Name"
              value={config.queueName}
              onChange={v => setConfig(c => ({ ...c, queueName: v }))}
            />

            {/* TLS toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-overlay)' }}>
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3" style={{ color: config.tls ? '#22c55e' : '#94a3b8' }} />
                <span className="text-xs text-text-secondary">TLS</span>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, tls: !c.tls }))}
                className="w-9 h-5 rounded-full relative transition-all duration-300"
                style={{ background: config.tls ? '#22c55e' : 'rgba(255,255,255,0.1)' }}
              >
                <motion.div
                  layout
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ left: config.tls ? '18px' : '2px' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              </button>
            </div>

            {/* Retry Policy */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-0.5">
                <RefreshCw className="w-3 h-3 text-text-muted" />
                <label className="text-[11px] text-text-muted font-medium">Retry Policy</label>
              </div>
              <select
                value={config.retryPolicy}
                onChange={e => setConfig(c => ({ ...c, retryPolicy: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs text-text-primary border"
                style={{
                  background: 'var(--surface-overlay)',
                  borderColor: 'var(--surface-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="exponential">Exponential Backoff</option>
                <option value="fixed">Fixed Interval</option>
                <option value="linear">Linear Backoff</option>
                <option value="none">No Retry</option>
              </select>
            </div>
          </div>

          {/* Nav buttons */}
          <div className="p-4 border-t border-surface-border flex gap-2">
            <button
              className="btn-ghost flex-1 text-xs justify-center"
              onClick={() => navigate('/migration/source-validation')}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              className="btn-primary flex-1 text-xs justify-center"
              onClick={proceed}
              disabled={!deployDone}
              style={!deployDone ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
            >
              Validate Target
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* ── CENTER: Target topology preview ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col min-w-0 border-r border-surface-border overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
            <span className="text-xs font-semibold text-text-primary">Target Topology Preview</span>
            <div className="ml-auto flex items-center gap-1.5 text-[10px]"
              style={{ color: '#22d3ee' }}>
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              CLOUD TARGET
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Target QMs */}
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                Target Queue Managers
              </p>
              <div className="grid grid-cols-1 gap-2">
                {TARGET_QMS.map((qm, i) => (
                  <motion.div
                    key={qm.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{
                      background: 'var(--surface-overlay)',
                      borderColor: qm.status === 'ready' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}
                    >
                      <Server className="w-4 h-4" style={{ color: '#22d3ee' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary font-mono">{qm.label}</p>
                      <p className="text-[10px] text-text-muted">IBM MQ Cloud · 1414</p>
                    </div>
                    <StatusPill status={qm.status} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Active routing / channels */}
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                Active Routing / Channels
              </p>
              <div className="space-y-2">
                {TARGET_CHANNELS.map((ch, i) => (
                  <motion.div
                    key={ch.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.09 }}
                    className="p-3 rounded-xl border"
                    style={{
                      background: 'var(--surface-overlay)',
                      borderColor: ch.active ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Network className="w-3.5 h-3.5 shrink-0" style={{ color: ch.active ? '#22c55e' : '#94a3b8' }} />
                      <span className="text-xs font-mono font-semibold text-text-primary">{ch.label}</span>
                      <span
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={ch.active
                          ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }
                        }
                      >
                        {ch.active ? 'ACTIVE' : 'PENDING'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
                      <span>{ch.src}</span>
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      <span>{ch.dst}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* MQ Flow diagram */}
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                Target MQ Flow
              </p>
              <MQFlowDiagram config={config} />
            </div>
          </div>
        </motion.div>

        {/* ── RIGHT: Deployment strategy ── */}
        <motion.div
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          className="w-[260px] shrink-0 flex flex-col overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
            <span className="text-xs font-semibold text-text-primary">Deployment Strategy</span>
          </div>

          <div className="p-4 space-y-2.5 flex-1 overflow-y-auto">
            {(
              [
                { id: 'blue-green',  label: 'Blue / Green',  desc: 'Zero-downtime swap between two environments', icon: <GitBranch className="w-4 h-4" /> },
                { id: 'rolling',     label: 'Rolling',        desc: 'Gradually replace pods one by one', icon: <RefreshCw className="w-4 h-4" /> },
                { id: 'canary',      label: 'Canary',         desc: 'Incremental traffic shift with auto promotion', icon: <Zap className="w-4 h-4" /> },
                { id: 'immediate',   label: 'Immediate',      desc: 'Stop-and-restart with new config (higher risk)', icon: <AlertTriangle className="w-4 h-4" /> },
              ] as { id: DeploymentStrategy; label: string; desc: string; icon: React.ReactNode }[]
            ).map(s => {
              const active = strategy === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { setStrategy(s.id); resetConsole(); }}
                  className="w-full text-left p-3 rounded-xl border transition-all duration-200"
                  style={{
                    background: active ? 'rgba(34,211,238,0.06)' : 'var(--surface-overlay)',
                    borderColor: active ? 'rgba(34,211,238,0.35)' : 'var(--surface-border)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: active ? '#22d3ee' : '#94a3b8' }}>{s.icon}</span>
                    <span className={`text-xs font-semibold ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {s.label}
                    </span>
                    {active && (
                      <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: '#22d3ee' }} />
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed">{s.desc}</p>
                </button>
              );
            })}

            {/* Deploy button */}
            <div className="pt-2">
              {!deploying && !deployDone && (
                <button
                  onClick={startDeploy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #0e7490, #0891b2)', color: '#fff' }}
                >
                  <Play className="w-3.5 h-3.5" />
                  Deploy Now
                </button>
              )}
              {deploying && (
                <div
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee' }}
                >
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </motion.div>
                  Deploying…
                </div>
              )}
              {deployDone && (
                <div className="space-y-2">
                  <div
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Deployment Successful
                  </div>
                  <button
                    onClick={resetConsole}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-text-muted border transition-all hover:bg-white/5"
                    style={{ borderColor: 'var(--surface-border)' }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── BOTTOM: Live Deployment Console ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="shrink-0 border-t border-surface-border flex flex-col"
        style={{ height: '220px', background: '#0a0f1a' }}
      >
        {/* Console header */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
          style={{ borderColor: 'rgba(34,211,238,0.12)', background: 'rgba(0,0,0,0.4)' }}
        >
          <Terminal className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
          <span className="text-xs font-semibold font-mono" style={{ color: '#22d3ee' }}>
            LIVE DEPLOYMENT CONSOLE
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono ml-1"
            style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            {strategy.toUpperCase().replace('-', '/')}
          </span>

          {/* Traffic light dots */}
          <div className="ml-2 flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: deploying ? '#22c55e' : deployDone ? '#22c55e' : '#334155' }}
              animate={deploying ? { opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-mono" style={{ color: deploying ? '#22c55e' : deployDone ? '#22c55e' : '#475569' }}>
              {deploying ? 'RUNNING' : deployDone ? 'SUCCESS' : 'IDLE'}
            </span>
          </div>

          {consoleLines.length > 0 && (
            <button
              onClick={resetConsole}
              className="ml-auto text-[10px] font-mono text-text-muted hover:text-text-secondary transition-colors"
            >
              clear
            </button>
          )}
        </div>

        {/* Console body */}
        <div
          ref={consoleRef}
          className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] space-y-0.5"
          style={{ scrollBehavior: 'smooth' }}
        >
          {consoleLines.length === 0 && (
            <div className="flex items-center gap-2 mt-4 text-[11px] font-mono" style={{ color: '#334155' }}>
              <span style={{ color: '#22d3ee' }}>$</span>
              <span>Select a strategy and click Deploy Now to begin&nbsp;
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{ color: '#22d3ee' }}
                >▋</motion.span>
              </span>
            </div>
          )}

          <AnimatePresence initial={false}>
            {consoleLines.map(line => (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-start gap-3 leading-5"
              >
                {/* timestamp */}
                <span className="shrink-0 select-none" style={{ color: '#334155', minWidth: '155px' }}>
                  {line.ts}
                </span>

                {/* level badge */}
                <span
                  className="shrink-0 font-bold"
                  style={{ color: levelColor(line.level), minWidth: '44px' }}
                >
                  {line.level === 'HEAD' ? '───' : `[${line.level}]`}
                </span>

                {/* message */}
                <span style={{ color: line.level === 'HEAD' ? '#60a5fa' : line.level === 'CMD' ? '#22d3ee' : line.level === 'OK' ? '#22c55e' : line.level === 'WARN' ? '#f59e0b' : '#94a3b8' }}>
                  {line.text}
                  {deploying && line.id === consoleLines[consoleLines.length - 1]?.id && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      style={{ color: '#22d3ee' }}
                    >▋</motion.span>
                  )}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfigField({
  icon, label, value, onChange, type = 'text',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-text-muted">{icon}</span>
        <label className="text-[11px] text-text-muted font-medium">{label}</label>
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono text-text-primary border focus:outline-none transition-all"
        style={{
          background: 'var(--surface-overlay)',
          borderColor: 'var(--surface-border)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isReady = status === 'ready';
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
      style={isReady
        ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
        : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }
      }
    >
      {isReady ? 'READY' : 'PROVISIONING'}
    </span>
  );
}

function MQFlowDiagram({ config }: { config: RuntimeConfig }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(34,211,238,0.12)' }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* App node */}
        <FlowNode label="PaymentAPI" sub="Producer" color="#22d3ee" />

        <FlowArrow label={config.channel} />

        {/* QM node */}
        <FlowNode label={config.queueManager} sub={`${config.host}:${config.port}`} color="#60a5fa" />

        <FlowArrow label={config.queueName} />

        {/* Consumer node */}
        <FlowNode label="LedgerService" sub="Consumer" color="#22c55e" />
      </div>

      {config.tls && (
        <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px]"
          style={{ color: '#22c55e' }}>
          <Lock className="w-3 h-3" />
          <span>mTLS · TLS_AES_256_GCM_SHA384</span>
        </div>
      )}
    </div>
  );
}

function FlowNode({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: `${color}12`, border: `1px solid ${color}30` }}
      >
        <Server className="w-4 h-4" style={{ color }} />
      </div>
      <span className="text-[10px] font-mono font-semibold text-center leading-tight" style={{ color: 'var(--text-primary)', maxWidth: '72px', wordBreak: 'break-all' }}>
        {label}
      </span>
      <span className="text-[9px] text-text-muted text-center leading-tight" style={{ maxWidth: '72px' }}>
        {sub}
      </span>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className="flex items-center w-full">
        <div className="flex-1 h-px" style={{ background: 'rgba(34,211,238,0.25)' }} />
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: '#22d3ee' }} />
      </div>
      <span className="text-[9px] font-mono text-center truncate w-full" style={{ color: '#22d3ee' }}>
        {label}
      </span>
    </div>
  );
}
