import { useState } from 'react';
import { Download, CircleCheck as CheckCircle, Loader, TriangleAlert as AlertTriangle } from 'lucide-react';
import {
  fetchFleetRaw,
  fetchMigrationHistory,
  fetchValidationHistory,
  fetchAuditRaw,
  fetchMigrationStatus,
} from '../../api/demo';
import { bclClient } from '../../api/client';

const APPS = ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6'];

type CollectStatus = 'idle' | 'running' | 'done' | 'error';

interface EvidenceFile {
  filename: string;
  status: CollectStatus;
  size?: number;
}

export default function EvidenceCollector() {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [running, setRunning] = useState(false);
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);

  const updateFile = (filename: string, update: Partial<EvidenceFile>) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.filename === filename);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...update };
        return next;
      }
      return [...prev, { filename, status: 'idle', ...update }];
    });
  };

  const collect = async () => {
    setRunning(true);
    setBundle(null);
    const evidence: Record<string, unknown> = {};

    const run = async (filename: string, fn: () => Promise<unknown>) => {
      updateFile(filename, { status: 'running' });
      try {
        const data = await fn();
        const size = JSON.stringify(data).length;
        evidence[filename] = data;
        updateFile(filename, { status: 'done', size });
      } catch (err) {
        updateFile(filename, { status: 'error' });
        evidence[filename] = { error: String(err) };
      }
    };

    await run('01-fleet-final.json', fetchFleetRaw);
    await run('06-migration-status.json', fetchMigrationStatus);

    for (const app of APPS) {
      await run(`02-migration-${app}-history.json`, () => fetchMigrationHistory(app));
      await run(`03-validation-${app}.json`, () => fetchValidationHistory(app));
    }

    for (const app of APPS) {
      await run(`04-queues-QM.${app}.json`, () =>
        bclClient.get(`/api/queues?qm=QM.${app}`).then((r) => r.data).catch(() => ({ queues: [] }))
      );
    }

    await run('05-audit-log.json', () => fetchAuditRaw(1000));

    setBundle(evidence);
    setRunning(false);
  };

  const download = () => {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bcl-evidence-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = files.filter((f) => f.status === 'done').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Collect all migration evidence into a downloadable bundle for judges.
        </p>
        <div className="flex gap-2">
          <button
            onClick={collect}
            disabled={running}
            className="btn-ghost"
          >
            {running ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            {running ? 'Collecting…' : 'Collect evidence'}
          </button>
          {bundle && (
            <button
              onClick={download}
              className="btn-success"
            >
              <Download className="w-3 h-3" />
              Download bundle
            </button>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="rounded-lg border border-surface-border overflow-hidden">
          <div className="grid divide-y divide-surface-border">
            {files.map((f) => (
              <div key={f.filename} className="flex items-center gap-3 px-3 py-2 bg-surface-raised">
                <div className="shrink-0">
                  {f.status === 'running' && <Loader className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-warning)' }} />}
                  {f.status === 'done'    && <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--accent-success)' }} />}
                  {f.status === 'error'   && <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--accent-danger)' }} />}
                  {f.status === 'idle'    && <div className="w-3.5 h-3.5 rounded-full border-2 border-surface-border" />}
                </div>
                <span className="text-xs font-mono text-text-primary flex-1 truncate">{f.filename}</span>
                {f.size !== undefined && (
                  <span className="text-[10px] text-text-muted shrink-0">
                    {f.size > 1024 ? `${(f.size / 1024).toFixed(1)}kb` : `${f.size}b`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {bundle && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 border"
          style={{
            background: `color-mix(in srgb, var(${errorCount > 0 ? '--accent-warning' : '--accent-success'}) 10%, var(--surface-card))`,
            borderColor: `color-mix(in srgb, var(${errorCount > 0 ? '--accent-warning' : '--accent-success'}) 30%, transparent)`,
            color: `var(${errorCount > 0 ? '--accent-warning' : '--accent-success'})`,
          }}
        >
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          {doneCount} files collected
          {errorCount > 0 && ` (${errorCount} with errors — system may not be fully deployed)`}
          {errorCount === 0 && ' — evidence package ready for judges'}
        </div>
      )}
    </div>
  );
}
