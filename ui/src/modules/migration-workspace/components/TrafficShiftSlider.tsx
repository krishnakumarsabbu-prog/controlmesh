import { motion } from 'framer-motion';
import { useWorkspaceStore } from '../store/workspaceStore';

export default function TrafficShiftSlider() {
  const { trafficSplit, setTrafficSplit } = useWorkspaceStore();

  const sourcePercent = 100 - trafficSplit;
  const targetPercent = trafficSplit;

  const strategy =
    trafficSplit === 0   ? 'All traffic on Source (Blue)'  :
    trafficSplit === 100 ? 'All traffic on Target (Green)' :
    `Blue/Green — ${sourcePercent}% Source / ${targetPercent}% Target`;

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-primary">Traffic Shift</span>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full border font-medium"
          style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8' }}
        >
          {strategy}
        </span>
      </div>

      {/* Split bar */}
      <div className="flex rounded-lg overflow-hidden h-5 mb-3 border border-surface-border">
        <motion.div
          className="flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'rgba(6,182,212,0.5)', color: '#22d3ee' }}
          animate={{ width: `${sourcePercent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          {sourcePercent > 15 ? `${sourcePercent}%` : ''}
        </motion.div>
        <motion.div
          className="flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'rgba(168,85,247,0.5)', color: '#c084fc' }}
          animate={{ width: `${targetPercent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          {targetPercent > 15 ? `${targetPercent}%` : ''}
        </motion.div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={100}
        step={10}
        value={trafficSplit}
        onChange={(e) => setTrafficSplit(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, rgba(6,182,212,0.6) 0%, rgba(6,182,212,0.6) ${sourcePercent}%, rgba(168,85,247,0.6) ${sourcePercent}%, rgba(168,85,247,0.6) 100%)`,
          accentColor: '#22d3ee',
        }}
      />

      {/* Labels */}
      <div className="flex justify-between mt-2">
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#22d3ee' }}>
          <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(6,182,212,0.6)' }} />
          Source ({sourcePercent}%)
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#c084fc' }}>
          Target ({targetPercent}%)
          <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(168,85,247,0.6)' }} />
        </div>
      </div>

      {/* Quick-set buttons */}
      <div className="flex gap-2 mt-3">
        {[0, 10, 50, 90, 100].map((v) => (
          <button
            key={v}
            onClick={() => setTrafficSplit(v)}
            className={`flex-1 text-[10px] py-1 rounded-md border transition-all duration-150 font-medium ${
              trafficSplit === v
                ? 'border-cyan-400/50 text-cyan-300 bg-cyan-400/10'
                : 'border-surface-border text-text-muted hover:bg-surface-overlay'
            }`}
          >
            {v}%
          </button>
        ))}
      </div>
    </div>
  );
}
