import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Plus, Trash2, Play, ChevronDown, ChevronUp, TriangleAlert as AlertTriangle, Circle as XCircle } from 'lucide-react';
import { runSystemValidation } from '../../api/validation';
import type { SystemValidationResult, SystemValidationQM, SystemValidationChannel, SystemViolation } from '../../types';

const RULE_LABELS: Record<string, string> = {
  QM_NAMING_CONVENTION: 'Naming Convention',
  DLQ_REQUIRED: 'DLQ Required',
  CHANNEL_MISSING: 'Channel Missing',
  CHANNEL_UNKNOWN_QM: 'Unknown QM Reference',
};

function ViolationRow({ v }: { v: SystemViolation }) {
  const isError = v.severity === 'ERROR';
  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm ${
        isError ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
      }`}
    >
      {isError ? (
        <XCircle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
      )}
      <div className="min-w-0">
        <div className={`font-semibold text-xs uppercase tracking-wide ${isError ? 'text-red-700' : 'text-amber-700'}`}>
          {RULE_LABELS[v.rule] ?? v.rule}
          {v.entity && (
            <span className={`ml-2 font-mono font-normal normal-case tracking-normal ${isError ? 'text-red-500' : 'text-amber-600'}`}>
              {v.entity}
            </span>
          )}
        </div>
        <div className={`mt-0.5 leading-snug ${isError ? 'text-red-600' : 'text-amber-600'}`}>{v.detail}</div>
      </div>
    </div>
  );
}

function QueueInput({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Q.APP1.LOCAL or Q.APP1.DLQ"
        className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      <button onClick={onRemove} className="text-slate-300 hover:text-red-400 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function QMEditor({
  qm,
  onChange,
  onRemove,
}: {
  qm: SystemValidationQM;
  onChange: (updated: SystemValidationQM) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  function updateQueue(i: number, val: string) {
    const queues = [...qm.queues];
    queues[i] = val;
    onChange({ ...qm, queues });
  }

  function addQueue() {
    onChange({ ...qm, queues: [...qm.queues, ''] });
  }

  function removeQueue(i: number) {
    onChange({ ...qm, queues: qm.queues.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <input
          type="text"
          value={qm.name}
          onChange={(e) => onChange({ ...qm, name: e.target.value })}
          placeholder="QM_APP_1"
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs font-mono font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button
          onClick={() => setExpanded((x) => !x)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={onRemove} className="text-slate-300 hover:text-red-400 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div className="px-3 py-2 flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Queues</div>
          {qm.queues.map((q, i) => (
            <QueueInput key={i} value={q} onChange={(v) => updateQueue(i, v)} onRemove={() => removeQueue(i)} />
          ))}
          <button
            onClick={addQueue}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
          >
            <Plus className="w-3 h-3" /> Add queue
          </button>
        </div>
      )}
    </div>
  );
}

const DEFAULT_QMS: SystemValidationQM[] = [
  { name: 'QM_SRC_A', queues: ['Q.APP1.LOCAL', 'Q.APP1.DLQ'] },
  { name: 'QM_APP_1', queues: ['Q.APP1.LOCAL'] },
];

const DEFAULT_CHANNELS: SystemValidationChannel[] = [
  { name: 'CHL.SRC.APP1', source_qm: 'QM_SRC_A', target_qm: 'QM_APP_1' },
];

export default function SystemValidationPanel() {
  const [qms, setQms] = useState<SystemValidationQM[]>(DEFAULT_QMS);
  const [channels, setChannels] = useState<SystemValidationChannel[]>(DEFAULT_CHANNELS);
  const [result, setResult] = useState<SystemValidationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runCount, setRunCount] = useState(0);

  function updateQM(i: number, updated: SystemValidationQM) {
    setQms((prev) => prev.map((q, idx) => (idx === i ? updated : q)));
  }

  function removeQM(i: number) {
    setQms((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addQM() {
    setQms((prev) => [...prev, { name: '', queues: [] }]);
  }

  function updateChannel(i: number, field: keyof SystemValidationChannel, value: string) {
    setChannels((prev) => prev.map((ch, idx) => (idx === i ? { ...ch, [field]: value } : ch)));
  }

  function removeChannel(i: number) {
    setChannels((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addChannel() {
    setChannels((prev) => [...prev, { name: '', source_qm: '', target_qm: '' }]);
  }

  async function handleRun() {
    setRunning(true);
    try {
      const r = await runSystemValidation(qms, channels);
      setResult(r);
      setRunCount((c) => c + 1);
    } finally {
      setRunning(false);
    }
  }

  const errors = result?.violations.filter((v) => v.severity === 'ERROR') ?? [];
  const warnings = result?.violations.filter((v) => v.severity === 'WARNING') ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-800">System Policy Validation</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validates DLQ presence, QM naming (QM_APP_X) and channel connectivity
            </p>
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={running || qms.length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            running || qms.length === 0
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-700 active:scale-95'
          }`}
        >
          {running ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full"
              />
              Validating…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Validate
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {/* Left: topology editor */}
        <div className="p-4 flex flex-col gap-4">
          {/* Queue Managers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Queue Managers
              </span>
              <button
                onClick={addQM}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {qms.map((qm, i) => (
                <QMEditor key={i} qm={qm} onChange={(u) => updateQM(i, u)} onRemove={() => removeQM(i)} />
              ))}
              {qms.length === 0 && (
                <div className="text-xs text-slate-300 text-center py-3 rounded-lg border border-dashed border-slate-200">
                  No queue managers defined
                </div>
              )}
            </div>
          </div>

          {/* Channels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Channels
              </span>
              <button
                onClick={addChannel}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {channels.map((ch, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={ch.name}
                      onChange={(e) => updateChannel(i, 'name', e.target.value)}
                      placeholder="CHL.SRC.APP1"
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                    <button onClick={() => removeChannel(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={ch.source_qm}
                      onChange={(e) => updateChannel(i, 'source_qm', e.target.value)}
                      placeholder="Source QM"
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                    <span className="text-slate-300 text-xs">→</span>
                    <input
                      type="text"
                      value={ch.target_qm}
                      onChange={(e) => updateChannel(i, 'target_qm', e.target.value)}
                      placeholder="Target QM"
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                </div>
              ))}
              {channels.length === 0 && (
                <div className="text-xs text-slate-300 text-center py-3 rounded-lg border border-dashed border-slate-200">
                  No channels defined
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div className="p-4 flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {result === null ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-slate-300 gap-2 py-10"
              >
                <ShieldAlert className="w-8 h-8" />
                <span className="text-sm">Run validation to see results</span>
              </motion.div>
            ) : (
              <motion.div
                key={`result-${runCount}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                {/* Status badge */}
                <div
                  className={`flex items-center gap-2.5 rounded-lg px-4 py-3 ${
                    result.valid
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {result.valid ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                  <div>
                    <div className={`text-sm font-bold ${result.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                      {result.valid ? 'ALL RULES PASSED' : 'POLICY VIOLATIONS FOUND'}
                    </div>
                    <div className={`text-xs mt-0.5 ${result.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                      {result.summary.queue_managers} QMs · {result.summary.channels} channels ·{' '}
                      {result.summary.errors} error{result.summary.errors !== 1 ? 's' : ''} ·{' '}
                      {result.summary.warnings} warning{result.summary.warnings !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Violations list */}
                {result.violations.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Violations
                    </div>
                    {errors.map((v, i) => (
                      <ViolationRow key={`e-${i}`} v={v} />
                    ))}
                    {warnings.map((v, i) => (
                      <ViolationRow key={`w-${i}`} v={v} />
                    ))}
                  </div>
                )}

                {result.valid && (
                  <div className="text-xs text-emerald-600 text-center py-4">
                    Topology meets all enterprise readiness requirements.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
