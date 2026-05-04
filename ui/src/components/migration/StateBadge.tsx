import { motion } from 'framer-motion';
import { STATE_COLORS, PULSING_STATES } from '../../lib/colors';
import type { MigrationState } from '../../types';

export default function StateBadge({ state }: { state: MigrationState }) {
  const colors = STATE_COLORS[state];
  const isPulsing = PULSING_STATES.includes(state);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      <motion.span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: colors.dot }}
        animate={isPulsing ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
        transition={isPulsing ? { duration: 1, repeat: Infinity } : undefined}
      />
      {state.replace('_', ' ')}
    </div>
  );
}
