import { ListFilter as Filter } from 'lucide-react';

interface Filters { operation: string; qm: string; agent: string; }
interface Props { filters: Filters; onChange: (f: Filters) => void; }

const OPERATIONS = ['', 'CREATE_QUEUE', 'CREATE_CHANNEL', 'VALIDATION', 'ROLLBACK', 'DELETE_QUEUE', 'MIGRATE'];
const QMS = ['', 'QM.SRC.A', 'QM.SRC.B', 'QM.APP1', 'QM.APP2', 'QM.APP3', 'QM.APP4', 'QM.APP5', 'QM.APP6'];

export default function EventFilters({ filters, onChange }: Props) {
  const select = 'text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Filter className="w-4 h-4" />
        <span>Filter:</span>
      </div>
      <select
        className={select}
        value={filters.operation}
        onChange={(e) => onChange({ ...filters, operation: e.target.value })}
      >
        {OPERATIONS.map((op) => (
          <option key={op} value={op}>{op || 'All operations'}</option>
        ))}
      </select>
      <select
        className={select}
        value={filters.qm}
        onChange={(e) => onChange({ ...filters, qm: e.target.value })}
      >
        {QMS.map((qm) => (
          <option key={qm} value={qm}>{qm || 'All QMs'}</option>
        ))}
      </select>
      {(filters.operation || filters.qm) && (
        <button
          onClick={() => onChange({ operation: '', qm: '', agent: '' })}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
