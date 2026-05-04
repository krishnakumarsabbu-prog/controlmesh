export default function TopologyLegend() {
  const items = [
    { color: 'bg-slate-400',   label: 'Idle'        },
    { color: 'bg-blue-400',    label: 'Snapshotted' },
    { color: 'bg-amber-400',   label: 'In Progress' },
    { color: 'bg-sky-400',     label: 'Validating'  },
    { color: 'bg-emerald-500', label: 'Migrated'    },
    { color: 'bg-red-400',     label: 'Rolling Back'},
    { color: 'bg-orange-400',  label: 'Rolled Back' },
  ];

  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1.5 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow border border-slate-100">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className={`w-2 h-2 rounded-full ${color}`} />
          {label}
        </div>
      ))}
    </div>
  );
}
