import { Check, X, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ValidationResult } from '../../types';

export default function ValidationBadge({ result }: { result?: ValidationResult }) {
  if (!result) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-muted">
        <Clock className="w-3.5 h-3.5 text-text-muted" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex flex-col items-center gap-0.5"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: `color-mix(in srgb, var(${result.passed ? '--accent-success' : '--accent-danger'}) 15%, var(--surface-card))`,
        }}
      >
        {result.passed
          ? <Check className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
          : <X className="w-4 h-4" style={{ color: 'var(--accent-danger)' }} />
        }
      </div>
      <span
        className="text-[10px] font-medium tabular-nums"
        style={{ color: result.passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}
      >
        {result.latency_ms}ms
      </span>
    </motion.div>
  );
}
