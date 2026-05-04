export default function TopologyLegend() {
  const stateItems = [
    { color: '#94a3b8', label: 'Idle' },
    { color: '#60a5fa', label: 'Snapshotted' },
    { color: '#fbbf24', label: 'In Progress' },
    { color: '#38bdf8', label: 'Validating' },
    { color: '#34d399', label: 'Migrated' },
    { color: '#f87171', label: 'Rolling Back' },
  ];

  const nodeKinds = [
    { color: '#3b82f6', label: 'App', shape: 'rounded' },
    { color: '#7c3aed', label: 'Queue Manager', shape: 'rounded' },
    { color: '#475569', label: 'Queue', shape: 'rounded' },
  ];

  return (
    <div
      className="absolute bottom-4 left-4 z-10 flex flex-col gap-2"
      style={{
        background: 'rgba(10,12,24,0.88)',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: '10px',
        padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Legend</p>

      <div className="flex items-center gap-3">
        {nodeKinds.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: color, opacity: 0.9 }}
            />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      <div
        className="border-t my-0.5"
        style={{ borderColor: 'rgba(100,116,139,0.2)' }}
      />

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {stateItems.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      <div
        className="border-t mt-0.5"
        style={{ borderColor: 'rgba(100,116,139,0.2)' }}
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <svg width="24" height="8" viewBox="0 0 24 8">
            <line x1="0" y1="4" x2="18" y2="4" stroke="#93c5fd" strokeWidth="1.5" />
            <circle cx="5" cy="4" r="2" fill="#93c5fd" opacity="0.8" />
          </svg>
          <span className="text-[10px] text-slate-400">Message flow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="24" height="8" viewBox="0 0 24 8">
            <line x1="0" y1="4" x2="18" y2="4" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 2" />
            <circle cx="12" cy="4" r="2" fill="#fde68a" opacity="0.8" />
          </svg>
          <span className="text-[10px] text-slate-400">Rewiring</span>
        </div>
      </div>
    </div>
  );
}
