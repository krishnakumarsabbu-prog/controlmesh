import { motion, AnimatePresence } from 'framer-motion';
import { SquareCheck as CheckSquare, Square, Users, Zap, TrendingUp, TriangleAlert as AlertTriangle } from 'lucide-react';
import { MOCK_APPLICATIONS } from '../mock/data';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { WorkspaceApplication } from '../types';

const STATUS_COLORS = {
  healthy:  { dot: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  text: '#22c55e' },
  degraded: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
  error:    { dot: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  text: '#ef4444' },
};

function AppCard({ app, selected, onToggle }: { app: WorkspaceApplication; selected: boolean; onToggle: () => void }) {
  const c = STATUS_COLORS[app.status];
  const totalTps = [...app.producers, ...app.consumers].reduce((s, svc) => s + svc.tps, 0);

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={onToggle}
      className="cursor-pointer rounded-xl border transition-all duration-200"
      style={{
        background: selected ? 'rgba(6,182,212,0.06)' : 'var(--surface-card)',
        borderColor: selected ? 'rgba(6,182,212,0.4)' : 'var(--surface-border)',
        boxShadow: selected ? '0 0 0 1px rgba(6,182,212,0.2), 0 4px 24px rgba(6,182,212,0.08)' : undefined,
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)',
      }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            {selected ? (
              <CheckSquare className="w-4 h-4 shrink-0" style={{ color: '#22d3ee' }} />
            ) : (
              <Square className="w-4 h-4 shrink-0 text-text-muted" />
            )}
            <div>
              <div className="text-sm font-semibold text-text-primary">{app.name}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{app.environment} · {app.domain}</div>
            </div>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
            style={{ background: c.bg, borderColor: c.border, color: c.text }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
          </div>
        </div>

        {/* Producers / Consumers summary */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            className="rounded-lg p-2.5 border"
            style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}
          >
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" style={{ color: '#818cf8' }} />
              Producers
            </div>
            <div className="text-sm font-bold" style={{ color: '#818cf8' }}>{app.producers.length}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{app.producers.map(p => p.name).join(', ')}</div>
          </div>
          <div
            className="rounded-lg p-2.5 border"
            style={{ background: 'rgba(6,182,212,0.06)', borderColor: 'rgba(6,182,212,0.2)' }}
          >
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" style={{ color: '#22d3ee' }} />
              Consumers
            </div>
            <div className="text-sm font-bold" style={{ color: '#22d3ee' }}>{app.consumers.length}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{app.consumers.map(c => c.name).join(', ')}</div>
          </div>
        </div>

        {/* TPS row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
            <span style={{ color: '#22c55e' }}>{totalTps.toLocaleString()}</span>
            <span>TPS avg</span>
          </div>
          {app.status === 'degraded' && (
            <div className="flex items-center gap-1 text-[11px]" style={{ color: '#f59e0b' }}>
              <AlertTriangle className="w-3 h-3" />
              Degraded
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ApplicationSelector() {
  const { selectedAppId, selectApp, addTimelineEvent } = useWorkspaceStore();

  const toggle = (id: string) => {
    if (selectedAppId === id) {
      selectApp(null);
    } else {
      selectApp(id);
      const app = MOCK_APPLICATIONS.find(a => a.id === id);
      if (app) {
        addTimelineEvent({
          type: 'success',
          title: 'Application Selected',
          detail: `${app.name} — ${app.producers.length} producer(s), ${app.consumers.length} consumer(s) mapped`,
          step: 'app-mapping',
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">1. Select Applications</h3>
          <p className="text-xs text-text-muted mt-0.5">Choose one or more applications to migrate</p>
        </div>
        <div
          className="px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee' }}
        >
          {selectedAppId ? '1 selected' : '0 selected'}
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        <AnimatePresence>
          {MOCK_APPLICATIONS.map((app) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <AppCard
                app={app}
                selected={selectedAppId === app.id}
                onToggle={() => toggle(app.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {selectedAppId && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-3 border-t border-surface-border"
        >
          <div
            className="rounded-lg p-3 text-xs border flex items-center justify-between"
            style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}
          >
            <span>1 application ready for migration</span>
            <button className="btn-primary text-xs py-1">View Selected Mapping</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
