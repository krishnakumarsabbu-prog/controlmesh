import { useState } from 'react';
import { Presentation, ChevronRight, ExternalLink } from 'lucide-react';
import SceneCard, { type SceneStatus } from '../components/demo/SceneCard';
import PolicyEnforcementDemo from '../components/demo/PolicyEnforcementDemo';
import BaselineValidationRunner from '../components/demo/BaselineValidationRunner';
import RollbackDemoPanel from '../components/demo/RollbackDemoPanel';
import BulkMigratePanel from '../components/demo/BulkMigratePanel';
import SentinelDemoPanel from '../components/demo/SentinelDemoPanel';
import EvidenceCollector from '../components/demo/EvidenceCollector';
import { useMigrations } from '../hooks/useMigrations';
import { useMigrationStream } from '../hooks/useMigrationStream';
import LiveIndicator from '../components/shared/LiveIndicator';

const SCENE_DURATIONS = ['4 min', '2 min', '8 min', '4 min', '5 min', '4 min', '2 min'];
const SCENE_TITLES = [
  'Source Topology + BCL Policy',
  'Baseline Validation',
  'First Migration — APP1',
  'Rollback Demonstration',
  'Migrate APP2–APP6',
  'Autonomous Sentinel',
  'Evidence Collection',
];
const SCENE_SUBTITLES = [
  'Show fleet, queues, and policy enforcement (422 on bad names)',
  'Confirm all 6 apps have working flows before touching anything',
  'Watch APP1 progress through all 6 steps live',
  'Trigger broken migration on APP2 — automated rollback',
  'Sequential migration of remaining 5 apps to dedicated QMs',
  'Drift detection & self-healing on Day-2 operations',
  'Collect evidence bundle for judges',
];

export default function DemoPage() {
  const [activeScene, setActiveScene] = useState<number | null>(null);
  useMigrationStream();
  const { migrations, triggerMigration } = useMigrations();

  const app1 = migrations['APP1'];
  const app1State = app1?.state ?? 'IDLE';

  const getSceneStatus = (idx: number): SceneStatus => {
    if (activeScene === idx) return 'active';
    if (activeScene !== null && idx < activeScene) return 'done';
    return 'pending';
  };

  const migratedCount = Object.values(migrations).filter((m) => m.state === 'MIGRATED').length;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Presentation className="w-5 h-5 text-text-secondary" />
          <h1 className="text-xl font-semibold text-text-primary">Hackathon Demo Console</h1>
        </div>
        <div className="flex items-center gap-4">
          <LiveIndicator />
          <div className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{migratedCount}</span>
            <span className="text-text-muted"> / 6 migrated</span>
          </div>
        </div>
      </div>

      {/* Opening narrative */}
      <div className="card px-5 py-4">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Opening (2 min)</div>
        <blockquote className="text-sm text-text-secondary italic border-l-2 border-surface-border pl-3">
          "We built a Business Control Layer and UI control plane that automates IBM MQ topology migration.
          The BCL is the only way to touch MQ objects — every operation goes through it, every operation is audited.
          We have 6 applications on a shared source topology. We're going to migrate them one by one to their own
          dedicated queue managers — fully automated, validated at each step, with automatic rollback if anything
          goes wrong."
        </blockquote>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-muted">Show first:</span>
          <a href="/topology" className="inline-flex items-center gap-1 text-[11px] text-primary hover:opacity-80 font-medium">
            Topology page — source graph, 6 apps on 2 shared QMs
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Scene selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted font-medium">Jump to scene:</span>
        {SCENE_TITLES.map((title, i) => (
          <button
            key={i}
            onClick={() => setActiveScene(i)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeScene === i
                ? 'bg-primary text-white'
                : 'bg-surface-raised text-text-secondary hover:bg-surface-overlay'
            }`}
          >
            {i + 1}. {title.split(' — ')[0].split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
        <button
          onClick={() => setActiveScene(null)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-raised text-text-muted hover:bg-surface-overlay transition-colors ml-auto"
        >
          Reset
        </button>
      </div>

      {/* Scene 1 */}
      <SceneCard
        number={1}
        title={SCENE_TITLES[0]}
        subtitle={SCENE_SUBTITLES[0]}
        status={getSceneStatus(0)}
        duration={SCENE_DURATIONS[0]}
      >
        <div className="space-y-3">
          <div className="text-xs text-text-muted space-y-1">
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>Navigate to <a href="/topology" className="text-primary hover:underline">Topology page</a> — show 2 source QMs, 6 apps</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>
                Curl <code className="bg-surface-overlay px-1 rounded text-[10px]">GET /api/fleet</code> — 2 source QMs in registry
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>Navigate to <a href="/audit" className="text-primary hover:underline">Audit Log</a> — show all provisioning operations</span>
            </div>
          </div>
          <div className="border-t border-surface-border pt-3">
            <div className="text-xs font-semibold text-text-secondary mb-2">Live policy enforcement test:</div>
            <PolicyEnforcementDemo />
          </div>
        </div>
      </SceneCard>

      {/* Scene 2 */}
      <SceneCard
        number={2}
        title={SCENE_TITLES[1]}
        subtitle={SCENE_SUBTITLES[1]}
        status={getSceneStatus(1)}
        duration={SCENE_DURATIONS[1]}
      >
        <BaselineValidationRunner />
      </SceneCard>

      {/* Scene 3 */}
      <SceneCard
        number={3}
        title={SCENE_TITLES[2]}
        subtitle={SCENE_SUBTITLES[2]}
        status={getSceneStatus(2)}
        duration={SCENE_DURATIONS[2]}
      >
        <div className="space-y-3">
          <div className="text-xs text-text-muted space-y-1.5">
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>
                Navigate to <a href="/migration" className="text-primary hover:underline">Migration Console</a> — APP1 row in IDLE state
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>Watch live: SNAPSHOTTED → PROVISIONING_TARGET → REWIRING → VALIDATING → MIGRATED</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>Topology graph animates APP1 from QM.SRC.A to QM.APP1</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
              <span>Highlight: producer never changed its connection string — transparent rewiring</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-border bg-surface-raised">
            <div className="flex-1">
              <div className="text-sm font-semibold text-text-primary">APP1</div>
              <div className="text-[11px] font-mono text-text-muted">QM.SRC.A → QM.APP1</div>
              {app1?.error && (
                <div className="text-[11px] text-danger mt-1">{app1.error}</div>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                app1State === 'MIGRATED' ? 'bg-success/20 text-success' :
                app1State === 'IDLE' ? 'bg-surface-overlay text-text-muted' :
                'bg-warning/20 text-warning'
              }`}>
                {app1State}
              </span>
              {(app1State === 'IDLE' || app1State === 'ROLLED_BACK') && (
                <button
                  onClick={() => triggerMigration('APP1', 'QM.SRC.A', 'QM.APP1')}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                >
                  Migrate APP1
                </button>
              )}
              {app1State === 'MIGRATED' && (
                <span className="text-xs text-success font-medium">Complete</span>
              )}
            </div>
          </div>
        </div>
      </SceneCard>

      {/* Scene 4 */}
      <SceneCard
        number={4}
        title={SCENE_TITLES[3]}
        subtitle={SCENE_SUBTITLES[3]}
        status={getSceneStatus(3)}
        duration={SCENE_DURATIONS[3]}
      >
        <RollbackDemoPanel />
      </SceneCard>

      {/* Scene 5 */}
      <SceneCard
        number={5}
        title={SCENE_TITLES[4]}
        subtitle={SCENE_SUBTITLES[4]}
        status={getSceneStatus(4)}
        duration={SCENE_DURATIONS[4]}
      >
        <BulkMigratePanel />
      </SceneCard>

      {/* Scene 6 */}
      <SceneCard
        number={6}
        title={SCENE_TITLES[5]}
        subtitle={SCENE_SUBTITLES[5]}
        status={getSceneStatus(5)}
        duration={SCENE_DURATIONS[5]}
      >
        <SentinelDemoPanel />
      </SceneCard>

      {/* Scene 7 */}
      <SceneCard
        number={7}
        title={SCENE_TITLES[6]}
        subtitle={SCENE_SUBTITLES[6]}
        status={getSceneStatus(6)}
        duration={SCENE_DURATIONS[6]}
      >
        <EvidenceCollector />
      </SceneCard>

      {/* Closing */}
      <div className="card px-5 py-4">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Closing (2 min)</div>
        <div className="text-xs text-text-muted space-y-1.5">
          <div className="flex items-start gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
            <span>Show Grafana dashboard — queue depths zero, all channels RUNNING, BCL p99 &lt; 200ms</span>
          </div>
          <div className="flex items-start gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
            <span>
              Show <a href="/audit" className="text-primary hover:underline">Audit Log</a> — complete chronological trail of every operation
            </span>
          </div>
          <div className="flex items-start gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-40 shrink-0 mt-0.5" />
            <span>
              Show <a href="/validation" className="text-primary hover:underline">Validation Matrix</a> — 18 green badges (6 apps × 3 phases)
            </span>
          </div>
        </div>
        <blockquote className="text-sm text-text-secondary italic border-l-2 border-surface-border pl-3 mt-3">
          "This is production-quality automation. The BCL enforces all guardrails. The ADK agent mesh handles the
          reasoning. The UI gives operators full visibility. And it's all running on OpenShift within your quota."
        </blockquote>
      </div>
    </div>
  );
}
