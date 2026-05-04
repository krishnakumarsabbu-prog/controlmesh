import { RotateCcw, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { MigrationRecord } from '../../types';

export default function RollbackPanel({ record }: { record: MigrationRecord }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
        <span className="font-semibold text-orange-800 text-sm">{record.app_id}</span>
        <span className="ml-auto text-[11px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
          ROLLED BACK
        </span>
      </div>
      <div className="text-xs text-slate-600 font-mono mb-1">
        {record.source_qm} → {record.target_qm}
      </div>
      {record.started_at && (
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(record.started_at), { addSuffix: true })}
        </div>
      )}
      {record.error && (
        <div className="mt-1.5 text-[11px] text-red-500 bg-red-50 rounded px-2 py-1">
          {record.error}
        </div>
      )}
    </div>
  );
}
