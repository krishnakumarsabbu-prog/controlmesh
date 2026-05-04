import { motion } from 'framer-motion';
import { STATE_COLORS, PULSING_STATES } from '../../lib/colors';
import type { MigrationState } from '../../types';

export default function StateBadge({ state }: { state: MigrationState }) {
  const colors = STATE_COLORS[state];
  const isPulsing = PULSING_STATES.includes(state);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
      style={colors.glow !== 'transparent' ? { boxShadow: `0 0 0 1px ${colors.glow.replace('0.35', '0.2')}, 0 2px 8px ${colors.glow.replace('0.35', '0.15')}` } : undefined}
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: colors.dot, boxShadow: `0 0 4px ${colors.dot}` }}
        animate={isPulsing ? { opacity: [1, 0.15, 1], scale: [1, 0.8, 1] } : { opacity: 1 }}
        transition={isPulsing ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      {state.replace(/_/g, ' ')}
    </div>
  );
}
