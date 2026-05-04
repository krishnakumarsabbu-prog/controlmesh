export default function TopologyLegend() {
  const stateItems = [
    { color: 'bg-slate-400',   label: 'Idle'        },
    { color: 'bg-blue-400',    label: 'Snapshotted' },
    { color: 'bg-amber-400',   label: 'In Progress' },
    { color: 'bg-sky-400',     label: 'Validating'  },
    { color: 'bg-emerald-500', label: 'Migrated'    },
    { color: 'bg-red-400',     label: 'Rolling Back'},
    { color: 'bg-orange-400',  label: 'Rolled Back' },
  ];

  const nodeTypes = [
    { color: 'bg-blue-500',   label: 'App'   },
    { color: 'bg-slate-500',  label: 'QM'    },
    { color: 'bg-slate-400',  label: 'Queue' },
  ];

  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2.5 shadow-xl border border-slate-700">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {nodeTypes.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`w-2 h-2 rounded-sm ${color}`} />
            {label}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-700 my-0.5" />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {stateItems.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
